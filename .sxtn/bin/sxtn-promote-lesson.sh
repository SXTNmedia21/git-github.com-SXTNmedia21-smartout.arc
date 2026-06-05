#!/usr/bin/env bash
# sxtn-promote-lesson.sh — F6 cross-LESSONS pattern detection + PR draft (SPEC § 12)
#                          + F4 hard-class gate promotion (close-feature Step 5.5)
#
# TWO MODES (auto-detected by first argument):
#
# MODE A — F6 cross-sortie pattern promotion (new in F6):
#   Usage: sxtn-promote-lesson.sh <project_root> <pattern_signal> [--create]
#   Scans docs/domains/**/reports/LESSONS-*.md for pattern_signal.
#   If 3+ occurrences: renders PR body from templates/PROMOTE-PR.md.tmpl.
#   Default is dry-run (PR body to stdout). --create invokes gh pr create (draft).
#   NEVER auto-merges. Per SPEC § 12.
#   Exit: 0 success (pattern_found or no_pattern), 1 dep missing, 3 usage
#
# MODE B — F4 hard-class gate promotion (original, SPEC § 5.4):
#   Usage: sxtn-promote-lesson.sh --feature <path> [--project <root>] [--threshold N]
#          sxtn-promote-lesson.sh --scan-all --project <root> [--threshold N]
#          sxtn-promote-lesson.sh --lessons-file <path> --project <root>
#   Reads LESSONS reports for hard-class failure codes → promoted-gates.json.
#   Reference: SPEC § 5.4, § 21 F_INTERACTIVE_CONTRACT_UNVERIFIED, § 22 DoD.
#
# Output (stdout): JSON ExecutionResult-style summary
# Exit: 0 ok (with or without promotions), 2 invalid input, 3 usage error

set -uo pipefail

