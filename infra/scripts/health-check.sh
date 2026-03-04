#!/bin/bash
# ============================================
# health-check.sh — Ping all service health endpoints
# Run after deploy or to verify stack health.
# Connected to: infra/docker-compose.yml (service definitions)
# ============================================

set -euo pipefail

echo "Checking services..."

check() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
    echo "  OK    $name"
  else
    echo "  FAIL  $name ($url)"
    FAILED=1
  fi
}

FAILED=0

check "Caddy"            "http://localhost:80"
check "Stage Engine"     "http://localhost:5010/health"
check "Shift MCP"        "http://localhost:5011/health"
check "Contract Service" "http://localhost:5012/health"
check "Scrapling"        "http://localhost:8000/health"
check "n8n"              "http://localhost:5678/healthz"

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "Some services failed health check!"
  exit 1
else
  echo ""
  echo "All services healthy."
fi
