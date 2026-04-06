#!/bin/bash
# ============================================
# deploy.sh — Pull latest code, sync env, rebuild, verify
# Run on the DigitalOcean Droplet.
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

# Step 0: Verify we're on main
cd "$REPO_DIR"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: Droplet must be on main branch. Current: $CURRENT_BRANCH"
  echo "Run: git checkout main"
  exit 1
fi

# Step 1: Sync env vars from 1Password (if script exists and OP is available)
if [ -f "$SCRIPT_DIR/sync-env-to-droplet.sh" ]; then
  echo "Syncing environment variables..."
  "$SCRIPT_DIR/sync-env-to-droplet.sh" || {
    echo "WARNING: Env sync failed. Continuing with existing .env"
  }
else
  echo "SKIP: sync-env-to-droplet.sh not found. Using existing .env"
fi

# Step 2: Pull latest code
echo "Pulling latest code from main..."
git pull origin main

# Step 3: Rebuild and restart services
cd "$INFRA_DIR"
echo "Rebuilding and restarting..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Step 4: Health check with retry
echo "Waiting for services to become healthy..."
"$SCRIPT_DIR/health-check.sh" --retry

echo ""
echo "=== Deploy complete ==="