PLUGIN_DIR="${PLUGIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Mode detection: if first arg doesn't start with '--', use MODE A ─────────
if [[ $# -ge 1 && "${1:-}" != --* ]]; then
# ════════════════════════════════════════════════════════════════════════════════
# MODE A — F6 cross-sortie pattern promotion (SPEC § 12)
# ════════════════════════════════════════════════════════════════════════════════

  if [[ $# -lt 2 ]]; then
    echo '{"status":"error","error":"usage","message":"MODE A: sxtn-promote-lesson.sh <project_root> <pattern_signal> [--create]"}' >&2
    exit 3
  fi

  A_PROJECT_ROOT="$1"
  A_PATTERN_SIGNAL="$2"
  A_CREATE_FLAG=false

  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --create) A_CREATE_FLAG=true ;;
      *) echo "{\"status\":\"error\",\"error\":\"unknown_flag\",\"flag\":\"$1\"}" >&2; exit 3 ;;
    esac
    shift
  done

  if [[ ! -d "$A_PROJECT_ROOT" ]]; then
    echo "{\"status\":\"error\",\"error\":\"project_root_missing\",\"path\":\"$A_PROJECT_ROOT\"}" >&2
    exit 3
  fi

  # Collect all LESSONS-*.md files
  A_ALL_FILES=()
  A_MATCHING_FILES=()
  A_SORTIE_SLUGS=()
  A_FIRST_SEEN=""
  A_LATEST_SEEN=""

  if [[ -d "$A_PROJECT_ROOT/docs/domains" ]]; then
    while IFS= read -r -d '' f; do
      A_ALL_FILES+=("$f")
    done < <(find "$A_PROJECT_ROOT/docs/domains" -name "LESSONS-*.md" -print0 2>/dev/null || true)
  fi
  if [[ -d "$A_PROJECT_ROOT/docs/reports" ]]; then
    while IFS= read -r -d '' f; do
      A_ALL_FILES+=("$f")
    done < <(find "$A_PROJECT_ROOT/docs/reports" -name "LESSONS-*.md" -print0 2>/dev/null || true)
  fi

  for f in "${A_ALL_FILES[@]:-}"; do
    [[ -z "$f" ]] && continue
    if grep -qi "$A_PATTERN_SIGNAL" "$f" 2>/dev/null; then
      A_MATCHING_FILES+=("$f")
      A_SORTIE_SLUGS+=("$(basename "$f" .md)")
      FILE_DATE=$(grep -m1 'created:' "$f" 2>/dev/null | awk '{print $2}' || true)
      [[ -z "$FILE_DATE" ]] && FILE_DATE=$(stat -c '%y' "$f" 2>/dev/null | cut -d' ' -f1 || date +%Y-%m-%d)
      [[ -z "$A_FIRST_SEEN" || "$FILE_DATE" < "$A_FIRST_SEEN" ]] && A_FIRST_SEEN="$FILE_DATE"
      [[ -z "$A_LATEST_SEEN" || "$FILE_DATE" > "$A_LATEST_SEEN" ]] && A_LATEST_SEEN="$FILE_DATE"
    fi
  done

  A_COUNT="${#A_MATCHING_FILES[@]}"
  A_THRESHOLD=3

  if [[ $A_COUNT -lt $A_THRESHOLD ]]; then
    echo "{\"status\":\"no_pattern\",\"count\":$A_COUNT,\"threshold\":$A_THRESHOLD,\"pattern_signal\":\"$A_PATTERN_SIGNAL\",\"message\":\"Threshold $A_THRESHOLD not met\"}"
    exit 0
  fi

  # Render PR body
  A_TEMPLATE="$PLUGIN_ROOT/templates/PROMOTE-PR.md.tmpl"
  if [[ ! -f "$A_TEMPLATE" ]]; then
    echo "{\"status\":\"error\",\"error\":\"F_TEMPLATE_MISSING\",\"path\":\"$A_TEMPLATE\"}" >&2
    exit 1
  fi

  A_FILES_LIST=$(printf '%s\n' "${A_MATCHING_FILES[@]}" | sed "s|$A_PROJECT_ROOT/||g" | paste -sd ', ' - 2>/dev/null || printf '%s, ' "${A_MATCHING_FILES[@]}")
  A_SLUGS_LIST=$(IFS=' '; echo "${A_SORTIE_SLUGS[*]:-}")
  A_TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
  A_PR_BODY_PATH="$A_PROJECT_ROOT/.sxtn/promote-${A_PATTERN_SIGNAL}-${A_TIMESTAMP}.md"
  mkdir -p "$A_PROJECT_ROOT/.sxtn"

  A_PATTERN_DESC="Recurring anomaly '${A_PATTERN_SIGNAL}' observed ${A_COUNT} times across sorties: ${A_SLUGS_LIST}"

  # Use python3 for template substitution (handles multiline values and special chars safely)
  # Falls back to simple awk if python3 unavailable
  if command -v python3 >/dev/null 2>&1; then
    # Write python script to temp file to avoid heredoc shell expansion
    A_PY_SCRIPT=$(mktemp /tmp/sxtn-promote-XXXXXX.py)
    cat > "$A_PY_SCRIPT" << 'PYEOF'
import sys
template_path = sys.argv[1]
output_path = sys.argv[2]
vals = dict(
    PATTERN_SIGNAL=sys.argv[3],
    OCCURRENCE_COUNT=sys.argv[4],
    LESSONS_FILE_PATHS=sys.argv[5],
    FIRST_OCCURRENCE=sys.argv[6],
    LATEST_OCCURRENCE=sys.argv[7],
    PATTERN_DESCRIPTION=sys.argv[8],
    FIRST_SEEN=sys.argv[6],
    LATEST_SEEN=sys.argv[7],
    SLUGS=sys.argv[9],
    COUNT=sys.argv[4],
)
with open(template_path) as f:
    body = f.read()
body = body.replace('{{PATTERN_SIGNAL}}', vals['PATTERN_SIGNAL'])
body = body.replace('{{OCCURRENCE_COUNT}}', vals['OCCURRENCE_COUNT'])
body = body.replace('{{LESSONS_FILE_PATHS}}', vals['LESSONS_FILE_PATHS'])
body = body.replace('{{FIRST_OCCURRENCE}}', vals['FIRST_OCCURRENCE'])
body = body.replace('{{LATEST_OCCURRENCE}}', vals['LATEST_OCCURRENCE'])
body = body.replace('{{PATTERN_DESCRIPTION}}', vals['PATTERN_DESCRIPTION'])
changelog = (
    "### Pattern: " + vals['PATTERN_SIGNAL'] + "\n"
    "- Promoted from " + vals['COUNT'] + " occurrence(s)\n"
    "- First seen: " + vals['FIRST_SEEN'] + " | Latest: " + vals['LATEST_SEEN'] + "\n"
    "- Sorties: " + vals['SLUGS']
)
body = body.replace('{{PROPOSED_CHANGELOG_ENTRY}}', changelog)
body = body.replace('{{AGENT_BODY_DIFF}}', '<!-- Identify which skill/agent body needs updating and paste proposed diff here. -->')
body = body.replace('{{SPEC_AMENDMENT}}', '<!-- Identify which SPEC section maps to this pattern and paste proposed diff. -->')
body = body.replace('{{RISKS_AND_MITIGATIONS}}', '<!-- List risks of the proposed plugin change. -->')
with open(output_path, 'w') as f:
    f.write(body)
PYEOF
    python3 "$A_PY_SCRIPT" \
      "$A_TEMPLATE" "$A_PR_BODY_PATH" \
      "${A_PATTERN_SIGNAL}" "${A_COUNT}" "${A_FILES_LIST}" \
      "${A_FIRST_SEEN:-unknown}" "${A_LATEST_SEEN:-unknown}" \
      "${A_PATTERN_DESC}" "${A_SLUGS_LIST}"
    rm -f "$A_PY_SCRIPT"
  else
    # Minimal awk fallback (no multiline support — single-line substitutions only)
    awk \
      -v ps="${A_PATTERN_SIGNAL}" \
      -v oc="${A_COUNT}" \
      -v fl="${A_FILES_LIST}" \
      -v fo="${A_FIRST_SEEN:-unknown}" \
      -v lo="${A_LATEST_SEEN:-unknown}" \
      -v pd="${A_PATTERN_DESC}" \
      '{
        gsub(/\{\{PATTERN_SIGNAL\}\}/, ps)
        gsub(/\{\{OCCURRENCE_COUNT\}\}/, oc)
        gsub(/\{\{LESSONS_FILE_PATHS\}\}/, fl)
        gsub(/\{\{FIRST_OCCURRENCE\}\}/, fo)
        gsub(/\{\{LATEST_OCCURRENCE\}\}/, lo)
        gsub(/\{\{PATTERN_DESCRIPTION\}\}/, pd)
        gsub(/\{\{PROPOSED_CHANGELOG_ENTRY\}\}/, "<!-- see sxtn-promote-lesson output -->")
        gsub(/\{\{AGENT_BODY_DIFF\}\}/, "<!-- paste proposed skill/agent diff here -->")
        gsub(/\{\{SPEC_AMENDMENT\}\}/, "<!-- paste proposed SPEC diff here -->")
        gsub(/\{\{RISKS_AND_MITIGATIONS\}\}/, "<!-- list risks here -->")
        print
      }' "$A_TEMPLATE" > "$A_PR_BODY_PATH"
  fi

  # Print to stdout (dry-run default)
  cat "$A_PR_BODY_PATH"
  echo ""

  A_PR_URL=""
  if [[ "$A_CREATE_FLAG" == "true" ]]; then
    if ! command -v gh >/dev/null 2>&1; then
      echo "{\"status\":\"error\",\"error\":\"F_GH_MISSING\",\"message\":\"gh CLI not found\"}" >&2
      exit 1
    fi
    if ! git -C "$PLUGIN_ROOT" remote -v 2>/dev/null | grep -q 'origin'; then
      echo "{\"status\":\"error\",\"error\":\"F_NO_REMOTE\",\"message\":\"Plugin repo has no origin remote\"}" >&2
      exit 1
    fi
    A_PR_URL=$(gh pr create \
      --repo "SXTNmedia21/sxtn-plugin" \
      --title "self-improve: promote pattern ${A_PATTERN_SIGNAL}" \
      --body "$(cat "$A_PR_BODY_PATH")" \
      --draft 2>&1 | tail -1 || true)
  fi

  A_FILES_JSON=$(printf '"%s"\n' "${A_MATCHING_FILES[@]:-}" | paste -sd ',' - 2>/dev/null | sed 's/^/[/; s/$/]/' || echo '[]')
  echo "{\"status\":\"pattern_found\",\"count\":${A_COUNT},\"threshold\":${A_THRESHOLD},\"pattern_signal\":\"${A_PATTERN_SIGNAL}\",\"lessons_files\":${A_FILES_JSON},\"pr_body_path\":\"${A_PR_BODY_PATH}\",\"pr_url\":$([ -n "$A_PR_URL" ] && echo "\"$A_PR_URL\"" || echo 'null')}"
  exit 0
