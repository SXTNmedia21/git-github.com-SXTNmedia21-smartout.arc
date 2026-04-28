#!/usr/bin/env bash
# dev-startup.sh — Signs into 1Password, starts Docker, Supabase, infra stack
#                  (caddy/scrapling/shift-mcp/stage-engine/contract-service/n8n),
#                  web (3060), landing (3055), and mobile (Expo).
# Usage: ./scripts/dev-startup.sh [--restart|-r]
#   --restart / -r   Kill any process holding a dev-server port before starting.
#                    Use after lockfile/dep changes so the new bundler picks them up.
# Alias: dev start

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

log()  { echo -e "${CYAN}[startup]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail() { echo -e "${RED}[ fail ]${NC} $1"; exit 1; }

# ── 1. 1Password service-account token ────────────────────────
# Dev uses a 1Password service-account token (no biometric, no master password).
# Token lives in .claude/op-auth.json (chmod 600, gitignored) and is loaded by
# .env.sh on cd into the project root. Production secrets are handled
# separately — never use this token against the prod vault.
log "Checking 1Password service-account..."

if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && [ -r "$PROJECT_ROOT/.env.sh" ]; then
  # Auto-source if not already set (e.g. invoked from a subshell).
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.sh"
fi

if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
  fail "OP_SERVICE_ACCOUNT_TOKEN not set. Verify .claude/op-auth.json exists and contains a valid op-token, then re-source .env.sh."
fi

if op whoami &>/dev/null; then
  ok "1Password service-account authenticated"
else
  fail "Service-account token rejected by op. Token may be revoked — rotate via 1Password.com → Service Accounts."
fi

# ── 2. Docker daemon ───────────────────────────────────────
log "Checking Docker daemon..."

if docker info &>/dev/null; then
  ok "Docker is running"
else
  warn "Docker is not running — attempting to start..."

  # WSL2: try starting Docker Desktop via Windows
  if command -v docker.exe &>/dev/null; then
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

# ── 3. Supabase local ─────────────────────────────────────
log "Checking Supabase..."

# Ensure npx cache is up to date — a new supabase release causes npx to
# prompt "OK to install?" which hangs when stdout is redirected.
if ! npx --yes supabase --version &>/dev/null; then
  warn "Supabase CLI not available via npx — run: npx --yes supabase --version"
  fail "Cannot proceed without Supabase CLI"
fi

if npx supabase status &>/dev/null; then
  ok "Supabase is running ($(npx supabase --version 2>/dev/null))"
else
  warn "Supabase is not running — starting..."
  npx supabase start
  if npx supabase status &>/dev/null; then
    ok "Supabase started"
  else
    fail "Supabase failed to start"
  fi
fi

# ── 4. Infra stack (caddy, scrapling, shift-mcp, stage-engine, contract-service, n8n) ──
log "Checking infra stack..."

INFRA_COMPOSE="${PROJECT_ROOT}/infra/docker-compose.yml"
INFRA_SERVICES=(caddy scrapling shift-mcp stage-engine contract-service n8n)

infra_missing=()
for svc in "${INFRA_SERVICES[@]}"; do
  # `docker compose ps -q` returns the container ID for a running service,
  # empty string if stopped or never created. Avoids relying on container
  # name format which differs between compose v1/v2.
  cid=$(docker compose -f "$INFRA_COMPOSE" ps -q "$svc" 2>/dev/null || true)
  if [ -z "$cid" ]; then
    infra_missing+=("$svc")
    continue
  fi
  state=$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || echo "false")
  if [ "$state" != "true" ]; then
    infra_missing+=("$svc")
  fi
done

