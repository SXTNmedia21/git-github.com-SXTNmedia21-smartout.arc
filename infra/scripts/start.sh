#!/usr/bin/env bash
# ============================================
# start.sh — Secure local infra bootstrap for development.
# Ensures 1Password login, validates required env vars,
# starts each service with op-injected env, and verifies
# endpoint health before reporting success.
# Connected to: .env.template, infra/docker-compose.yml
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$INFRA_DIR")"
ENV_TEMPLATE="$REPO_ROOT/.env.template"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[infra:start]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail() { echo -e "${RED}[ fail ]${NC} $1"; exit 1; }

CORE_REQUIRED_ENV_VARS=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ENGINE_URL
  STAGE_ENGINE_API_KEY
  ULTRAVOX_API_KEY
  OPENROUTER_API_KEY
  CONTRACT_SERVICE_KEY
  DOCUSEAL_API_KEY
  DOCUSEAL_WEBHOOK_SECRET
  SCRAPLING_AUTH_TOKEN
  SERPER_API_KEY
)

N8N_ENV_VARS=(
  N8N_BASIC_AUTH_USER
  N8N_BASIC_AUTH_PASSWORD
  N8N_ENCRYPTION_KEY
)

SERVICES=(
  caddy
  stage-engine
  shift-mcp
  contract-service
  scrapling
)

N8N_ENABLED=false

# Verifies CLI dependencies needed by the script.
require_commands() {
  local required=(docker op curl)
  for cmd in "${required[@]}"; do
    command -v "$cmd" >/dev/null 2>&1 || fail "Missing required command: $cmd"
  done
}

# Ensures op CLI can resolve secrets via the dev service-account token.
# Token is loaded by .env.sh on entry to the project root (see CLAUDE.md
# secrets-protocol). Production secrets are sourced separately and never
# loaded by this script.
ensure_op_login() {
  if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && [ -r "$REPO_ROOT/.env.sh" ]; then
    # shellcheck disable=SC1091
    source "$REPO_ROOT/.env.sh"
  fi

  if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
    fail "OP_SERVICE_ACCOUNT_TOKEN not set. Verify .claude/op-auth.json exists, then re-source .env.sh."
  fi

  if op whoami >/dev/null 2>&1; then
    ok "1Password service-account authenticated"
  else
    fail "Service-account token rejected — rotate via 1Password.com → Service Accounts."
  fi
}

# Validates that all required environment variables resolve from .env.template.
# Never prints values; only reports missing variable names.
validate_core_env_vars() {
  log "Validating required environment variables for core services..."

  local validation_output
  if ! validation_output="$(
    op run --env-file="$ENV_TEMPLATE" -- bash -lc '
      set -euo pipefail
      missing=()
      vars=('"$(printf "'%s' " "${CORE_REQUIRED_ENV_VARS[@]}")"')
      for key in "${vars[@]}"; do
        value="${!key:-}"
        if [[ -z "$value" || "$value" == "op://"* ]]; then
          missing+=("$key")
        fi
      done

      if [[ "${#missing[@]}" -gt 0 ]]; then
        printf "MISSING:%s\n" "${missing[*]}"
        exit 1
      fi
      echo "OK"
    '
  )"; then
    local missing_vars="${validation_output#MISSING:}"
    fail "Missing required env vars in .env.template/1Password: $missing_vars"
  fi

  ok "Core environment variables are present"
}

# Decides if n8n should be started.
# - no n8n vars set: skip n8n
# - all n8n vars set: include n8n
# - partial n8n vars: fail to avoid insecure startup
resolve_n8n_plan() {
  log "Checking n8n environment readiness..."

  local status_output
  status_output="$(
    op run --env-file="$ENV_TEMPLATE" -- bash -lc '
      set -euo pipefail
      vars=('"$(printf "'%s' " "${N8N_ENV_VARS[@]}")"')
      present=()
      missing=()
      for key in "${vars[@]}"; do
        value="${!key:-}"
        if [[ -n "$value" && "$value" != "op://"* ]]; then
          present+=("$key")
        else
          missing+=("$key")
        fi
      done

      if [[ "${#present[@]}" -eq 0 ]]; then
        echo "ABSENT"
      elif [[ "${#missing[@]}" -eq 0 ]]; then
        echo "COMPLETE"
      else
        printf "PARTIAL:%s\n" "${missing[*]}"
      fi
    '
  )"

  case "$status_output" in
    ABSENT)
      warn "n8n env vars are not configured. n8n will be skipped."
      N8N_ENABLED=false
      ;;
    COMPLETE)
      ok "n8n env vars are complete"
      N8N_ENABLED=true
      ;;
    PARTIAL:*)
      fail "n8n env vars are partially configured. Missing: ${status_output#PARTIAL:}"
      ;;
    *)
      fail "Unexpected n8n env status: $status_output"
      ;;
  esac
}

