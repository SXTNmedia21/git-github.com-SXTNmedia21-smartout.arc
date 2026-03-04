#!/bin/bash
# ============================================
# backup.sh — Backup persistent Docker volumes
# Saves n8n data and Caddy certificates.
# Connected to: infra/docker-compose.yml (volume definitions)
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/smartout/$(date +%Y-%m-%d_%H%M)}"

mkdir -p "$BACKUP_DIR"

echo "=== Smartout Backup ==="
echo "Saving to: $BACKUP_DIR"
echo ""

cd "$INFRA_DIR"

# Backup n8n data
echo "Backing up n8n data..."
docker compose exec -T n8n tar czf - /home/node/.n8n > "$BACKUP_DIR/n8n-data.tar.gz"
echo "  Saved: n8n-data.tar.gz"

# Backup Caddy data (certificates)
echo "Backing up Caddy certificates..."
docker compose exec -T caddy tar czf - /data > "$BACKUP_DIR/caddy-data.tar.gz"
echo "  Saved: caddy-data.tar.gz"

echo ""
echo "=== Backup complete: $BACKUP_DIR ==="
ls -lh "$BACKUP_DIR"
