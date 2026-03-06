#!/bin/bash
# ============================================
# backup-cron.sh — Cron-friendly backup wrapper
# Logs output, keeps last 7 backups, exits cleanly.
# Install: crontab -e → 0 3 * * * /path/to/backup-cron.sh
# Connected to: infra/scripts/backup.sh (actual backup logic)
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${HOME}/backups/smartout/logs"
BACKUP_BASE="${HOME}/backups/smartout"
KEEP_DAYS=7

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/backup-$(date +%Y-%m-%d_%H%M).log"

echo "=== Backup started: $(date) ===" >> "$LOG_FILE"

# Run backup
if "$SCRIPT_DIR/backup.sh" >> "$LOG_FILE" 2>&1; then
  echo "=== Backup completed: $(date) ===" >> "$LOG_FILE"
else
  echo "=== Backup FAILED: $(date) ===" >> "$LOG_FILE"
  exit 1
fi

# Prune old backups (keep last N days)
find "$BACKUP_BASE" -maxdepth 1 -type d -name "20*" -mtime +${KEEP_DAYS} -exec rm -rf {} \; >> "$LOG_FILE" 2>&1
echo "Pruned backups older than ${KEEP_DAYS} days" >> "$LOG_FILE"

# Prune old logs
find "$LOG_DIR" -name "backup-*.log" -mtime +30 -delete >> "$LOG_FILE" 2>&1
