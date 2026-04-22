#!/usr/bin/env bash
# dev-stop.sh — Stops dev servers (web 3060, landing 3055, mobile Expo 8081).
#               Optionally stops Supabase local and/or infra docker-compose stack.
# Usage: ./scripts/dev-stop.sh [--supabase] [--docker] [--dryrun|-n]
#   --supabase   Also run `npx supabase stop`
#   --docker     Also run `docker compose down` on infra/docker-compose.yml
#   --dryrun,-n  Print what would be done, do not execute
# Alias: dev stop

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Args ────────────────────────────────────────────────────
STOP_SUPABASE=0
STOP_DOCKER=0
DRYRUN=0
for arg in "$@"; do
  case "$arg" in
    --supabase)  STOP_SUPABASE=1 ;;
    --docker)    STOP_DOCKER=1 ;;
    --dryrun|-n) DRYRUN=1 ;;
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

log()  { echo -e "${CYAN}[ stop ]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail() { echo -e "${RED}[ fail ]${NC} $1"; exit 1; }

run() {
  if [ "$DRYRUN" -eq 1 ]; then
    echo -e "${YELLOW}[dryrun]${NC} $*"
  else
    eval "$@"
  fi
}

# ── Port helpers (mirror dev-startup.sh) ───────────────────
check_port() {
  local port=$1
  if ss -tln 2>/dev/null | grep -q ":${port} " || \
     lsof -i ":${port}" &>/dev/null; then
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
  local name=$2
  local pids
  pids=$(pids_on_port "$port")
  if [ -z "${pids// /}" ]; then
    ok "${name} port ${port} already free"
    return 0
  fi
  if [ "$DRYRUN" -eq 1 ]; then
    echo -e "${YELLOW}[dryrun]${NC} kill -TERM ${pids} (${name} port ${port})"
    echo -e "${YELLOW}[dryrun]${NC} kill -KILL ${pids} if still alive after 3s"
    return 0
  fi
  log "${name} port ${port} held by PID(s) ${pids}— SIGTERM"
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  for i in 1 2 3; do
    sleep 1
    if ! check_port "$port"; then
      ok "${name} port ${port} freed"
      return 0
    fi
  done
  warn "${name} port ${port} still busy — SIGKILL"
  # shellcheck disable=SC2086
  kill -KILL $pids 2>/dev/null || true
  sleep 1
  if check_port "$port"; then
    fail "Could not free ${name} port ${port} (PIDs ${pids})"
  fi
  ok "${name} port ${port} freed"
}

# ── 0. Inventory (dryrun preview) ──────────────────────────
if [ "$DRYRUN" -eq 1 ]; then
  log "Current dev-environment state:"

  print_port_state() {
    local port=$1
    local name=$2
    local pids
    pids=$(pids_on_port "$port")
    if [ -z "${pids// /}" ]; then
      echo -e "  ${GREEN}${name}${NC} port ${port} — ${YELLOW}not running${NC}"
    else
      local cmds=""
      for pid in $pids; do
        local c
        c=$(ps -o args= -p "$pid" 2>/dev/null | head -c 80 | tr -d '\n')
        cmds="${cmds}    pid ${pid}: ${c}\n"
      done
      echo -e "  ${GREEN}${name}${NC} port ${port} — ${CYAN}RUNNING${NC} (PIDs:${pids})"
      echo -en "${cmds}"
    fi
  }
  print_port_state 3060 "web       "
  print_port_state 3055 "landing   "
  print_port_state 8081 "mobile    "

  if command -v npx &>/dev/null && npx supabase status &>/dev/null; then
    echo -e "  ${GREEN}supabase  ${NC}          — ${CYAN}RUNNING${NC}"
  else
    echo -e "  ${GREEN}supabase  ${NC}          — ${YELLOW}not running${NC}"
  fi

  print_infra_state() {
    if ! docker info &>/dev/null; then
      echo -e "  ${GREEN}infra     ${NC}          — ${YELLOW}docker daemon down${NC}"
      return
    fi
    local compose_file="${PROJECT_ROOT}/infra/docker-compose.yml"
    if [ ! -f "$compose_file" ]; then
      echo -e "  ${GREEN}infra     ${NC}          — ${YELLOW}no compose file${NC}"
      return
    fi
    local services
    services=$(docker compose -f "$compose_file" ps --services --filter "status=running" 2>/dev/null | tr '\n' ' ')
    if [ -n "${services// /}" ]; then
      echo -e "  ${GREEN}infra     ${NC}          — ${CYAN}RUNNING${NC} (${services})"
    else
      echo -e "  ${GREEN}infra     ${NC}          — ${YELLOW}not running${NC}"
    fi
  }
  print_infra_state
  echo ""
fi

# ── 1. Dev servers ─────────────────────────────────────────
log "Stopping dev servers..."
kill_port 3060 "web"
kill_port 3055 "landing"
kill_port 8081 "Mobile (Expo)"

# ── 2. Supabase (optional) ─────────────────────────────────
if [ "$STOP_SUPABASE" -eq 1 ]; then
  log "Stopping Supabase local..."
  if ! command -v npx &>/dev/null; then
    warn "npx not found — skipping Supabase stop"
  elif ! npx supabase status &>/dev/null; then
    ok "Supabase already stopped"
  else
    run "npx supabase stop"
    [ "$DRYRUN" -eq 0 ] && ok "Supabase stopped"
  fi
fi

# ── 3. Infra docker-compose (optional) ─────────────────────
if [ "$STOP_DOCKER" -eq 1 ]; then
  log "Stopping infra docker-compose stack..."
  if ! docker info &>/dev/null; then
    warn "Docker daemon not running — nothing to stop"
  elif [ ! -f "${PROJECT_ROOT}/infra/docker-compose.yml" ]; then
    warn "infra/docker-compose.yml not found — skipping"
  else
    run "docker compose -f ${PROJECT_ROOT}/infra/docker-compose.yml down"
    [ "$DRYRUN" -eq 0 ] && ok "infra stack down"
  fi
fi

# ── Summary ────────────────────────────────────────────────
echo ""
if [ "$DRYRUN" -eq 1 ]; then
  log "Dry run — no changes made."
else
  log "Dev environment stopped."
fi
echo -e "  ${GREEN}Web${NC}       — port 3060 free"
echo -e "  ${GREEN}Landing${NC}   — port 3055 free"
echo -e "  ${GREEN}Mobile${NC}    — port 8081 free"
[ "$STOP_SUPABASE" -eq 1 ] && echo -e "  ${GREEN}Supabase${NC}  — stopped"
[ "$STOP_DOCKER" -eq 1 ]   && echo -e "  ${GREEN}Docker${NC}    — infra stack down"
echo ""
