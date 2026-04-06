#!/bin/bash
# ============================================
# health-check.sh — Ping all service health endpoints
# Run after deploy or to verify stack health.
# Usage: health-check.sh [--retry]
#   --retry: poll up to 120s with 5s intervals
# Connected to: infra/docker-compose.yml (service definitions)
# ============================================

set -euo pipefail

RETRY_MODE=false
MAX_WAIT=120
INTERVAL=5
[[ "${1:-}" == "--retry" ]] && RETRY_MODE=true

SERVICES=(
  "Caddy|http://localhost:80"
  "Stage Engine|http://localhost:5010/health"
  "Shift MCP|http://localhost:5011/health"
  "Contract Service|http://localhost:5012/health"
  "Scrapling|http://localhost:8000/health"
  # n8n intentionally excluded — not deployed to production droplet
)

check_all() {
  local failed=0
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name url <<< "$entry"
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
      echo "  OK    $name"
    else
      echo "  FAIL  $name ($url)"
      failed=1
    fi
  done
  return $failed
}

if [ "$RETRY_MODE" = true ]; then
  elapsed=0
  while [ $elapsed -lt $MAX_WAIT ]; do
    echo "Health check (${elapsed}s / ${MAX_WAIT}s)..."
    if check_all; then
      echo ""
      echo "All services healthy."
      exit 0
    fi
    echo "  Retrying in ${INTERVAL}s..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  echo ""
  echo "ERROR: Services not healthy after ${MAX_WAIT}s"
  exit 1
else
  echo "Checking services..."
  if check_all; then
    echo ""
    echo "All services healthy."
  else
    echo ""
    echo "Some services failed health check!"
    exit 1
  fi
fi
