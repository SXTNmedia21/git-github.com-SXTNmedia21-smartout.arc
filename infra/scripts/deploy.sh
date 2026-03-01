#!/bin/bash
# ============================================
# deploy.sh — Pull latest code, rebuild, restart
# Run on the DigitalOcean Droplet from the monorepo root.
# Connected to: infra/docker-compose.yml + docker-compose.prod.yml
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$INFRA_DIR")"

echo "=== Smartout Deploy ==="
echo "Repo: $REPO_DIR"
echo "Infra: $INFRA_DIR"
echo ""

# Pull latest monorepo code
cd "$REPO_DIR"
echo "Pulling latest code..."
git pull

# Rebuild and restart services
cd "$INFRA_DIR"
echo "Rebuilding and restarting..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 5

# Health check
echo "Running health checks..."
"$SCRIPT_DIR/health-check.sh"

echo ""
echo "=== Deploy complete ==="