fi

# ════════════════════════════════════════════════════════════════════════════════
# MODE C — revision-driven promotion (bridges run-council generic-improvement verdict)
#   Usage: sxtn-promote-lesson.sh --from-revision <skill> <pattern_signal> \
#            [--project <root>] [--create]
#   Reads .sxtn/skills/<skill>/revision-brief.md (from sxtn-revise) + timeline.jsonl,
#   renders PROMOTE-PR.md.tmpl, drafts a PR against plugin main. NEVER auto-merges.
#   Closes the gap: a council "generic-improvement" verdict (revision threshold 2)
#   could not reach MODE A (LESSONS-*.md, threshold 3). MODE C bridges them.
#   Exit: 0 success, 1 dep/template missing, 3 usage/brief-missing.
# ════════════════════════════════════════════════════════════════════════════════
if [[ "${1:-}" == "--from-revision" ]]; then
  shift
  C_SKILL="${1:-}"
  C_PATTERN_SIGNAL="${2:-}"
  C_PROJECT_ROOT="$(pwd)"
  C_CREATE_FLAG=false
  if [[ -z "$C_SKILL" || -z "$C_PATTERN_SIGNAL" || "$C_SKILL" == --* || "$C_PATTERN_SIGNAL" == --* ]]; then
    echo '{"status":"error","error":"usage","message":"MODE C: sxtn-promote-lesson.sh --from-revision <skill> <pattern_signal> [--project <root>] [--create]"}' >&2
    exit 3
  fi
  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project) C_PROJECT_ROOT="${2:-}"; shift 2 ;;
      --create)  C_CREATE_FLAG=true; shift ;;
      *) echo "{\"status\":\"error\",\"error\":\"unknown_flag\",\"flag\":\"$1\"}" >&2; exit 3 ;;
    esac
  done

  C_SKILL_DIR="$C_PROJECT_ROOT/.sxtn/skills/$C_SKILL"
  C_BRIEF="$C_SKILL_DIR/revision-brief.md"
  C_TIMELINE="$C_SKILL_DIR/timeline.jsonl"
  if [[ ! -f "$C_BRIEF" ]]; then
    echo "{\"status\":\"error\",\"error\":\"F_REVISION_BRIEF_MISSING\",\"path\":\"$C_BRIEF\",\"message\":\"Run sxtn-revise first (due=true writes the brief)\"}" >&2
    exit 3
  fi

  C_TEMPLATE="$PLUGIN_ROOT/templates/PROMOTE-PR.md.tmpl"
  if [[ ! -f "$C_TEMPLATE" ]]; then
    echo "{\"status\":\"error\",\"error\":\"F_TEMPLATE_MISSING\",\"path\":\"$C_TEMPLATE\"}" >&2
    exit 1
  fi

  # Derive values from the brief frontmatter + timeline
  C_TRIGGER=$(grep -m1 '^revision_trigger:' "$C_BRIEF" 2>/dev/null | sed 's/^revision_trigger:[[:space:]]*//; s/^"//; s/"$//' || true)
  C_GENERATED=$(grep -m1 '^generated_at:' "$C_BRIEF" 2>/dev/null | awk '{print $2}' || true)
  C_FIRST=$(grep -m1 '"ts":"' "$C_TIMELINE" 2>/dev/null | sed -E 's/.*"ts":"([^"]+)".*/\1/' || true)
  C_LATEST=$(grep '"ts":"' "$C_TIMELINE" 2>/dev/null | tail -1 | sed -E 's/.*"ts":"([^"]+)".*/\1/' || true)
  C_FAIL_COUNT=$(grep -c '"outcome":"fail"\|"outcome":"blocked"' "$C_TIMELINE" 2>/dev/null || echo 0)
  C_FILES_LIST=".sxtn/skills/$C_SKILL/revision-brief.md, .sxtn/skills/$C_SKILL/timeline.jsonl"
  C_PATTERN_DESC="run-council Revision verdict generic-improvement for skill '${C_SKILL}'. Trigger: ${C_TRIGGER:-recurring failure}. Promote the generic fix to plugin main."

  C_TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
  C_PR_BODY_PATH="$C_PROJECT_ROOT/.sxtn/promote-${C_PATTERN_SIGNAL}-${C_TIMESTAMP}.md"
  mkdir -p "$C_PROJECT_ROOT/.sxtn"

  if command -v python3 >/dev/null 2>&1; then
    C_PY=$(mktemp /tmp/sxtn-promote-c-XXXXXX.py)
    cat > "$C_PY" << 'PYEOF'
