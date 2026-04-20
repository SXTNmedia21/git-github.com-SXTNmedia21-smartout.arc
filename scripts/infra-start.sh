#!/usr/bin/env bash
# ============================================
# infra-start.sh — Root entrypoint for infra startup.
# Runs the secure infra bootstrap from repository root.
# ============================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec "$REPO_ROOT/infra/scripts/start.sh"
