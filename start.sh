#!/usr/bin/env bash
# X-Downloader 2.0 - Full Stack Launcher
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     X-Downloader 2.0 Launcher      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════╝${NC}"
echo ""

# --- Backend ---
echo -e "${GREEN}[1/2] Starting Backend...${NC}"

if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/.venv"
    source "$BACKEND_DIR/.venv/bin/activate"
    pip install -q -r "$BACKEND_DIR/requirements.txt"
else
    source "$BACKEND_DIR/.venv/bin/activate"
fi

cd "$BACKEND_DIR"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd "$ROOT_DIR"

echo -e "   Backend PID: ${CYAN}$BACKEND_PID${NC}"
echo -e "   API docs:    ${CYAN}http://localhost:8000/docs${NC}"
echo ""

# --- Frontend ---
echo -e "${GREEN}[2/2] Starting Frontend...${NC}"
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing Node dependencies..."
    cd "$FRONTEND_DIR"
    npm install --silent
    cd "$ROOT_DIR"
fi

cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo -e "   Frontend PID: ${CYAN}$FRONTEND_PID${NC}"
echo -e "   UI:           ${CYAN}http://localhost:3000${NC}"
echo ""

echo -e "${GREEN}Both services running! Press Ctrl+C to stop.${NC}"

# Trap to kill both on exit
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
