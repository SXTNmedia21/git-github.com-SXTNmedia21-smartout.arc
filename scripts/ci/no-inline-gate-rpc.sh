#!/usr/bin/env bash
# =============================================================================
# no-inline-gate-rpc.sh — ADR-0204 §3 enforcement
#
# Fails CI if any .ts / .tsx file outside the allowed orchestrator call sites
# contains a direct `supabase.rpc("gate_action", ...)` call (or with `admin`
# or `client` as the receiver). Only the orchestrator and its thin wrappers
# may call gate_action inline; all other code MUST route through them.
#
# Allowlisted call sites (legal to call gate_action directly):
#
#   packages/ai/src/gate/gatedMutation.ts
#     — The composition orchestrator (ADR-0204 §1). This is the ONE true
#       Pathway A entry point. All other callers must compose via this.
#
#   apps/web/src/app/dashboard/_actions/_shared.ts
#     — Canonical web-tier wrapper. The async `gateAction()` export is THE
#       gate_action RPC orchestrator for Server Actions and Route Handlers.
#       Lives in the web app layer; separate from the agent orchestrator
#       because Server Actions cannot import from packages/ai (server-only
#       ESM boundary). All web-tier callers MUST go through this helper.
#
#   packages/ai/src/capabilities/*/gate.ts   (glob — capability wrappers)
#     — Per-capability callGateAction() thunks. All carry the
#       @authority-gate-ungated marker and are awaiting SS-5 migration to
#       the full orchestrator. Each is a controlled, reviewed call site.
#
#   packages/ai/scripts/__tests__/fixtures/**
#     — Test fixtures; not production code.
#
#   **/__tests__/** and **/*.test.ts
#     — Unit and integration test files; allowed to call gate_action for
#       mock/stub setup.
#
# Output format (on violation):
#   <path>:<line>:<col>: direct gate_action RPC outside orchestrator (ADR-0204 §3)
#
# Exit codes:
#   0 — clean (no violations)
#   1 — one or more violations found
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

VIOLATIONS=0

# Pattern: any .rpc() call where the first argument is the string "gate_action".
# Covers: supabase.rpc("gate_action", admin.rpc("gate_action", client.rpc("gate_action"
PATTERN='(supabase|admin|client)\.rpc\(\s*['"'"'"]gate_action['"'"'"]'

# Run the grep; use || true so the script does not abort when grep finds nothing
RAW="$(grep -rn --include='*.ts' --include='*.tsx' -E "$PATTERN" \
  apps packages services 2>/dev/null || true)"

if [[ -z "$RAW" ]]; then
  echo "PASS: no inline gate_action RPC calls found (ADR-0204 §3)"
  exit 0
fi

# Filter out allowlisted paths and comment-only lines
while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  # Extract file path (everything before the first colon)
  filepath="${line%%:*}"

  # Extract the code portion: strip "filepath:lineno:" prefix to get the raw
  # source line, then trim leading whitespace.
  codeline="${line#*:}"       # drop filepath
  codeline="${codeline#*:}"   # drop lineno
  codeline="${codeline#"${codeline%%[![:space:]]*}"}"  # ltrim

  # Skip pure comment lines: // … or /* … or * …  (block comment body)
  if [[ "$codeline" == //* ]] || [[ "$codeline" == "/*"* ]] || [[ "$codeline" == "* "* ]]; then
    continue
  fi

  # --- Allowlist checks ---

  # 1. The composition orchestrator itself
  [[ "$filepath" == "packages/ai/src/gate/gatedMutation.ts" ]] && continue

  # 2. Web-tier gateAction() helper — canonical orchestrator for Server
  #    Actions + Route Handlers. The 3 route handlers MUST call this.
  [[ "$filepath" == "apps/web/src/app/dashboard/_actions/_shared.ts" ]] && continue

  # 3. Per-capability gate.ts thunks (packages/ai/src/capabilities/*/gate.ts)
  #    These carry @authority-gate-ungated and are awaiting SS-5 migration.
  if [[ "$filepath" == packages/ai/src/capabilities/*/gate.ts ]]; then
    continue
  fi

  # 4. Test fixture files and test scripts
  if [[ "$filepath" == *"/__tests__/"* ]] || \
     [[ "$filepath" == *".test.ts" ]] || \
     [[ "$filepath" == *".spec.ts" ]] || \
     [[ "$filepath" == packages/ai/scripts/* ]]; then
    continue
  fi

  # 5. CI script itself (it mentions the pattern in comments/strings)
  [[ "$filepath" == "scripts/ci/no-inline-gate-rpc.sh" ]] && continue

  # --- Violation ---
  echo "${line}: direct gate_action RPC outside orchestrator (ADR-0204 §3)"
  VIOLATIONS=$((VIOLATIONS + 1))

done <<< "$RAW"

if [[ "$VIOLATIONS" -eq 0 ]]; then
  echo "PASS: no inline gate_action RPC calls outside orchestrator (ADR-0204 §3)"
  exit 0
fi

echo ""
echo "FAIL: $VIOLATIONS violation(s). Route gate_action calls through:"
echo "  - gatedMutation() in packages/ai/src/gate/gatedMutation.ts (agent orchestrator)"
echo "  - gateAction() in apps/web/src/app/dashboard/_actions/_shared.ts (web orchestrator)"
echo "  See ADR-0204 §3."
exit 1
