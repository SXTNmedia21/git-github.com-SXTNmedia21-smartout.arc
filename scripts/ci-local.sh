#!/usr/bin/env bash
# Local CI mirror — runs gates from .github/workflows/*.yml that can execute
# against Supabase Local without Cloud, Anthropic API, or live droplet.
#
# Skipped (external dependencies):
#   edge-functions-deploy, migration-deploy, migration-state, ai-eval,
#   botsson-canary, claude-code-review, docker-build, pipeline-enforcement
#
# Usage: pnpm ci:local
#
# Requires: Supabase Local running (`npx supabase start`).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Mirror CI workflow-level env (ci.yml line 16)
export SKIP_ENV_VALIDATION=true

# CI=true triggers conservative worker limits in jest/vitest/turbo,
# preventing OOM-kills on local machines with bursty cores.
export CI="${CI:-true}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; SKIP=0; WARN=0
RESULTS=()

run_gate() {
  local name="$1"; shift
  echo -e "\n${YELLOW}━━━ ${name} ━━━${NC}"
  if "$@"; then
    echo -e "${GREEN}✓ ${name}${NC}"
    RESULTS+=("✓ ${name}")
    PASS=$((PASS+1))
  else
    echo -e "${RED}✗ ${name}${NC}"
    RESULTS+=("✗ ${name}")
    FAIL=$((FAIL+1))
  fi
}

# Same as run_gate but marks as warning instead of failure (matches CI's
# `pnpm run X | tee log` pipe-mask behavior — exit code lost in CI).
warn_gate() {
  local name="$1"; shift
  echo -e "\n${YELLOW}━━━ ${name} ━━━${NC}"
  if "$@"; then
    echo -e "${GREEN}✓ ${name}${NC}"
    RESULTS+=("✓ ${name}")
    PASS=$((PASS+1))
  else
    echo -e "${YELLOW}⚠ ${name} (CI tolerates via | tee pipe-mask)${NC}"
    RESULTS+=("⚠ ${name} (CI pipe-mask)")
    WARN=$((WARN+1))
  fi
}

skip_gate() {
  local name="$1"; local reason="$2"
  RESULTS+=("↷ ${name} (${reason})")
  SKIP=$((SKIP+1))
}

# Preflight: Supabase Local
if ! npx supabase status >/dev/null 2>&1; then
  echo -e "${RED}Supabase Local not running — start with 'npx supabase start'${NC}"
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
export DATABASE_URL

# === ci.yml gates ===
run_gate "lint"                       pnpm turbo lint
run_gate "typecheck"                  pnpm turbo typecheck

# Format check — changed files only vs origin/development (mirrors ci.yml).
format_check_changed() {
  git fetch origin development --depth=1 >/dev/null 2>&1 || true
  local base_ref="origin/development"
  local files
  files=$(git diff --name-only --diff-filter=ACMR "${base_ref}"...HEAD -- '*.ts' '*.tsx' '*.md' '*.json' '*.css' || true)
  if [ -z "$files" ]; then
    echo "No formattable files changed vs ${base_ref} — skipping prettier."
    return 0
  fi
  echo "Checking $(echo "$files" | wc -l) files vs ${base_ref}:"
  echo "$files"
  echo "$files" | xargs pnpm exec prettier --check
}
run_gate "format-check"               format_check_changed

# Vitest with concurrency cap + per-worker memory cap + cache bust.
# (1) Parallel package tests OOM-kill workers — cap memory + concurrency.
# (2) Turbo cache leaks paths from sibling worktrees (smartout.ai-payroll etc.)
#     per L-turbo-cache-cross-worktree — force cache bust.
run_vitest() {
  NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=6144" \
    pnpm turbo run test --concurrency=2 --force
}
run_gate "vitest"                     run_vitest
run_gate "build-health"               pnpm build:health
run_gate "api-docs-go-live"           pnpm api:docs:verify-go-live
# Build with --concurrency=1 to avoid OOM (3 next apps in parallel = 18GB+).
run_gate "build"                      pnpm turbo run build --concurrency=1
run_gate "no-inline-gate-rpc"         bash scripts/ci/no-inline-gate-rpc.sh
run_gate "invariants-emit"            pnpm --filter @smartout/ai run invariants:emit-coverage
run_gate "invariants-server-actor"    pnpm --filter @smartout/ai run invariants:server-actor
run_gate "invariants-gate-singleton"  pnpm --filter @smartout/ai run invariants:gate-singleton
run_gate "invariants-intent-coverage" pnpm --filter @smartout/ai run invariants:intent-coverage

