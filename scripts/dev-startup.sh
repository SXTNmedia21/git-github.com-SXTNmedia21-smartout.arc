#!/usr/bin/env bash
# dev-startup.sh — Ensures Docker, Supabase, web (3050), and landing (3055) are running.
# Usage: ./scripts/dev-startup.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[startup]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail() { echo -e "${RED}[ fail ]${NC} $1"; exit 1; }

# ── 1. Docker daemon ───────────────────────────────────────
log "Checking Docker daemon..."

if docker info &>/dev/null; then
  ok "Docker is running"
else
  warn "Docker is not running — attempting to start..."

  # WSL2: try starting Docker Desktop via Windows
  if command -v docker.exe &>/dev/null; then
    # Start Docker Desktop on the Windows side
    cmd.exe /c "start /b \"\" \"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe\"" 2>/dev/null || true

    log "Waiting for Docker daemon (up to 60s)..."
    for i in $(seq 1 30); do
      if docker info &>/dev/null; then
        ok "Docker started after ~$((i * 2))s"
        break
      fi
      sleep 2
    done

    if ! docker info &>/dev/null; then
      fail "Docker did not start within 60s. Start Docker Desktop manually."
    fi
  else
    fail "Docker is not running and no docker.exe found. Start Docker manually."
  fi
fi

# ── 2. Supabase local ─────────────────────────────────────
log "Checking Supabase..."

if npx supabase status &>/dev/null; then
  ok "Supabase is running"
else
  warn "Supabase is not running — starting..."
  npx supabase start
  if npx supabase status &>/dev/null; then
    ok "Supabase started"
  else
    fail "Supabase failed to start"
  fi
fi

# ── 3. Dev servers (web + landing) ─────────────────────────
check_port() {
  local port=$1
  # Check if something is listening on the port
  if ss -tln 2>/dev/null | grep -q ":${port} " || \
     lsof -i ":${port}" &>/dev/null; then
    return 0
  fi
  return 1
}

start_dev_server() {
  local name=$1
  local port=$2
  local filter=$3
  local logfile="${PROJECT_ROOT}/.dev-${name}.log"

  if check_port "$port"; then
    ok "${name} is already running on port ${port}"
    return
  fi

  log "Starting ${name} on port ${port}..."
  nohup pnpm --filter "${filter}" dev > "$logfile" 2>&1 &
  local pid=$!

  # Wait up to 30s for the port to become available
  for i in $(seq 1 30); do
    if check_port "$port"; then
      ok "${name} started on port ${port} (pid ${pid}, log: ${logfile})"
      return
    fi
    sleep 1
  done

  warn "${name} may still be starting (pid ${pid}). Check log: ${logfile}"
}

start_dev_server "web"     3050 "web"
start_dev_server "landing" 3055 "landing"

# ── Summary ────────────────────────────────────────────────
echo ""
log "Dev environment ready:"
echo -e "  ${GREEN}Docker${NC}    — running"
echo -e "  ${GREEN}Supabase${NC}  — running"
echo -e "  ${GREEN}Web${NC}       — http://localhost:3050"
echo -e "  ${GREEN}Landing${NC}   — http://localhost:3055"
echo ""
