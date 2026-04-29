#!/usr/bin/env bash
# web-start.sh — Start ONLY the Next.js web dev server on port 3060.
#                Reuses the same op-run wrapper + port-conflict logic as dev-startup.
# Usage: ./scripts/web-start.sh [--restart|-r]
#   --restart / -r   Kill any process holding port 3060 before starting.
# Alias: web start

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Args ────────────────────────────────────────────────────
RESTART=0
for arg in "$@"; do
  case "$arg" in
    --restart|-r) RESTART=1 ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[web]${NC} $1"; }
ok()   { echo -e "${GREEN}[ ok ]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
fail() { echo -e "${RED}[fail]${NC} $1"; exit 1; }

# ── 1Password token ────────────────────────────────────────
if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && [ -r "$PROJECT_ROOT/.env.sh" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.sh"
fi

if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
  fail "OP_SERVICE_ACCOUNT_TOKEN not set. Verify .claude/op-auth.json + re-source .env.sh."
fi

if ! op whoami &>/dev/null; then
  fail "Service-account token rejected. Rotate via 1Password.com → Service Accounts."
fi

# ── Port helpers ───────────────────────────────────────────
check_port() {
  local port=$1
  if ss -tln 2>/dev/null | grep -q ":${port} " || lsof -i ":${port}" &>/dev/null; then
    return 0
  fi
  return 1
}

pids_on_port() {
  local port=$1
  local pids
  pids=$(ss -tlnpH 2>/dev/null \
    | awk -v p=":${port}" '$4 ~ p {print $0}' \
    | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u | tr '\n' ' ')
  if [ -z "$pids" ]; then
    pids=$(lsof -ti ":${port}" 2>/dev/null | sort -u | tr '\n' ' ')
  fi
  echo "$pids"
}

kill_port() {
  local port=$1
  local pids
  pids=$(pids_on_port "$port")
  if [ -z "${pids// /}" ]; then
    return 0
  fi
  warn "Port ${port} occupied by PID(s) ${pids} — sending SIGTERM"
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  for i in 1 2 3; do
    sleep 1
    if ! check_port "$port"; then
      ok "Port ${port} freed"
      return 0
    fi
  done
  warn "Port ${port} still busy — sending SIGKILL"
  # shellcheck disable=SC2086
  kill -KILL $pids 2>/dev/null || true
  sleep 1
  if check_port "$port"; then
    fail "Could not free port ${port} (PIDs ${pids})"
  fi
  ok "Port ${port} freed"
}

# ── Start web ──────────────────────────────────────────────
PORT=3060
LOGFILE="${PROJECT_ROOT}/.dev-web.log"

if [ "$RESTART" -eq 1 ]; then
  kill_port "$PORT"
elif check_port "$PORT"; then
  ok "web already running on port ${PORT}"
  exit 0
fi

log "Starting web on port ${PORT}..."
nohup op run --env-file=.env.template -- pnpm --filter web dev > "$LOGFILE" 2>&1 &
PID=$!

# Wait up to 30s for our process group to bind the port
PGID=$(ps -o pgid= -p "$PID" 2>/dev/null | tr -d ' ')
for i in $(seq 1 30); do
  if check_port "$PORT"; then
    OWNER_PIDS=$(pids_on_port "$PORT")
    matched=0
    for opid in $OWNER_PIDS; do
      opgid=$(ps -o pgid= -p "$opid" 2>/dev/null | tr -d ' ')
      if [ -n "$opgid" ] && [ "$opgid" = "$PGID" ]; then
        matched=1
        break
      fi
    done
    if [ "$matched" -eq 1 ]; then
      ok "web started on port ${PORT} (pid ${PID}, log: ${LOGFILE})"
      echo ""
      log "→ http://localhost:${PORT}"
      log "→ tail -f ${LOGFILE}"
      exit 0
    fi
    if ! kill -0 "$PID" 2>/dev/null; then
      fail "web failed — port ${PORT} held by foreign PID(s) ${OWNER_PIDS}. Check ${LOGFILE}"
    fi
  fi
  sleep 1
done

warn "web may still be starting (pid ${PID}). Check log: ${LOGFILE}"
