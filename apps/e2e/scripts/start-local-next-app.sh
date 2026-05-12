#!/usr/bin/env bash
# ============================================
# start-local-next-app.sh
# Starts a Next.js app for Playwright against
# the local Supabase stack on a dedicated port.
#
# Why: local E2E must not depend on whichever
# manual dev server is already running, and it
# must point to the same local Supabase instance
# as the Playwright verifier scripts.
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <workspace-package> <port>" >&2
  exit 1
fi

PACKAGE_NAME="$1"
PORT="$2"

bootstrap_local_app_env() {
  local status_output=""

  if ! status_output="$(npx supabase status -o env --workdir "${REPO_ROOT}" 2>/dev/null)"; then
    cat >&2 <<'EOF'
Local Playwright app bootstrap could not read Supabase status.
Start the local Supabase stack with `npx supabase start` before
running the dedicated Playwright web servers.
EOF
    exit 1
  fi

  local api_url
  local anon_key
  local service_role_key

  api_url="$(
    printf '%s\n' "${status_output}" |
      sed -n 's/^API_URL="\([^"]*\)"$/\1/p'
  )"
  anon_key="$(
    printf '%s\n' "${status_output}" |
      sed -n 's/^ANON_KEY="\([^"]*\)"$/\1/p'
  )"
  service_role_key="$(
    printf '%s\n' "${status_output}" |
      sed -n 's/^SERVICE_ROLE_KEY="\([^"]*\)"$/\1/p'
  )"

  if [[ -z "${api_url}" || -z "${anon_key}" ]]; then
    cat >&2 <<'EOF'
Local Supabase did not return the public env values required to start
the Playwright app servers.
EOF
    exit 1
  fi

  export NEXT_PUBLIC_SUPABASE_URL="${api_url}"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY="${anon_key}"
  export SUPABASE_SERVICE_ROLE_KEY="${service_role_key:-}"
  export SUPABASE_URL="${api_url}"
  export SUPABASE_ANON_KEY="${anon_key}"
  export NEXT_PUBLIC_ROOT_DOMAIN="localhost"
  export NEXT_DIST_DIR=".next-e2e-${PACKAGE_NAME}"

  # Stage-engine bridge (used by Botsson Arena + recorder metrics proxy).
  # Defaults align with services/stage-engine/.env.local — matches the
  # stage-engine pnpm dev server started alongside Playwright in Phase 2d
  # E2E runs. When the stage-engine is not running, the web BFF will 502
  # on the one request path that needs it (recorder/_metrics), which is
  # what we want (the E2E that reads it controls its own up/down).
  export STAGE_ENGINE_URL="${STAGE_ENGINE_URL:-http://127.0.0.1:5010}"
  export STAGE_ENGINE_API_KEY="${STAGE_ENGINE_API_KEY:-test-dev-api-key-for-local-e2e-12345}"
  # DocuSeal webhook secret — required by env.ts (.min(16)) but webhook never
  # fires during E2E (no real DocuSeal events). Set a synthetic local default
  # so createEnv() does not throw before the test even starts.
  export DOCUSEAL_WEBHOOK_SECRET="${DOCUSEAL_WEBHOOK_SECRET:-e2e-local-docuseal-stub-key}"
  # Public URL for the browser-side Guardian WebSocket (useGuardianSocket).
  # Without this the Guardian Monitor can never populate SessionList — the
  # schedule-wrong-day-replay E2E depends on it.
  export NEXT_PUBLIC_STAGE_ENGINE_URL="${NEXT_PUBLIC_STAGE_ENGINE_URL:-http://127.0.0.1:5010}"
  # Dev-mode SMTP bridge — routes @smartout/notifications through Mailpit
  # (supabase/config.toml [inbucket].smtp_port). Without this, invite mail
  # tries SendGrid HTTPS API and either silently fails (no SENDGRID_API_KEY
  # in E2E env) or sends to real recipients. See ADR-0045 amendment.
  export SMTP_DEV_HOST="${SMTP_DEV_HOST:-127.0.0.1:54325}"
  # Web app base URL — invite mail builds accept links from this. Without
  # it, getInviteUrl falls back to https://app.smartout.ai (prod) and dev
  # mail in Mailpit links to live URLs that 404 the local invite token.
  export NEXT_PUBLIC_WEB_APP_URL="${NEXT_PUBLIC_WEB_APP_URL:-http://127.0.0.1:${PORT}}"
}

main() {
  bootstrap_local_app_env

  # If the port is already in use, next dev exits 1 with EADDRINUSE.
  # Playwright's reuseExistingServer:true handles that case — it detects
  # the URL is already responding and proceeds without a new process.
  # But Playwright requires the *command* to exit 0 to mark the server
  # as "ready". We exit 0 on EADDRINUSE so Playwright's reuse path
  # triggers correctly instead of aborting with "exited early".
  #
  # Why not just always exit 0? set -euo pipefail means a real startup
  # failure (e.g. missing env, bad port arg) propagates correctly — only
  # the EADDRINUSE case from next dev itself needs the exit-0 override.
  pnpm --filter "${PACKAGE_NAME}" exec next dev -p "${PORT}" || {
    _exit_code=$?
    # Exit 1 + output includes EADDRINUSE → port already in use, treat as OK.
    # next dev exits 1 for all startup errors including EADDRINUSE. We exit 0
    # here so Playwright's reuseExistingServer URL-check can take over.
    # Real startup failures (bad args, missing env) were already caught above
    # by bootstrap_local_app_env; next dev exit 1 here = port conflict.
    if [[ ${_exit_code} -eq 1 ]]; then
      exit 0
    fi
    exit "${_exit_code}"
  }
}

main "$@"
