#!/bin/bash
# ============================================
# setup.sh — First-time setup for Smartout infrastructure
# Verifies Docker is available and creates .env from template.
# Connected to: infra/.env.example (template)
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Smartout Infra Setup ==="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed."
  echo "Install: https://docs.docker.com/get-docker/"
  exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
  echo "ERROR: Docker Compose plugin not found."
  echo "Install: https://docs.docker.com/compose/install/"
  exit 1
fi

echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version)"
echo ""

# Create .env if missing
if [ ! -f "$INFRA_DIR/.env" ]; then
  cp "$INFRA_DIR/.env.example" "$INFRA_DIR/.env"
  echo "Created .env from template."
  echo "IMPORTANT: Edit .env and fill in your values before starting."
else
  echo ".env already exists — skipping."
fi

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit infra/.env with your values"
echo "  2. Run: cd infra && docker compose up"
echo ""
