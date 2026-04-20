#!/usr/bin/env bash
# UserPromptSubmit hook — scans the user's prompt for Smartout-domain keywords
# and injects a reminder that Claude MUST load the matching skill before
# writing code or giving architectural recommendations.
#
# Output on stdout is appended to the prompt as additional context.
# Exit 0 always — never block the prompt.

set -uo pipefail

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // empty' 2>/dev/null)

[[ -z "$prompt" ]] && exit 0

# Normalise: lowercase. Keep two views:
#   $p         — preserves underscores (needed for table names like schedule_shift)
#   $p_tokens  — underscores → spaces so \b works on env-var tokens like STRIPE_API_KEY
p=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')
p_tokens=$(echo "$p" | tr '_' ' ')

declare -a reminders=()

match() {
  # $1 = skill name, $2 = extended regex, $3 = optional "tokens" to use $p_tokens instead of $p
  local haystack="$p"
  [[ "${3:-}" == "tokens" ]] && haystack="$p_tokens"
  if echo "$haystack" | grep -qE "$2"; then
    reminders+=("$1")
  fi
}

# ── Nordic Split — design/UI/styling ──
match "smartout-nordic-split" \
  '\b(tailwind|shadcn|oklch|orb|glassmorphism|geist|instrument serif|dashboardshell|globals\.css|design-tokens|framer-motion|spring physics|css variable|bg-background|text-foreground|border-border|zinc-|slate-|gray-|neutral-|stone-|dark mode|light mode|mørk modus|lys modus|farge|farger|komponent|design|tema|knapp|layout|style|stil|utseende|animasjon|animation)\b'

# ── Database — SQL/schema/migrations ──
match "smartout-database-guide" \
  '\b(supabase|postgres|sql|migration|migrasjon|skjema|schema|tabell|table|kolonne|column|enum|rls|row-level|row level|workspace_id|auth\.uid|service role|anon key|pgvector|btree_gist|database\.types|seed\.sql|user_identity|employment_contract|schedule_shift|schedule_absence|engine_process|engine_state|engine_authority|activity_trail|workspace_doc_chunk)\b'

# ── Cascade — scheduling/season/year-wheel/framework ──
# Note: grep -E treats underscore as a word char, so \b(shift)\b does NOT match "schedule_shift".
# We list compound table names as separate alternatives without \b wrapping.
match "smartout-cascade-developer" \
  '(\b(cascade|sesong|season|vakt|year[- ]?wheel|årshjul|vaktplan|framework|tariff|riksavtalen|overenskomst|day_factor|hour_factor|planning_cycle|planning_event|deviation|trainee|readiness|bootstrap|framework_rule|tariff_rate_table|regulatory_framework|public_holiday|d1|d2|d3|d4|d5|d6|c1|c2|c3|c4|k1a|k1b)\b|schedule_shift|schedule_absence|department_session|session_hook|session_task|department_operating_hours|department_hours_override|season_budget|workspace_budget|shift_cost_snapshot|daily_reconciliation|workspace_kpi_target|change_proposal|engine_authority_config|\bshift\b)'

# ── Edge Functions — API gateway ──
match "smartout-edge-function-guide" \
  '\b(edge function|edge-function|supabase/functions|workspace-api|scope guard|dual-auth|api endpoint|api gateway)\b'

# ── Secrets ──
# Uses tokens view so env-var names like STRIPE_API_KEY, SUPABASE_SERVICE_ROLE_KEY match.
# .env is matched separately because the leading dot is non-word and breaks \b anchoring.
match "secrets-protocol" \
  '(\b(secret|password|api[. -]?key|api[. -]?token|access[. -]?token|bearer[. -]?token|refresh[. -]?token|credential|1password|vault|jwt|service[. -]?role|anon[. -]?key|publishable[. -]?key|signing[. -]?secret|webhook[. -]?secret)\b|\.env($|[^a-z0-9])|op://)' \
  "tokens"

# ── Linear ──
match "linear-protocol" \
  '\b(linear|sma-[0-9]+|issue|ticket|\/stack)\b'

# ── Nothing matched ──
if [ ${#reminders[@]} -eq 0 ]; then
  exit 0
fi

# ── Emit reminder ──
echo ""
echo "🔔 **Smartout domain triggers detected in the prompt.**"
echo ""
echo "Before writing code or giving architectural recommendations, you MUST invoke the Skill tool for each of these:"
echo ""
for s in "${reminders[@]}"; do
  echo "  • \`$s\`"
done
echo ""
echo "These skills contain the authoritative rules, table names, file paths, and traps for the affected domain. Load them first — do not rely on general knowledge."

exit 0
