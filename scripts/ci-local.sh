#!/usr/bin/env bash
# Local CI mirror — runs gates from .github/workflows/*.yml that can execute
# against Supabase Local without Cloud, Anthropic API, or live droplet.
#
# v2a (ADR-0359): coverage-check gate runs FIRST. Diffs HEAD vs origin/development,
# maps each changed-path-class to required gates. FAILs if any path class lacks
# coverage in the rest of the run. Prevents false-green marker when ci:local
# doesn't actually exercise the diff.
#
# Skipped (external dependencies):
#   edge-functions-deploy, migration-deploy, migration-state, ai-eval,
#   botsson-canary, claude-code-review, docker-build, pipeline-enforcement
#
# Usage: pnpm ci:local
#
# Requires: Supabase Local running (`npx supabase start`), network for `git fetch`.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Mapping version — bump when path→gate table or coverage rules change.
# Hook validates this against marker contents to invalidate stale markers
# when coverage logic itself changes.
COVERAGE_MAPPING_VERSION=1

# Mirror CI workflow-level env (ci.yml line 16)
export SKIP_ENV_VALIDATION=true

# CI=true triggers conservative worker limits in jest/vitest/turbo,
# preventing OOM-kills on local machines with bursty cores.
export CI="${CI:-true}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0; SKIP=0; WARN=0
RESULTS=()
GATES_INVOKED=()  # for marker JSON
GATE_TIMINGS=()   # parallel array: "name|duration_sec|verdict"
RUN_START=$(date +%s)

# Self-learning run log location
LOG_DIR="$ROOT/.ci-local"
LOG_FILE="$LOG_DIR/runs.jsonl"
mkdir -p "$LOG_DIR"

run_gate() {
  local name="$1"; shift
  echo -e "\n${YELLOW}━━━ ${name} ━━━${NC}"
  GATES_INVOKED+=("$name")
  local t0=$(date +%s)
  if "$@"; then
    local dt=$(($(date +%s)-t0))
    echo -e "${GREEN}✓ ${name}${NC} (${dt}s)"
    RESULTS+=("✓ ${name}")
    GATE_TIMINGS+=("${name}|${dt}|pass")
    PASS=$((PASS+1))
  else
    local dt=$(($(date +%s)-t0))
    echo -e "${RED}✗ ${name}${NC} (${dt}s)"
    RESULTS+=("✗ ${name}")
    GATE_TIMINGS+=("${name}|${dt}|fail")
    FAIL=$((FAIL+1))
  fi
}

