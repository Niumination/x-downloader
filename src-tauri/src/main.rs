#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;
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

type DownloadStore = Arc<Mutex<HashMap<i64, DownloadItem>>>;

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
    
    let item = DownloadItem {
        id,
        url: url.clone(),
        title: "Fetching info...".to_string(),
        site: "Detecting...".to_string(),
        quality: quality.clone(),
        status: "downloading".to_string(),
        progress: 0.0,
        speed: "".to_string(),
        eta: "".to_string(),
        filename: "".to_string(),
        error: "".to_string(),
    };

    {
        let mut store = store.lock().unwrap();
        store.insert(id, item.clone());
    }

    let store_clone = store.inner().clone();
    let app_clone = app.clone();
    
    tokio::spawn(async move {
        run_download(id, url, quality, cookies_browser, output_dir, store_clone, app_clone).await;
    });

    Ok(item)
}

async fn run_download(
    id: i64,
    url: String,
    quality: String,
    cookies_browser: String,
    output_dir: Option<String>,
    store: DownloadStore,
    app: AppHandle,
) {
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

    if url.contains("pornhub.com") || url.contains("phncdn.com") {
        cmd.arg("--referer").arg("https://www.pornhub.com/");
        cmd.arg("--impersonate").arg("chrome");
    } else if url.contains("missav") || url.contains("91porn") || url.contains("jable") {
        cmd.arg("--impersonate").arg("chrome");
    }

    cmd.arg(&url);

    let mut child = match cmd.stdout(std::process::Stdio::piped()).spawn() {
        Ok(child) => child,
        Err(e) => {
            update_download_status(&store, id, "error", 0.0, "", "", "", &format!("Failed to start: {}", e), &app);
            return;
        }
    };

    use tokio::io::{AsyncBufReadExt, BufReader};
    
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Some(line) = lines.next_line().await.unwrap_or(None) {
            parse_progress_line(&line, &store, id, &app);
        }
    }

    let status = child.wait().await;

    if let Ok(exit_status) = status {
        if exit_status.success() {
            update_download_status(&store, id, "completed", 100.0, "", "", "", "", &app);
        } else {
            update_download_status(&store, id, "error", 0.0, "", "", "", "Download failed", &app);
        }
    }
}

fn parse_progress_line(line: &str, store: &DownloadStore, id: i64, app: &AppHandle) {
    let re = Regex::new(r"\[download\]\s+(\d+\.?\d*)%\s+of\s+[\d.]+\w+\s+at\s+([\d.]+\w+/s)\s+ETA\s+([\d:]+)").unwrap();
    
    if let Some(caps) = re.captures(line) {
        let progress: f64 = caps[1].parse().unwrap_or(0.0);
        let speed = caps[2].to_string();
        let eta = caps[3].to_string();

        update_download_status(store, id, "downloading", progress, &speed, &eta, "", "", app);
    }
}

fn update_download_status(
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
    let mut store = store.lock().unwrap();
    
    if let Some(item) = store.get_mut(&id) {
        item.status = status.to_string();
        item.progress = progress;
        item.speed = speed.to_string();
        item.eta = eta.to_string();
        if !filename.is_empty() { item.filename = filename.to_string(); }
        if !error.is_empty() { item.error = error.to_string(); }
        
        let _ = app.emit("download-update", item.clone());
    }
}

#[tauri::command]
async fn cancel_download(id: i64, store: tauri::State<'_, DownloadStore>) -> Result<(), String> {
    let mut store = store.lock().unwrap();
    if let Some(item) = store.get_mut(&id) {
        item.status = "cancelled".to_string();
    }
    Ok(())
}

fn main() {
    let store: DownloadStore = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(store)
        .invoke_handler(tauri::generate_handler![start_download, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}