import sys
template_path, output_path = sys.argv[1], sys.argv[2]
ps, count, files, first, latest, desc, skill, trigger = sys.argv[3:11]
with open(template_path) as f:
    body = f.read()
body = body.replace('{{PATTERN_SIGNAL}}', ps)
body = body.replace('{{OCCURRENCE_COUNT}}', count)
body = body.replace('{{LESSONS_FILE_PATHS}}', files)
body = body.replace('{{FIRST_OCCURRENCE}}', first)
body = body.replace('{{LATEST_OCCURRENCE}}', latest)
body = body.replace('{{PATTERN_DESCRIPTION}}', desc)
changelog = ("### Pattern: " + ps + "\n- Promoted from run-council Revision (generic-improvement) for skill " + skill +
             "\n- Trigger: " + trigger + "\n- Evidence: " + count + " fail/blocked timeline entries (" + first + " .. " + latest + ")")
body = body.replace('{{PROPOSED_CHANGELOG_ENTRY}}', changelog)
body = body.replace('{{AGENT_BODY_DIFF}}', '<!-- Paste the proposed generic fix to skills/**/' + skill + ' or its bin. The council verdict was generic-improvement: the fix belongs in the plugin, not project learnings.md. -->')
body = body.replace('{{SPEC_AMENDMENT}}', '<!-- Identify the SPEC section the pattern maps to and paste a proposed diff, if any. -->')
body = body.replace('{{RISKS_AND_MITIGATIONS}}', '<!-- Risks of the generic plugin change + how a re-run of the project sortie validates it. -->')
with open(output_path, 'w') as f:
    f.write(body)