# === Auxiliary workflows ===
run_gate "migration-lint"             bash .github/scripts/migration-lint.sh
run_gate "eslint-config-test"         pnpm --filter @smartout/eslint-config test
run_gate "mobile-lint"                pnpm --filter @smartout/mobile lint
run_gate "gate-action-coverage"       tsx scripts/gate-action-coverage.ts --baseline
# CI workflow runs `pnpm run X | tee log` which masks exit 1.
# Match CI by warning-not-failing on real failure here.
warn_gate "authority-seed-parity"     pnpm run authority-seed-parity
run_gate "cascade-gate-entity-type"   pnpm run cascade-gate-entity-type-coverage

# === pgTAP suite (loops all *.sql in supabase/tests/pgtap/) ===
echo -e "\n${YELLOW}━━━ pgTAP ━━━${NC}"
PGTAP_FAIL=0
for f in supabase/tests/pgtap/*.sql; do
  echo "── $f"
  npx supabase test db "$f" || PGTAP_FAIL=$((PGTAP_FAIL+1))
done
if [ "$PGTAP_FAIL" -eq 0 ]; then
  echo -e "${GREEN}✓ pgTAP${NC}"
  RESULTS+=("✓ pgTAP")
  PASS=$((PASS+1))
else
  echo -e "${RED}✗ pgTAP (${PGTAP_FAIL} files failed)${NC}"
  RESULTS+=("✗ pgTAP (${PGTAP_FAIL} failed)")
  FAIL=$((FAIL+1))
fi

# === psql ad-hoc test files ===
PSQL_BIN="$(command -v psql || true)"
for slug in gate-action derivation lifecycle-processes lifecycle-capability cascade-gate-write payroll-phase-2-trigger-fires; do
  if [ ! -f "supabase/tests/${slug}.sql" ]; then
    skip_gate "psql-${slug}" "file missing"
  elif [ -z "$PSQL_BIN" ]; then
    skip_gate "psql-${slug}" "psql binary not installed — run: sudo apt install postgresql-client"
  else
    run_gate "psql-${slug}" psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f "supabase/tests/${slug}.sql"
  fi
done

# === RLS WITH-CHECK guard ===
GIT_BASE_REF="${GIT_BASE_REF:-origin/development}"
export GIT_BASE_REF
run_gate "check-rls-with-check" tsx scripts/check-rls-with-check.ts

# === Documented skips ===
skip_gate "edge-functions-deploy" "Supabase Cloud"
skip_gate "migration-deploy"      "Supabase Cloud"
skip_gate "migration-state"       "Supabase Cloud comparison"
skip_gate "ai-eval"               "Anthropic API"
skip_gate "botsson-canary"        "live droplet"
skip_gate "claude-code-review"    "GitHub Actions runtime"
skip_gate "docker-build"          "slow — run on demand"
skip_gate "pipeline-enforcement"  "PR-event-only branch validator"

# === Summary ===
echo -e "\n${YELLOW}━━━ Summary ━━━${NC}"
for line in "${RESULTS[@]}"; do echo "  $line"; done
echo ""
echo -e "  ${GREEN}PASS: ${PASS}${NC}  ${RED}FAIL: ${FAIL}${NC}  ${YELLOW}WARN: ${WARN}${NC}  ${YELLOW}SKIP: ${SKIP}${NC}"

[ "$FAIL" -eq 0 ]