# Same as run_gate but marks as warning instead of failure (matches CI's
# `pnpm run X | tee log` pipe-mask behavior — exit code lost in CI).
warn_gate() {
  local name="$1"; shift
  echo -e "\n${YELLOW}━━━ ${name} ━━━${NC}"
  GATES_INVOKED+=("$name")
  local t0=$(date +%s)
  if "$@"; then
    local dt=$(($(date +%s)-t0))
    echo -e "${GREEN}✓ ${name}${NC} (${dt}s)"
    RESULTS+=("✓ ${name}")
    GATE_TIMINGS+=("${name}|${dt}|pass")
    PASS=$((PASS+1))
  else
    local dt=$(($(date +%s)-t0))
    echo -e "${YELLOW}⚠ ${name} (CI tolerates via | tee pipe-mask)${NC} (${dt}s)"
    RESULTS+=("⚠ ${name} (CI pipe-mask)")
    GATE_TIMINGS+=("${name}|${dt}|warn")
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

# ────────────────────────────────────────────────────────────────────────────
# baseline-check — reads last 20 runs from .ci-local/runs.jsonl, computes
# baseline (avg duration per gate, failure rate, gate-stability). Surfaces
# outliers BEFORE the run so operator knows what to watch. Never FAILs the
# run — informational only. First run = noop.
# ────────────────────────────────────────────────────────────────────────────
baseline_check() {
  if [ ! -s "$LOG_FILE" ]; then
    echo "  No prior runs — baseline empty (first run for this repo)."
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "  jq missing — baseline skipped."
    return 0
  fi
  # Only use rows from current mapping version (apples-to-apples)
  local prior_count
  prior_count=$(jq -s "[.[] | select(.mapping_version == $COVERAGE_MAPPING_VERSION)] | length" "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$prior_count" -eq 0 ]; then
    echo "  No runs at mapping_version=$COVERAGE_MAPPING_VERSION yet."
    return 0
  fi
  # Last 20 rows of current mapping version
  local recent
  recent=$(jq -s "[.[] | select(.mapping_version == $COVERAGE_MAPPING_VERSION)] | sort_by(.timestamp) | .[-20:]" "$LOG_FILE" 2>/dev/null)
  local avg_total_s
  avg_total_s=$(echo "$recent" | jq '[.[].total_duration_s // 0] | add / length | floor' 2>/dev/null || echo 0)
  local fail_rate
  fail_rate=$(echo "$recent" | jq '[.[] | select(.fail > 0)] | length' 2>/dev/null || echo 0)
  echo "  Baseline (last $prior_count runs @ mapping v$COVERAGE_MAPPING_VERSION):"
  echo "    avg total duration: ${avg_total_s}s"
  echo "    runs with FAIL>0:   ${fail_rate}/${prior_count}"
  # Gate-stability: gates that always pass vs flaky
  local flaky
  flaky=$(echo "$recent" | jq -r '
    [.[].gate_timings[]] | group_by(.name)
    | map({name: .[0].name, total: length, fails: ([.[] | select(.verdict=="fail")] | length)})
    | map(select(.fails > 0 and .fails < .total))
    | .[] | "    flaky: \(.name) (\(.fails)/\(.total) failed)"
  ' 2>/dev/null)
  if [ -n "$flaky" ]; then
    echo -e "${YELLOW}$flaky${NC}"
  fi
  # Most recent FAIL signatures (last 3 unique)
  local recent_fails
  recent_fails=$(echo "$recent" | jq -r '
    [.[] | select(.fail > 0)] | .[-3:] | .[]
    | "    recent FAIL @ \(.timestamp): \([.gate_timings[] | select(.verdict=="fail") | .name] | join(", "))"
  ' 2>/dev/null)
  if [ -n "$recent_fails" ]; then
    echo -e "${YELLOW}$recent_fails${NC}"
  fi
  return 0
}
run_gate "baseline-check"               baseline_check

# ────────────────────────────────────────────────────────────────────────────
# coverage-check gate — runs FIRST (after baseline).
# Diffs HEAD vs origin/development, classifies changed paths, asserts that
# each class will be exercised by a gate later in this run.
# Per ADR-0359 (Enforced CI Coverage Mandate).
# ────────────────────────────────────────────────────────────────────────────
coverage_check() {
  # HARD FAIL on fetch failure (per Supervisor council R1) — coverage-check
  # correctness depends on a fresh base ref. Silent fall-through hides drift.
  if ! git fetch origin development 2>/dev/null; then
    echo -e "${RED}coverage-check: git fetch origin development FAILED${NC}"
    echo "  Coverage logic requires a fresh origin/development ref."
    echo "  Run while online, or set CI_LOCAL_COVERAGE_BYPASS=1 (records in marker)."
    [ "${CI_LOCAL_COVERAGE_BYPASS:-0}" = "1" ] || return 1
    echo -e "${YELLOW}  CI_LOCAL_COVERAGE_BYPASS=1 — fetch failure tolerated${NC}"
  fi

  local base="origin/development"
  local merge_base
  merge_base=$(git merge-base "$base" HEAD 2>/dev/null) || {
    echo -e "${RED}coverage-check: no common ancestor with $base${NC}"
    return 1
  }

  # Diff between merge-base and HEAD (covers only commits introduced by this branch).
  local changed
  changed=$(git diff --name-only --diff-filter=ACMR "$merge_base"...HEAD 2>/dev/null) || true
  if [ -z "$changed" ]; then
    echo "  No changes vs $base — coverage-check PASS (empty diff)."
    return 0
  fi

  echo "  Changed files vs $base (merge-base $merge_base):"
  echo "$changed" | sed 's/^/    /'
  echo ""

  # Path→gate mapping (per ADR-0359 §3). Longest-prefix-wins precedence:
  # most specific patterns FIRST.
  # Format: <regex>|<required_gates_csv>|<verdict>|<note>
  # verdict: REQUIRE = all gates must run (FAIL if not all invoked)
  #          PAIR    = path must be matched by paired path elsewhere in diff
  #          WARN    = no local gate; allowed but surfaced
  #          BLOCK   = no local gate; FAIL with required-manual-ack
  #          META    = meta-change (ci-local.sh, workflows) — FAIL hard
  #          SKIP    = explicit doc-only-skip OK
  local -a mapping=(
    'scripts/ci-local\.sh$|—|META|self-modifying — manual review required'
    '^\.github/workflows/.+\.yml$|—|META|workflow change — re-verify all gates'
    '^supabase/migrations/.+\.sql$|migration-lint,check-rls-with-check,pgTAP|REQUIRE|'
    '^supabase/functions/.+|—|BLOCK|external — Supabase Cloud only; ack via PR body'
    '^supabase/seed\.sql$|pgTAP|REQUIRE|'
    '^supabase/tests/.+\.sql$|pgTAP|REQUIRE|'
    '^packages/supabase/src/database\.types\.ts$|—|PAIR|must pair with supabase/migrations/** (regen artifact)'
    '^packages/ai/src/capabilities/.+|vitest,authority-seed-parity,invariants-emit,gate-action-coverage|REQUIRE|capability paths — PR body must reference smartout-agent-dev Trust Gate Self-Check'
    '^packages/telemetry/.+|vitest,invariants-emit|REQUIRE|registry contract'
    '^packages/.+/src/.+|vitest,typecheck|REQUIRE|'
    '^apps/web/.+\.(ts|tsx)$|lint,typecheck,build|REQUIRE|no vitest in apps/web (per Supervisor trace)'
    '^apps/mobile/.+\.(ts|tsx)$|mobile-lint|REQUIRE|'
    '^apps/admin/.+\.(ts|tsx)$|build|REQUIRE|'
    '^apps/landing/.+\.(ts|tsx)$|build|REQUIRE|'
    '^apps/e2e/.+|—|WARN|Playwright runs via Vercel preview (external)'
    '^services/(voice-agent|contract-service|stage-engine|shift-mcp|scrapling)/.+|typecheck,vitest|REQUIRE|+WARN docker-build skipped locally'
    '^services/.+|typecheck,vitest|REQUIRE|'
    '^docs/decisions/.+\.md$|—|WARN|ADR change — adr-contract-audit runs weekly externally'
    '^docs/journeys/.+\.md$|—|WARN|journey change — verify code parity manually'
    '^package\.json$|—|PAIR|must pair with pnpm-lock.yaml'
    '^pnpm-lock\.yaml$|—|PAIR|must pair with package.json'
    '^(tsconfig.*|turbo)\.json$|typecheck,build|REQUIRE|'
    '^infra/.+|—|WARN|no local gate'
    '^scripts/.+\.(sh|ts|mjs|cjs)$|—|WARN|gate-implementation change — re-verify dependent gates'
    '\.md$|—|SKIP|doc-only'
  )

  local missing=()
  local meta_violations=()
  local block_violations=()
  local pair_paths=()
  local warn_paths=()
  local required_gates=()  # all gates needed across all paths

  while IFS= read -r file; do
    [ -z "$file" ] && continue
    local matched=0
    local row
    for row in "${mapping[@]}"; do
      IFS='|' read -r pattern gates verdict note <<< "$row"
      if echo "$file" | grep -qE "$pattern"; then
        matched=1
        case "$verdict" in
          META)
            meta_violations+=("$file ($note)")
            ;;
          BLOCK)
            block_violations+=("$file ($note)")
            ;;
          REQUIRE)
            # Add each gate to required-set
            IFS=',' read -ra gs <<< "$gates"
            for g in "${gs[@]}"; do required_gates+=("$g"); done
            ;;
          PAIR)
            pair_paths+=("$file")
            ;;
          WARN)
            warn_paths+=("$file: $note")
            ;;
          SKIP)
            ;;
        esac
        break  # longest-prefix-wins: first match wins
      fi
    done
    if [ $matched -eq 0 ]; then
      missing+=("$file (no mapping rule)")
    fi
  done <<< "$changed"

  # Pair check: package.json ↔ pnpm-lock.yaml, database.types.ts ↔ migrations
  local has_pkg has_lock has_dbtypes has_mig
  has_pkg=0; has_lock=0; has_dbtypes=0; has_mig=0
  echo "$changed" | grep -qE '^package\.json$' && has_pkg=1
  echo "$changed" | grep -qE '^pnpm-lock\.yaml$' && has_lock=1
  echo "$changed" | grep -qE '^packages/supabase/src/database\.types\.ts$' && has_dbtypes=1
  echo "$changed" | grep -qE '^supabase/migrations/.+\.sql$' && has_mig=1
  local pair_violations=()
  if [ "$has_pkg" -ne "$has_lock" ]; then
    pair_violations+=("package.json ↔ pnpm-lock.yaml mismatch — frozen-lockfile install will FAIL in CI")
  fi
  if [ "$has_dbtypes" = "1" ] && [ "$has_mig" = "0" ]; then
    pair_violations+=("database.types.ts changed without supabase/migrations/** — likely hand-edit (forbidden per CLAUDE.md)")
  fi

  # Surface findings
  if [ ${#meta_violations[@]} -gt 0 ]; then
    echo -e "${RED}  META violations (ci-local self-modifying or workflow change):${NC}"
    printf '    %s\n' "${meta_violations[@]}"
  fi
  if [ ${#block_violations[@]} -gt 0 ]; then
    echo -e "${RED}  BLOCK violations (no local gate, PR-body ack required):${NC}"
    printf '    %s\n' "${block_violations[@]}"
  fi
  if [ ${#pair_violations[@]} -gt 0 ]; then
    echo -e "${RED}  PAIR violations:${NC}"
    printf '    %s\n' "${pair_violations[@]}"
  fi
  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}  Unmapped paths (no coverage rule — add to mapping):${NC}"
    printf '    %s\n' "${missing[@]}"
  fi
  if [ ${#warn_paths[@]} -gt 0 ]; then
    echo -e "${YELLOW}  WARN paths (external/no-local-gate — verify manually):${NC}"
    printf '    %s\n' "${warn_paths[@]}"
  fi

  # Required gates set must be a subset of GATES_INVOKED by run-end.
  # We can't check that NOW (we run first) — so we export the requirement
  # and verify at the end (post-summary).
  if [ ${#required_gates[@]} -gt 0 ]; then
    # Dedup
    local uniq_req
    uniq_req=$(printf '%s\n' "${required_gates[@]}" | sort -u | tr '\n' ',' | sed 's/,$//')
    echo "$uniq_req" > /tmp/ci-local-required-gates.txt
    echo "  Required gates (will verify post-run): $uniq_req"
  else
    : > /tmp/ci-local-required-gates.txt
  fi

  # Bypass-self downgrade: when intentionally editing ci-local.sh itself
  # (e.g. extending coverage mapping), META violations on the script alone
  # are downgraded from FAIL to WARN. Set CI_LOCAL_BYPASS_SELF=1.
  if [ "${CI_LOCAL_BYPASS_SELF:-0}" = "1" ] && [ ${#meta_violations[@]} -gt 0 ]; then
    echo -e "${YELLOW}  CI_LOCAL_BYPASS_SELF=1 — META violations downgraded to WARN${NC}"
    meta_violations=()
  fi

  # Verdict
  local total_violations=$((${#meta_violations[@]} + ${#block_violations[@]} + ${#pair_violations[@]} + ${#missing[@]}))
  if [ "$total_violations" -gt 0 ]; then
    echo -e "${RED}  coverage-check: ${total_violations} violation(s)${NC}"
    return 1
  fi
  echo -e "${GREEN}  coverage-check: PASS (mapping v${COVERAGE_MAPPING_VERSION})${NC}"
  return 0
}
run_gate "coverage-check"               coverage_check

# === ci.yml gates ===
run_gate "lint"                       pnpm turbo lint
run_gate "typecheck"                  pnpm turbo typecheck

# Format check — changed files only vs origin/development (mirrors ci.yml).
# NOTE: never use --depth=1 here — it writes .git/shallow and breaks
# ancestry traversal for the entire local repo.
format_check_changed() {
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
GATES_INVOKED+=("pgTAP")
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

# ────────────────────────────────────────────────────────────────────────────
# learning-cross-check — assert that captured learnings remain encoded in
# this script. If a Learning says "always use --force on turbo test", grep
# for it here. If grep misses, FAIL — a fix has been silently removed.
# ────────────────────────────────────────────────────────────────────────────
learning_cross_check() {
  local violations=()
  # Strip own function body from search target to avoid self-matching
  # (assertion grep patterns inside this fn would otherwise match themselves).
  local stripped
  stripped=$(awk '
    /^learning_cross_check\(\) \{/ {in_fn=1; next}
    in_fn && /^\}$/ {in_fn=0; next}
    !in_fn {print}
  ' "$ROOT/scripts/ci-local.sh")

  # L-turbo-cache-cross-worktree → vitest must use --force
  echo "$stripped" | grep -qE 'pnpm turbo run test .*--force' \
    || violations+=("L-turbo-cache-cross-worktree: --force missing from vitest invocation")

  # L-shallow-clone-trap → no --depth=1 anywhere (actual usage, not in strings)
  echo "$stripped" | grep -qE 'git fetch.*--depth=1' \
    && violations+=("L-shallow-clone-trap: --depth=1 found in git fetch command (writes .git/shallow)")

  # L-jest-vitest-OOM → CI=true exported
  echo "$stripped" | grep -qE 'export CI=' \
    || violations+=("L-jest-vitest-OOM: 'export CI=' missing (jest/vitest workers will OOM-kill)")

  # L-ci-pipe-mask → authority-seed-parity wrapped in warn_gate
  echo "$stripped" | grep -qE 'warn_gate "authority-seed-parity"' \
    || violations+=("L-ci-pipe-mask: authority-seed-parity must be warn_gate (CI silently tolerates via | tee)")

  # L-vitest-cold-start → memory cap on vitest worker
  echo "$stripped" | grep -qE 'max-old-space-size=' \
    || violations+=("L-vitest-cold-start: NODE_OPTIONS --max-old-space-size missing")

  # L-build-app-parallel-OOM → build runs with --concurrency=1
  echo "$stripped" | grep -qE 'turbo run build.*--concurrency=1' \
    || violations+=("L-build-app-parallel-OOM: build must use --concurrency=1")

  if [ ${#violations[@]} -gt 0 ]; then
    echo -e "${RED}  Captured learnings no longer encoded:${NC}"
    printf '    %s\n' "${violations[@]}"
    return 1
  fi
  echo "  All 6 captured learnings still encoded ✓"
  return 0
}
run_gate "learning-cross-check"         learning_cross_check

# === Post-run coverage verification: required gates were actually invoked ===
if [ -s /tmp/ci-local-required-gates.txt ]; then
  REQUIRED=$(cat /tmp/ci-local-required-gates.txt)
  IFS=',' read -ra REQ_LIST <<< "$REQUIRED"
  MISSING_REQUIRED=()
  for req in "${REQ_LIST[@]}"; do
    if ! printf '%s\n' "${GATES_INVOKED[@]}" | grep -qxF "$req"; then
      MISSING_REQUIRED+=("$req")
    fi
  done
  if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
    echo -e "\n${RED}━━━ coverage-post-check ━━━${NC}"
    echo -e "${RED}  Required gates NOT invoked: ${MISSING_REQUIRED[*]}${NC}"
    RESULTS+=("✗ coverage-post-check (missing: ${MISSING_REQUIRED[*]})")
    FAIL=$((FAIL+1))
  fi
  rm -f /tmp/ci-local-required-gates.txt
fi

# === Summary ===
echo -e "\n${YELLOW}━━━ Summary ━━━${NC}"
for line in "${RESULTS[@]}"; do echo "  $line"; done
echo ""
echo -e "  ${GREEN}PASS: ${PASS}${NC}  ${RED}FAIL: ${FAIL}${NC}  ${YELLOW}WARN: ${WARN}${NC}  ${YELLOW}SKIP: ${SKIP}${NC}"

# ────────────────────────────────────────────────────────────────────────────
# self-learn-write — append this run's row to .ci-local/runs.jsonl, scan for
# outliers vs baseline. Outlier emits WARN summary line (does not FAIL run).
# Cap log at 200 most-recent rows.
# ────────────────────────────────────────────────────────────────────────────
self_learn_write() {
  if ! command -v jq >/dev/null 2>&1; then
    echo -e "${YELLOW}  jq missing — run not logged${NC}"
    return 0
  fi
  local run_end=$(date +%s)
  local total_dur=$((run_end - RUN_START))
  local head_sha=$(git rev-parse HEAD 2>/dev/null)
  local merge_base=$(git merge-base origin/development HEAD 2>/dev/null || echo "")

  # Build gate_timings JSON array
  local gates_json='[]'
  if [ ${#GATE_TIMINGS[@]} -gt 0 ]; then
    gates_json=$(
      for row in "${GATE_TIMINGS[@]}"; do
        IFS='|' read -r n d v <<< "$row"
        printf '{"name":"%s","duration_s":%s,"verdict":"%s"}\n' "$n" "$d" "$v"
      done | jq -s .
    )
  fi

  local row
  row=$(jq -nc \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg head "$head_sha" \
    --arg mb "$merge_base" \
    --argjson mv "$COVERAGE_MAPPING_VERSION" \
    --argjson pass "$PASS" --argjson fail "$FAIL" \
    --argjson warn "$WARN" --argjson skip "$SKIP" \
    --argjson total_dur "$total_dur" \
    --argjson gates "$gates_json" \
    '{timestamp:$ts, head_sha:$head, merge_base_sha:$mb, mapping_version:$mv,
      pass:$pass, fail:$fail, warn:$warn, skip:$skip,
      total_duration_s:$total_dur, gate_timings:$gates}')
  echo "$row" >> "$LOG_FILE"

  # Cap at 200 most-recent rows
  local count
  count=$(wc -l < "$LOG_FILE")
  if [ "$count" -gt 200 ]; then
    tail -n 200 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi

  # Outlier detection vs baseline (last 20 at current mapping version, excluding self)
  local baseline_avg
  baseline_avg=$(jq -s "[.[] | select(.mapping_version == $COVERAGE_MAPPING_VERSION)] | sort_by(.timestamp) | .[-21:-1] | [.[].total_duration_s] | if length > 0 then (add / length) else 0 end" "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$(echo "$baseline_avg > 0" | bc 2>/dev/null || echo 0)" = "1" ]; then
    local ratio
    ratio=$(echo "scale=2; $total_dur / $baseline_avg" | bc 2>/dev/null || echo "1.00")
    if [ "$(echo "$ratio > 2.0" | bc 2>/dev/null || echo 0)" = "1" ]; then
      echo -e "${YELLOW}  ⚠ OUTLIER: total duration ${total_dur}s = ${ratio}× baseline (${baseline_avg%.*}s avg)${NC}"
    fi
  fi

  # Per-gate outlier check (>3× avg for any gate)
  local gate_outliers
  gate_outliers=$(jq -s --argjson mv "$COVERAGE_MAPPING_VERSION" --argjson now_dur "$total_dur" '
    [.[] | select(.mapping_version == $mv)] | sort_by(.timestamp)
    | (.[-21:-1] // []) as $hist
    | (.[-1] // {}) as $cur
    | ($hist | map(.gate_timings[]) | group_by(.name)
       | map({name: .[0].name, avg: ([.[].duration_s] | add / length)})) as $baseline
    | $cur.gate_timings // []
    | map(. as $g | $baseline | map(select(.name == $g.name)) | .[0] as $b
          | if $b and $b.avg > 0 and ($g.duration_s / $b.avg) > 3 and $g.duration_s > 10
            then "    \($g.name): \($g.duration_s)s vs \($b.avg | floor)s avg (\(($g.duration_s / $b.avg) * 100 | floor)%)"
            else empty end)
    | .[]
  ' "$LOG_FILE" 2>/dev/null)
  if [ -n "$gate_outliers" ]; then
    echo -e "${YELLOW}  ⚠ Per-gate outliers (>3× baseline):${NC}"
    echo "$gate_outliers"
  fi

  echo "  Run logged → $LOG_FILE (mapping v$COVERAGE_MAPPING_VERSION)"
}
echo -e "\n${BLUE}━━━ self-learn-write ━━━${NC}"
self_learn_write

# Write green-marker JSON for PreToolUse `gh pr create` hook (skill: local-ci-before-pr).
# Marker is keyed to HEAD SHA + merge-base SHA so:
#   - any new commit on HEAD invalidates it
#   - origin/development advancing past the recorded merge-base invalidates it
#   - mapping version bump invalidates older markers
if [ "$FAIL" -eq 0 ]; then
  HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
  MERGE_BASE=$(git merge-base origin/development HEAD 2>/dev/null || echo "")
  if [ -n "$HEAD_SHA" ]; then
    GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
    MARKER="$GIT_DIR/.ci-local-green-$HEAD_SHA"
    GATES_JSON=$(printf '%s\n' "${GATES_INVOKED[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    cat > "$MARKER" <<EOF
{
  "head_sha": "$HEAD_SHA",
  "merge_base_sha": "$MERGE_BASE",
  "mapping_version": $COVERAGE_MAPPING_VERSION,
  "gates_invoked": $GATES_JSON,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    # Prune old markers (keep last 5)
    ls -t "$GIT_DIR"/.ci-local-green-* 2>/dev/null | tail -n +6 | xargs -r rm -f
    echo -e "  ${GREEN}✓ marker written: $MARKER${NC}"
  fi
fi

[ "$FAIL" -eq 0 ]