PYEOF
    python3 "$C_PY" "$C_TEMPLATE" "$C_PR_BODY_PATH" \
      "$C_PATTERN_SIGNAL" "${C_FAIL_COUNT:-0}" "$C_FILES_LIST" \
      "${C_FIRST:-unknown}" "${C_LATEST:-unknown}" "$C_PATTERN_DESC" \
      "$C_SKILL" "${C_TRIGGER:-recurring failure}"
    rm -f "$C_PY"
  else
    sed -e "s|{{PATTERN_SIGNAL}}|$C_PATTERN_SIGNAL|g" \
        -e "s|{{OCCURRENCE_COUNT}}|${C_FAIL_COUNT:-0}|g" \
        -e "s|{{LESSONS_FILE_PATHS}}|$C_FILES_LIST|g" \
        -e "s|{{FIRST_OCCURRENCE}}|${C_FIRST:-unknown}|g" \
        -e "s|{{LATEST_OCCURRENCE}}|${C_LATEST:-unknown}|g" \
        -e "s|{{PATTERN_DESCRIPTION}}|$C_PATTERN_DESC|g" \
        -e "s|{{PROPOSED_CHANGELOG_ENTRY}}|<!-- generic-improvement for $C_SKILL -->|g" \
        -e "s|{{AGENT_BODY_DIFF}}|<!-- paste generic fix for $C_SKILL -->|g" \
        -e "s|{{SPEC_AMENDMENT}}|<!-- paste SPEC diff -->|g" \
        -e "s|{{RISKS_AND_MITIGATIONS}}|<!-- list risks -->|g" \
        "$C_TEMPLATE" > "$C_PR_BODY_PATH"
  fi

  cat "$C_PR_BODY_PATH"
  echo ""

  C_PR_URL=""
  if [[ "$C_CREATE_FLAG" == "true" ]]; then
    if ! command -v gh >/dev/null 2>&1; then
      echo "{\"status\":\"error\",\"error\":\"F_GH_MISSING\",\"message\":\"gh CLI not found\"}" >&2
      exit 1
    fi
    C_PR_URL=$(gh pr create \
      --repo "SXTNmedia21/sxtn-plugin" \
      --title "self-improve: promote pattern ${C_PATTERN_SIGNAL} (revision: ${C_SKILL})" \
      --body "$(cat "$C_PR_BODY_PATH")" \
      --draft 2>&1 | tail -1 || true)
  fi

  echo "{\"status\":\"pattern_found\",\"mode\":\"C\",\"source\":\"revision\",\"skill\":\"${C_SKILL}\",\"pattern_signal\":\"${C_PATTERN_SIGNAL}\",\"fail_entries\":${C_FAIL_COUNT:-0},\"brief\":\"${C_BRIEF}\",\"pr_body_path\":\"${C_PR_BODY_PATH}\",\"pr_url\":$([ -n "$C_PR_URL" ] && echo "\"$C_PR_URL\"" || echo 'null')}"
  exit 0
