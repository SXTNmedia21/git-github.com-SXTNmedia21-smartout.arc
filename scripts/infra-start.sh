#!/usr/bin/env bash
# ============================================
# infra-start.sh — Root entrypoint for infra startup.
# Runs the secure infra bootstrap from repository root.
# ============================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Auto-source .env.sh when invoked outside the project root (e.g. via `dev infra`
# from ~/). .env.sh exports OP_SERVICE_ACCOUNT_TOKEN from .claude/op-auth.json
# so `op run --env-file=.env.template` works without biometric prompt.
if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && [ -r "$REPO_ROOT/.env.sh" ]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.sh"
fi

exec "$REPO_ROOT/infra/scripts/start.sh"
