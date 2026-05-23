#!/usr/bin/env bash
# ============================================================================
# local-prod.sh — Run apps/web as a *production build* on localhost, wired to
# the LIVE production Supabase Cloud project (yljaglomadbhyqpcigff).
#
# Why: `next dev` hides middleware/prefetch/cookie bugs. This runs the real
# prod runtime (`next build && next start`) so what you see locally matches
# Vercel. Env comes from the `smartout_ai_prod` 1Password vault via op run.
#
# ⚠️  THIS WRITES TO LIVE PRODUCTION DATA. Test users / rows you create land in
#     the real auth + workspace tables. Sanctioned only in the no-customer
#     hotfix phase (Pontus decision 2026-05-21). Do not leave running.
#
# Modes:
#   localhost (default) — http://localhost:3060
#       ROOT_DOMAIN forced to "localhost" so cookies are host-scoped and the
#       session actually persists. Reproduces the middleware verifier-nuke and
#       all logic bugs. Does NOT reproduce the `.smartout.ai` dual-domain
#       cookie collision (localhost can't carry a `.smartout.ai` cookie).
#
#   domain — https://app.smartout.ai (full prod parity)
#       Keeps ROOT_DOMAIN=smartout.ai so cookies are `.smartout.ai`-scoped,
#       reproducing the domain-collision class too. REQUIRES:
#         1. hosts entry:  127.0.0.1  app.smartout.ai   (+ any *.smartout.ai
#            workspace slugs you test). On Windows edit
#            C:\Windows\System32\drivers\etc\hosts as admin.
#         2. a local HTTPS reverse proxy on :443 -> 127.0.0.1:3060 with a CA
#            your browser trusts (Caddy auto-CA: `caddy reverse-proxy
#            --from app.smartout.ai --to localhost:3060`).
#       NOTE: while the hosts entry exists, this machine cannot reach the real
#       production site — it resolves to your local server.
#
# Connected to: .env.local-prod.template (prod-vault op:// refs)
# ============================================================================
set -euo pipefail

MODE="${1:-localhost}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMPL="$REPO_ROOT/.env.local-prod.template"
PORT=3060

CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
log()  { echo -e "${CYAN}[local-prod]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail() { echo -e "${RED}[ fail ]${NC} $1"; exit 1; }

[[ -f "$TMPL" ]] || fail "missing $TMPL (run from repo with the prod template committed)"

# 1Password session
if ! op whoami >/dev/null 2>&1; then
  log "1Password not signed in — run: eval \$(op signin)"; exit 1
fi

echo -e "${RED}============================================================${NC}"
echo -e "${RED} LIVE PRODUCTION Supabase (yljaglomadbhyqpcigff)${NC}"
echo -e "${RED} Writes hit real auth/workspace data. Ctrl-C to abort.${NC}"
echo -e "${RED}============================================================${NC}"

# Build a mode-specific env file (op:// refs are resolved later by op run).
RUN_TMPL="$(mktemp /tmp/local-prod-env.XXXXXX)"
trap 'rm -f "$RUN_TMPL"' EXIT
cp "$TMPL" "$RUN_TMPL"

if [[ "$MODE" == "localhost" ]]; then
  log "mode=localhost  ->  http://localhost:$PORT  (ROOT_DOMAIN forced to localhost)"
  # Force host-scoped cookies so the session persists on localhost.
  sed -i \
    -e 's#^NEXT_PUBLIC_ROOT_DOMAIN=.*#NEXT_PUBLIC_ROOT_DOMAIN="localhost"#' \
    -e "s#^NEXT_PUBLIC_WEB_APP_URL=.*#NEXT_PUBLIC_WEB_APP_URL=\"http://localhost:$PORT\"#" \
    -e "s#^APP_URL=.*#APP_URL=\"http://localhost:$PORT\"#" \
    -e "s#^SITE_URL=.*#SITE_URL=\"http://localhost:$PORT\"#" \
    -e "s#^WEB_URL=.*#WEB_URL=\"http://localhost:$PORT\"#" \
    "$RUN_TMPL"
  warn "Google OAuth + email links must allow http://localhost:$PORT/api/auth/callback"
  warn "(add it to Supabase Auth > URL Configuration redirect list + Google console)"
elif [[ "$MODE" == "domain" ]]; then
  log "mode=domain  ->  https://app.smartout.ai  (ROOT_DOMAIN=smartout.ai, full parity)"
  warn "Requires hosts entry 127.0.0.1 app.smartout.ai + local HTTPS proxy :443 -> :$PORT"
else
  fail "unknown mode '$MODE' (use: localhost | domain)"
fi

# Production build, then production server.
# NEXT_PUBLIC_* are inlined at BUILD time, so the build MUST run under op run with
# the same mode-adjusted env — otherwise the prod Supabase URL / ROOT_DOMAIN are
# baked wrong (or undefined). Build and start share $RUN_TMPL.
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  log "building web (prod, op-injected) — set SKIP_BUILD=1 to skip on rebuilds"
  ( cd "$REPO_ROOT" && op run --env-file="$RUN_TMPL" -- pnpm --filter web build )
fi

log "starting prod server on :$PORT"
exec op run --env-file="$RUN_TMPL" -- pnpm --filter web start