fi

# ════════════════════════════════════════════════════════════════════════════════
# MODE B — F4 hard-class gate promotion (original interface)
# ════════════════════════════════════════════════════════════════════════════════

FEATURE_PATH=""
PROJECT_ROOT=""
LESSONS_FILE=""
SCAN_ALL=false
THRESHOLD="${SXTN_PROMOTE_THRESHOLD:-1}"

# ── Code → gate mapping ──────────────────────────────────────────────────────
# Each "hard class" failure code maps to the DoD gate that must thereafter be
# satisfied. The gate name MUST match a check name enforced by sxtn-dod-check.sh.
#
#   F_INTERACTIVE_CONTRACT_UNVERIFIED -> interactive_contract  (F-1/F-2/F-3/F-4 class)
#   F_USABILITY_FAIL                  -> interactive_contract  (§ 28 Phase B usability)
#   F_TELEMETRY_MISSING               -> interactive_contract  (phantom emit — effect-not-wired sibling)
#
# All three are the same root: "wired/registered but effect/failure-path unverified".
map_code_to_gate() {
    case "$1" in
        F_INTERACTIVE_CONTRACT_UNVERIFIED) echo "interactive_contract" ;;
        F_USABILITY_FAIL)                  echo "interactive_contract" ;;
        F_TELEMETRY_MISSING)               echo "interactive_contract" ;;
        *) echo "" ;;
    esac
}

HARD_CLASS_CODES="F_INTERACTIVE_CONTRACT_UNVERIFIED F_USABILITY_FAIL F_TELEMETRY_MISSING"

# ── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --feature)       shift; FEATURE_PATH="${1:-}"; shift ;;
        --project)       shift; PROJECT_ROOT="${1:-}"; shift ;;
        --lessons-file)  shift; LESSONS_FILE="${1:-}"; shift ;;
        --scan-all)      SCAN_ALL=true; shift ;;
        --threshold)     shift; THRESHOLD="${1:-1}"; shift ;;
        --help|-h)
            grep '^#' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) echo "Unknown arg: $1" >&2; exit 3 ;;
    esac
done

if [[ -z "$FEATURE_PATH" && -z "$LESSONS_FILE" && "$SCAN_ALL" != "true" ]]; then
    echo '{"status":"failed","errors":[{"code":"F_USAGE","message":"need --feature, --lessons-file, or --scan-all"}]}' >&2
    exit 3
fi

# Resolve project root: explicit, or walk up from feature for .sxtn/config.yaml
if [[ -z "$PROJECT_ROOT" ]]; then
    SEED="${FEATURE_PATH:-$(dirname "${LESSONS_FILE:-$PWD}")}"
    PR="$SEED"
    while [[ "$PR" != "/" && "$PR" != "." ]] && [[ ! -d "$PR/.sxtn" ]]; do
        PR="$(dirname "$PR")"
    done
    if [[ -d "$PR/.sxtn" ]]; then
        PROJECT_ROOT="$PR"
    fi
fi

if [[ -z "$PROJECT_ROOT" ]]; then
    echo '{"status":"failed","errors":[{"code":"F_CONFIG_MISSING","message":"could not resolve project root (.sxtn dir not found); pass --project"}]}' >&2
    exit 2
fi

REGISTRY_DIR="$PROJECT_ROOT/.sxtn"
REGISTRY="$REGISTRY_DIR/promoted-gates.json"

# ── Collect LESSONS files to scan ────────────────────────────────────────────
LESSONS_TO_SCAN=()
if [[ -n "$LESSONS_FILE" ]]; then
    [[ -f "$LESSONS_FILE" ]] && LESSONS_TO_SCAN+=("$LESSONS_FILE")
elif [[ -n "$FEATURE_PATH" ]]; then
    while IFS= read -r f; do LESSONS_TO_SCAN+=("$f"); done \
        < <(find "$FEATURE_PATH/reports" -name "LESSONS-*.md" 2>/dev/null)