if [ ${#infra_missing[@]} -eq 0 ]; then
  ok "Infra stack is running (${INFRA_SERVICES[*]})"
else
  warn "Infra missing/down: ${infra_missing[*]} — starting full stack..."
  if op run --env-file=.env.template -- docker compose -f "$INFRA_COMPOSE" up -d; then
    ok "Infra stack started"
  else
    fail "Infra stack failed to start (compose exit non-zero)"
  fi
fi

# ── 5. Dev servers (web + landing + mobile) ────────────────
check_port() {
  local port=$1
  if ss -tln 2>/dev/null | grep -q ":${port} " || \
     lsof -i ":${port}" &>/dev/null; then
    return 0
  fi
  return 1
}

# Resolves PIDs bound to $port. Uses ss first (sees all users), falls back to lsof.
# Without this, lsof alone can miss listeners owned by other shells/sessions.
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

# Kills whatever owns $port. TERM first, KILL after 3s if still alive.
# Only called when --restart is passed.
kill_port() {
  local port=$1
  local name=$2
  local pids
  pids=$(pids_on_port "$port")
  if [ -z "${pids// /}" ]; then
    return 0
  fi
  warn "${name} port ${port} occupied by PID(s) ${pids}— sending SIGTERM"
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null || true
  for i in 1 2 3; do
    sleep 1
    if ! check_port "$port"; then
      ok "${name} port ${port} freed"
      return 0
    fi
  done
  warn "${name} port ${port} still busy — sending SIGKILL"
  # shellcheck disable=SC2086
  kill -KILL $pids 2>/dev/null || true
  sleep 1
  if check_port "$port"; then
    fail "Could not free ${name} port ${port} (PIDs ${pids})"
  fi
  ok "${name} port ${port} freed"
}

start_dev_server() {
  local name=$1
  local port=$2
  local filter=$3
  local logfile="${PROJECT_ROOT}/.dev-${name}.log"

  if [ "$RESTART" -eq 1 ]; then
    # Always attempt to kill; kill_port is a no-op if nothing is bound.
    # Running this unconditionally avoids the check_port/lsof visibility race
    # that made stale listeners survive --restart.
    kill_port "$port" "$name"
  elif check_port "$port"; then
    ok "${name} is already running on port ${port}"
    return
  fi

  log "Starting ${name} on port ${port}..."
  nohup op run --env-file=.env.template -- pnpm --filter "${filter}" dev > "$logfile" 2>&1 &
  local pid=$!

  # Wait up to 30s for the port to be bound by OUR process tree.
  # Without the pgroup check, a surviving old listener would make this
  # loop report false success while our new process just crashed with EADDRINUSE.
  local pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
  for i in $(seq 1 30); do
    if check_port "$port"; then
      local owner_pids
      owner_pids=$(pids_on_port "$port")
      local matched=0
      for opid in $owner_pids; do
        local opgid
        opgid=$(ps -o pgid= -p "$opid" 2>/dev/null | tr -d ' ')
        if [ -n "$opgid" ] && [ "$opgid" = "$pgid" ]; then
          matched=1
          break
        fi
      done
      if [ "$matched" -eq 1 ]; then
        ok "${name} started on port ${port} (pid ${pid}, log: ${logfile})"
        return
      fi
      # Port is bound but not by us — almost certainly a stale listener
      # the kill didn't catch. Surface it loudly instead of faking success.
      if ! kill -0 "$pid" 2>/dev/null; then
        fail "${name} failed to start — port ${port} is held by foreign PID(s) ${owner_pids}. Check ${logfile}"
      fi
    fi
    sleep 1
  done

  warn "${name} may still be starting (pid ${pid}). Check log: ${logfile}"
}

start_dev_server "web"     3060 "web"
start_dev_server "landing" 3055 "landing"

# Mobile (Expo) — uses port 8081 by default
start_expo() {
  local logfile="${PROJECT_ROOT}/.dev-mobile.log"

  if [ "$RESTART" -eq 1 ]; then
    kill_port 8081 "Mobile (Expo)"
  elif check_port 8081; then
    ok "Mobile (Expo) is already running on port 8081"
    return
  fi

  log "Starting Mobile (Expo)..."
  # On --restart, also wipe Metro's transform cache so dep/lockfile changes are picked up.
  local expo_args=()
  if [ "$RESTART" -eq 1 ]; then
    expo_args+=(-- --clear)
  fi
  nohup op run --env-file=.env.template -- pnpm --filter mobile start "${expo_args[@]}" > "$logfile" 2>&1 &
  local pid=$!

  for i in $(seq 1 30); do
    if check_port 8081; then
      ok "Mobile (Expo) started on port 8081 (pid ${pid}, log: ${logfile})"
      return
    fi
    sleep 1
  done

  warn "Mobile (Expo) may still be starting (pid ${pid}). Check log: ${logfile}"
}

start_expo

# ── Summary ────────────────────────────────────────────────
echo ""
log "Dev environment ready:"
echo -e "  ${GREEN}1Password${NC} — signed in"
echo -e "  ${GREEN}Docker${NC}    — running"
echo -e "  ${GREEN}Supabase${NC}  — running"
echo -e "  ${GREEN}Infra${NC}     — caddy, scrapling, shift-mcp (5011), stage-engine (5010), contract-service (5012), n8n"
echo -e "  ${GREEN}Web${NC}       — http://localhost:3060"
echo -e "  ${GREEN}Landing${NC}   — http://localhost:3055"
echo -e "  ${GREEN}Mobile${NC}    — Expo on port 8081"
echo ""
