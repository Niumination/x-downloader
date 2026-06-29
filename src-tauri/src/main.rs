#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::watch;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DownloadItem {
    id: i64,
    url: String,
    title: String,
    site: String,
    quality: String,
    status: String,
    progress: f64,
    speed: String,
    eta: String,
    filename: String,
    error: String,
}

struct ActiveDownload {
    item: DownloadItem,
    /// Send `true` via this channel to kill the yt-dlp child process.
    kill_tx: watch::Sender<bool>,
}

type DownloadStore = Arc<Mutex<HashMap<i64, ActiveDownload>>>;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn preview_formats(url: String) -> Result<String, String> {
    let output = Command::new("yt-dlp")
        .arg("-F")
        .arg(&url)
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("yt-dlp error: {}", stderr))
    }
}

#[tauri::command]
async fn start_download(
    url: String,
    quality: String,
    cookies_browser: String,
    output_dir: Option<String>,
    app: AppHandle,
    store: tauri::State<'_, DownloadStore>,
) -> Result<DownloadItem, String> {
    let id = chrono::Utc::now().timestamp_millis();
    let (kill_tx, kill_rx) = watch::channel(false);

    let item = DownloadItem {
        id,
        url: url.clone(),
        title: "Fetching info...".to_string(),
        site: "Detecting...".to_string(),
        quality: quality.clone(),
        status: "downloading".to_string(),
        progress: 0.0,
        speed: String::new(),
        eta: String::new(),
        filename: String::new(),
        error: String::new(),
    };

    // Insert into store BEFORE spawning so cancel_download can find it
    {
        let mut s = store.lock().unwrap();
        s.insert(id, ActiveDownload {
            item: item.clone(),
            kill_tx,
        });
    }

    let store_clone = store.inner().clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        run_download(id, url, quality, cookies_browser, output_dir, store_clone, app_clone, kill_rx).await;
    });

    Ok(item)
}

#[tauri::command]
async fn cancel_download(id: i64, store: tauri::State<'_, DownloadStore>) -> Result<(), String> {
    let store = store.lock().unwrap();
    if let Some(active) = store.get(&id) {
        let _ = active.kill_tx.send(true);
        Ok(())
    } else {
        Err("Download not found".to_string())
    }
}

// ---------------------------------------------------------------------------
// Download engine
// ---------------------------------------------------------------------------

async fn run_download(
    id: i64,
    url: String,
    quality: String,
    cookies_browser: String,
    output_dir: Option<String>,
    store: DownloadStore,
    app: AppHandle,
    mut kill_rx: watch::Receiver<bool>,
) {
    // Build yt-dlp arguments
    let format = match quality.as_str() {
        "1080p" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "720p" => "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "480p" => "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
        "audio" => "bestaudio/best",
        _ => "bestvideo*+bestaudio/best",
    };

    let output_path = output_dir.unwrap_or_else(|| {
        dirs::download_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("~/Downloads"))
            .to_string_lossy()
            .to_string()
    });

    // Build the yt-dlp command
    let mut cmd = Command::new("yt-dlp");
    cmd.arg("--no-playlist")
        .arg("--progress")
        .arg("--newline")
        .arg("--output")
        .arg(format!("{}/%(title)s [%(id)s].%(ext)s", output_path))
        .arg("--format")
        .arg(format);

    if cookies_browser != "none" {
        cmd.arg("--cookies-from-browser").arg(&cookies_browser);
    }

    // Site-specific options
    if url.contains("pornhub.com") || url.contains("phncdn.com") {
        cmd.arg("--referer").arg("https://www.pornhub.com/");
        cmd.arg("--impersonate").arg("chrome");
    } else if url.contains("missav") || url.contains("91porn") || url.contains("jable") {
        cmd.arg("--impersonate").arg("chrome");
    }

    cmd.arg(&url);

    // Spawn child
    let mut child = match cmd.stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::null()).spawn() {
        Ok(child) => child,
        Err(e) => {
            update_status(&store, id, "error", 0.0, "", "", "", &format!("Failed to start: {}", e), &app);
            cleanup_store(&store, id);
            return;
        }
    };

    // Read stdout line-by-line, racing against the cancel signal
    let stdout = child.stdout.take().expect("stdout captured");
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    loop {
        tokio::select! {
            biased;

            _ = kill_rx.changed() => {
                // Value changed — check if we should cancel
                if *kill_rx.borrow() {
                    let _ = child.kill().await;      // SIGKILL on Unix
                    let _ = child.wait().await;       // reap
                    update_status(&store, id, "cancelled", 0.0, "", "", "", "", &app);
                    cleanup_store(&store, id);
                    return;
                }
            }

            result = lines.next_line() => {
                match result {
                    Ok(Some(line)) => parse_progress(&line, &store, id, &app),
                    Ok(None) => break,   // EOF — download finished
                    Err(_) => break,     // I/O error
                }
            }
        }
    }

    // Wait for exit status
    let exit_status = child.wait().await;

    if let Ok(status) = exit_status {
        if status.success() {
            // Try to extract title from the output filename (last progress line)
            update_status(&store, id, "completed", 100.0, "", "", "", "", &app);
        } else {
            update_status(&store, id, "error", 0.0, "", "", "", "Download failed", &app);
        }
    } else {
        update_status(&store, id, "error", 0.0, "", "", "", "Process wait error", &app);
    }

    cleanup_store(&store, id);
}

// ---------------------------------------------------------------------------
// Progress parsing
// ---------------------------------------------------------------------------

fn parse_progress(line: &str, store: &DownloadStore, id: i64, app: &AppHandle) {
    // yt-dlp --newline outputs lines like:
    //   [download]  45.2% of ~25.4MiB at 3.2MiB/s ETA 00:05
    let re = Regex::new(
        r"\[download\]\s+(\d+\.?\d*)%\s+of\s+[\d.]+[KMGTP]?i?B\s+at\s+([\d.]+[KMGTP]?i?B/s)\s+ETA\s+([\d:]+)"
    ).unwrap();

    if let Some(caps) = re.captures(line) {
        let progress: f64 = caps[1].parse().unwrap_or(0.0);
        let speed = caps[2].to_string();
        let eta = caps[3].to_string();
        update_status(store, id, "downloading", progress, &speed, &eta, "", "", app);
    }
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

fn update_status(
    store: &DownloadStore,
    id: i64,
    status: &str,
    progress: f64,
    speed: &str,
    eta: &str,
    filename: &str,
    error: &str,
    app: &AppHandle,
) {
    let mut s = store.lock().unwrap();
    if let Some(active) = s.get_mut(&id) {
        let item = &mut active.item;
        item.status = status.to_string();
        item.progress = progress;
        if !speed.is_empty() { item.speed = speed.to_string(); }
        if !eta.is_empty() { item.eta = eta.to_string(); }
        if !filename.is_empty() { item.filename = filename.to_string(); }
        if !error.is_empty() { item.error = error.to_string(); }

        let _ = app.emit("download-update", item.clone());
    }
}

fn cleanup_store(store: &DownloadStore, id: i64) {
    let mut s = store.lock().unwrap();
    s.remove(&id);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

fn main() {
    let store: DownloadStore = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(store)
        .invoke_handler(tauri::generate_handler![
            start_download,
            cancel_download,
            preview_formats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
