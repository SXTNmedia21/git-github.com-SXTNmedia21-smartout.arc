#!/usr/bin/env bash
# serve-dashboard.sh — local HTTP server for AGENT-DASHBOARD.html
#
# Required because browsers block fetch() on file:// URLs.
# This starts a tiny Python HTTP server rooted at the telemetry-map folder,
# serves all JSON/JSONL/HTML files, and opens the dashboard.
#
# Usage:
#   bash serve-dashboard.sh          # default port 7743
#   bash serve-dashboard.sh 8080     # custom port
#
# Stop: Ctrl-C

set -euo pipefail

PORT="${1:-7743}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:${PORT}/AGENT-DASHBOARD.html"

echo ""
echo "  SmartOut — Agent Observatory"
echo "  ─────────────────────────────────────"
echo "  Serving: ${SCRIPT_DIR}"
echo "  URL:     ${URL}"
echo ""
echo "  Stop with Ctrl-C"
echo ""

# Try to open browser (WSL-aware)
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL" &>/dev/null &
elif command -v wslview &>/dev/null; then
  wslview "$URL" &>/dev/null &
elif [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  # WSL without wslview — try powershell.exe
  powershell.exe -Command "Start-Process '$URL'" &>/dev/null 2>&1 || true
fi

# Start server — Python 3 preferred, fall back to Python 2
cd "$SCRIPT_DIR"
if command -v python3 &>/dev/null; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python &>/dev/null; then
  python -m SimpleHTTPServer "$PORT"
else
  echo "ERROR: python3 not found. Install it with: sudo apt install python3"
  exit 1
fi