elif [[ "$SCAN_ALL" == "true" ]]; then
    while IFS= read -r f; do LESSONS_TO_SCAN+=("$f"); done \
        < <(find "$PROJECT_ROOT" -path '*/reports/LESSONS-*.md' 2>/dev/null)
fi

# ── Tally hard-class occurrences across scanned LESSONS ──────────────────────
# Each scanned file contributes at most 1 occurrence per code (a code present
# in a file = that sortie hit the class once for promotion-counting purposes).
declare -A CODE_HITS=()
declare -A CODE_SOURCE=()

for lf in "${LESSONS_TO_SCAN[@]:-}"; do
    [[ -z "$lf" || ! -f "$lf" ]] && continue
    for code in $HARD_CLASS_CODES; do
        if grep -q "$code" "$lf" 2>/dev/null; then
            CODE_HITS["$code"]=$(( ${CODE_HITS["$code"]:-0} + 1 ))
            [[ -z "${CODE_SOURCE["$code"]:-}" ]] && CODE_SOURCE["$code"]="$(basename "$lf")"
        fi
    done
done

# ── Read existing registry (array of gate objects) ──────────────────────────
mkdir -p "$REGISTRY_DIR"
if [[ ! -f "$REGISTRY" ]]; then
    echo '[]' > "$REGISTRY"
fi

if ! command -v jq >/dev/null 2>&1; then
    echo '{"status":"failed","errors":[{"code":"F_TOOL_UNAVAILABLE","message":"jq required for sxtn-promote-lesson"}]}' >&2
    exit 2
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PROMOTED=()
SKIPPED=()

for code in "${!CODE_HITS[@]}"; do
    gate="$(map_code_to_gate "$code")"
    [[ -z "$gate" ]] && continue
    hits="${CODE_HITS[$code]}"

    # Already enforced? bump occurrences, never duplicate.
    EXISTS=$(jq --arg g "$gate" 'map(select(.gate==$g and .status=="enforced")) | length' "$REGISTRY")
    if [[ "$EXISTS" -gt 0 ]]; then
        TMP=$(mktemp)
        jq --arg g "$gate" --argjson add "$hits" --arg now "$NOW" \
           'map(if .gate==$g and .status=="enforced"
                then .occurrences = (.occurrences + $add) | .last_seen = $now
                else . end)' "$REGISTRY" > "$TMP" && mv "$TMP" "$REGISTRY"
        SKIPPED+=("$gate (already enforced; +$hits occ)")
        continue
    fi

    # Threshold gate: promote when hits >= THRESHOLD (default 1 = hard-class fast path)
    if [[ "$hits" -lt "$THRESHOLD" ]]; then
        SKIPPED+=("$gate ($hits < threshold $THRESHOLD)")
        continue
    fi

    TMP=$(mktemp)
    jq --arg g "$gate" --arg c "$code" --arg src "${CODE_SOURCE[$code]:-unknown}" \
       --argjson occ "$hits" --arg now "$NOW" --argjson thr "$THRESHOLD" \
       '. += [{
            "gate": $g,
            "class": $c,
            "status": "enforced",
            "promoted_from": $src,
            "promoted_at": $now,
            "last_seen": $now,
            "occurrences": $occ,
            "threshold": $thr,
            "rationale": "hard-class auto-promotion (1x); render/success-path-only verification insufficient"
        }]' "$REGISTRY" > "$TMP" && mv "$TMP" "$REGISTRY"
    PROMOTED+=("$gate <- $code")
done

# ── Output ───────────────────────────────────────────────────────────────────
PROMOTED_JSON=$(printf '%s\n' "${PROMOTED[@]:-}" | jq -Rsc 'split("\n")|map(select(length>0))')
SKIPPED_JSON=$(printf '%s\n' "${SKIPPED[@]:-}" | jq -Rsc 'split("\n")|map(select(length>0))')

cat <<EOF
{
  "status": "success",
  "command_or_skill": "sxtn-promote-lesson",
  "project_root": "${PROJECT_ROOT}",
  "registry": "${REGISTRY}",
  "lessons_scanned": ${#LESSONS_TO_SCAN[@]},
  "threshold": ${THRESHOLD},
  "promoted": ${PROMOTED_JSON},
  "skipped": ${SKIPPED_JSON},
  "summary": "promoted ${#PROMOTED[@]} gate(s); ${#SKIPPED[@]} skipped"
}
EOF
exit 0