# Starts one compose service with op-injected environment.
start_service() {
  local service_name="$1"
  log "Starting service: $service_name"
  op run --env-file="$ENV_TEMPLATE" -- docker compose up -d --build "$service_name" >/dev/null
  ok "Service started: $service_name"
}

# Waits for an HTTP endpoint to become healthy.
wait_for_endpoint() {
  local service_name="$1"
  local endpoint="$2"
  local timeout_seconds="${3:-90}"
  local interval_seconds=3
  local elapsed=0

  while [[ "$elapsed" -lt "$timeout_seconds" ]]; do
    if curl -sf --max-time 5 "$endpoint" >/dev/null 2>&1; then
      ok "Endpoint healthy: $service_name ($endpoint)"
      return
    fi
    sleep "$interval_seconds"
    elapsed=$((elapsed + interval_seconds))
  done

  fail "Endpoint did not become healthy: $service_name ($endpoint)"
}

# Waits until a Docker container's built-in health status becomes healthy.
# Used for services where host endpoint probing is unreliable in dev routing.
wait_for_container_health() {
  local service_name="$1"
  local timeout_seconds="${2:-90}"
  local interval_seconds=3
  local elapsed=0

  while [[ "$elapsed" -lt "$timeout_seconds" ]]; do
    local container_id
    container_id="$(op run --env-file="$ENV_TEMPLATE" -- docker compose ps -q "$service_name" || true)"
    if [[ -n "$container_id" ]]; then
      local health_state
      health_state="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$health_state" == "healthy" || "$health_state" == "none" ]]; then
        ok "Container healthy: $service_name"
        return
      fi
    fi

    sleep "$interval_seconds"
    elapsed=$((elapsed + interval_seconds))
  done

  fail "Container did not become healthy: $service_name"
}

# Starts stack in safe order and validates health after each step.
start_stack() {
  start_service "caddy"
  wait_for_container_health "caddy" 60

  start_service "stage-engine"
  wait_for_endpoint "stage-engine" "http://localhost:5010/health"

  start_service "shift-mcp"
  wait_for_endpoint "shift-mcp" "http://localhost:5011/health"

  start_service "contract-service"
  wait_for_endpoint "contract-service" "http://localhost:5012/health"

  start_service "scrapling"
  wait_for_endpoint "scrapling" "http://localhost:8000/health" 120

  if [[ "$N8N_ENABLED" == true ]]; then
    start_service "n8n"
    wait_for_endpoint "n8n" "http://localhost:5678/healthz" 120
  fi
}

# Ensures we always start from a clean Compose state.
# If services are already running, shut them down before restart.
reset_existing_stack_if_running() {
  log "Checking for already running infra containers..."
  local running_services
  running_services="$(
    op run --env-file="$ENV_TEMPLATE" -- docker compose ps --status running -q || true
  )"

  if [[ -n "${running_services}" ]]; then
    warn "Existing infra containers detected. Running docker compose down first..."
    op run --env-file="$ENV_TEMPLATE" -- docker compose down --remove-orphans >/dev/null
    ok "Previous infra stack stopped"
  else
    ok "No running infra containers detected"
  fi
}

# Prints final compose status for operator visibility.
print_status() {
  echo ""
  log "Docker Compose status:"
  op run --env-file="$ENV_TEMPLATE" -- docker compose ps
}

main() {
  cd "$INFRA_DIR"
  require_commands
  [[ -f "$ENV_TEMPLATE" ]] || fail "Missing env template: $ENV_TEMPLATE"
  ensure_op_login
  validate_core_env_vars
  resolve_n8n_plan
  reset_existing_stack_if_running
  start_stack
  print_status
  echo ""
  ok "Infra stack is started and health-verified"
}

main "$@"
