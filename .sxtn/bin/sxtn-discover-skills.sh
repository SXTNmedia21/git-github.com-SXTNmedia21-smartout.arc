#!/usr/bin/env bash
# sxtn-discover-skills.sh — scan user-scope + plugin skill trees for known optional skills
#
# Usage: sxtn-discover-skills.sh [--registry-path <path>]
#
# Behavior:
#   Scans ~/.claude/skills/ and ~/.claude/plugins/*/skills/ for a hardcoded list of
#   recognized optional skills. Recognized = listed in KNOWN_SKILLS below. Missing
#   recognized skill = informational only; never an error.
#
# Output: JSON to stdout (also writes .sxtn/skill-registry.json if cwd has .sxtn/
#         OR --registry-path is provided)
#
# Exit codes:
#   0  always (presence/absence is informational, not error)
#
# Schema: schemas/skill-registry.schema.json
# Reference: docs/METRICS.md (skill_registry_drift metric)

set -euo pipefail

PLUGIN_DIR="${PLUGIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REGISTRY_PATH=""

# ── args ──────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry-path) shift; REGISTRY_PATH="${1:-}"; shift ;;
    *) echo "{\"status\":\"error\",\"error\":\"unknown_flag\",\"flag\":\"$1\"}" >&2; exit 0 ;;
  esac
done

NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# ── known skill definitions ───────────────────────────────────────────────────
# Format: name|plugin_uses_for
# Sorted by category then name for readability

declare -a KNOWN_SKILL_NAMES=(
  "caveman"
  "superpowers:using-superpowers"
  "superpowers:verification-before-completion"
  "superpowers:brainstorming"
  "superpowers:writing-plans"
  "claude-mem"
  "run-council"
  "frontend-designer"
  "domain-steward"
)

declare -a KNOWN_SKILL_USES=(
  "Terse-mode output formatting per user invocation"
  "Follow skill-loading discipline at orchestrator boot per skill instructions"
  "Pre-tag verification gate before v* commits and completion claims per SPEC § 25"
  "Invoke at S2 in place of generic Plan agent for design-package features"
  "Invoke at S5 plan generation in place of generic plan-writer"
  "MCP memory — session_digest at S9 close; query memory at S2 import"
  "Invoke instead of plugin-shipped run-council (delegation per SPEC § 5.1 thin wrapper)"
  "Use for Phase A UI work if config dispatch_table does not override"
  "Use for cross-domain ADR review instead of generic code-reviewer"
)

TOTAL_KNOWN="${#KNOWN_SKILL_NAMES[@]}"

# ── scan paths ────────────────────────────────────────────────────────────────
# Primary scan paths (POSIX-compatible; no process substitution for path list)
SCAN_PATH_1="$HOME/.claude/skills"
SCAN_PATH_2="$HOME/.claude/plugins"  # searched recursively for SKILL.md under */skills/*/

declare -a SCAN_PATHS=("$SCAN_PATH_1" "$SCAN_PATH_2")

# ── skill lookup helper ───────────────────────────────────────────────────────
# find_skill <name>
# Prints: found_path if found, empty string if not
# Handles both "caveman" (flat) and "superpowers:brainstorming" (namespace:skill) forms
find_skill() {
  local name="$1"
  local path_found=""

  # Split on colon for namespaced skills
  local namespace="" skillname="$name"
  if [[ "$name" == *":"* ]]; then
    namespace="${name%%:*}"
    skillname="${name#*:}"
  fi

  # claude-mem is MCP-based: check for SKILL.md under any claude-mem plugin directory
  if [[ "$name" == "claude-mem" ]]; then
    local mcp_path
    mcp_path=$(find "$HOME/.claude/plugins" -type f -name "SKILL.md" \
      -path "*/claude-mem*/*" 2>/dev/null \
      | head -1 || true)
    if [[ -n "$mcp_path" ]]; then
      path_found="$mcp_path"
    fi
    echo "$path_found"
    return 0
  fi

  # Direct path: ~/.claude/skills/<name>/SKILL.md (user-scope flat install)
  local direct="$HOME/.claude/skills/${skillname}/SKILL.md"
  if [[ -f "$direct" ]]; then
    path_found="$direct"
    echo "$path_found"
    return 0
  fi

  # Namespaced path: ~/.claude/skills/<namespace>/<skillname>/SKILL.md (rare)
  if [[ -n "$namespace" ]]; then
    local ns_direct="$HOME/.claude/skills/${namespace}/${skillname}/SKILL.md"
    if [[ -f "$ns_direct" ]]; then
      path_found="$ns_direct"
      echo "$path_found"
      return 0
    fi
  fi

  # Plugin marketplace scan: ~/.claude/plugins/**/skills/<skillname>/SKILL.md
  # Use find with -name for portability (no extended glob needed)
  local plugin_path
  plugin_path=$(find "$HOME/.claude/plugins" -type f -name "SKILL.md" \
    -path "*/skills/${skillname}/SKILL.md" 2>/dev/null \
    | head -1 || true)
  if [[ -n "$plugin_path" ]]; then
    path_found="$plugin_path"
    echo "$path_found"
    return 0
  fi

  # Plugin shipped skills: $PLUGIN_DIR/skills/*/<name>/SKILL.md
  if [[ -d "$PLUGIN_DIR/skills" ]]; then
    local plugin_shipped
    plugin_shipped=$(find "$PLUGIN_DIR/skills" -type f -name "SKILL.md" \
      -path "*/${skillname}/SKILL.md" 2>/dev/null \
      | head -1 || true)
    if [[ -n "$plugin_shipped" ]]; then
      path_found="$plugin_shipped"
      echo "$path_found"
      return 0
    fi
  fi

  echo ""
}

# ── extract version from SKILL.md frontmatter ─────────────────────────────────
extract_version() {
  local skill_path="$1"
  local version
  # Try plugin_version_min first, then version, then plugin_version
  version=$(awk '
    BEGIN { in_fm=0; found="" }
    /^---$/ { in_fm++; next }
    in_fm == 1 && /^plugin_version_min:/ { found=$2; exit }
    in_fm == 1 && /^version:/ && found=="" { found=$2 }
    in_fm == 1 && /^plugin_version:/ && found=="" { found=$2 }
    in_fm == 2 { exit }
    END { print found }
  ' "$skill_path" 2>/dev/null || true)
  echo "${version:-null}"
}

# ── extract last_modified from file mtime ─────────────────────────────────────
file_mtime_iso() {
  local path="$1"
  local epoch
  epoch=$(stat -c '%Y' "$path" 2>/dev/null \
    || stat -f '%m' "$path" 2>/dev/null \
    || echo 0)
  # Convert epoch to ISO-8601 UTC
  date -u -d "@$epoch" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || date -u -r "$epoch" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || echo "${NOW_ISO}"
}

# ── build JSON registry ───────────────────────────────────────────────────────
found_count=0
missing_count=0

# Build known_skills array as individual JSON objects; join later with jq
SKILL_JSONS=()

for i in "${!KNOWN_SKILL_NAMES[@]}"; do
  skill_name="${KNOWN_SKILL_NAMES[$i]}"
  skill_uses="${KNOWN_SKILL_USES[$i]}"

  skill_path=$(find_skill "$skill_name")

  if [[ -n "$skill_path" ]]; then
    found_count=$(( found_count + 1 ))
    version=$(extract_version "$skill_path")
    last_mod=$(file_mtime_iso "$skill_path")

    # Escape path for JSON (simple: replace backslash and double-quote)
    safe_path=$(printf '%s' "$skill_path" | sed 's/\\/\\\\/g; s/"/\\"/g')
    safe_version=$(printf '%s' "$version" | sed 's/"/\\"/g')

    if [[ "$safe_version" == "null" ]]; then
      version_json="null"
    else
      version_json="\"$safe_version\""
    fi

    SKILL_JSONS+=("{\"name\":\"$skill_name\",\"found\":true,\"path\":\"$safe_path\",\"version\":$version_json,\"last_modified\":\"$last_mod\",\"plugin_uses_for\":\"$skill_uses\"}")
  else
    missing_count=$(( missing_count + 1 ))
    SKILL_JSONS+=("{\"name\":\"$skill_name\",\"found\":false,\"plugin_uses_for\":\"$skill_uses\"}")
  fi
done

# ── assemble final JSON via jq ─────────────────────────────────────────────────
if ! command -v jq >/dev/null 2>&1; then
  # Fallback: manual assembly (no jq)
  skills_array=""
  for j in "${SKILL_JSONS[@]}"; do
    [[ -n "$skills_array" ]] && skills_array="${skills_array},"
    skills_array="${skills_array}${j}"
  done

  scan_paths_json="[\"${SCAN_PATH_1}\",\"${SCAN_PATH_2}\"]"

  OUTPUT="{\"scanned_at\":\"$NOW_ISO\",\"scan_paths\":$scan_paths_json,\"known_skills\":[$skills_array],\"summary\":{\"total_known\":$TOTAL_KNOWN,\"found\":$found_count,\"missing\":$missing_count}}"
else
  # Build via jq for correct JSON serialization (handles special chars, etc.)
  # Feed skill objects as arguments to jq -n
  jq_args=()
  jq_argjson_block=""
  for i in "${!SKILL_JSONS[@]}"; do
    jq_args+=("--argjson" "s${i}" "${SKILL_JSONS[$i]}")
    jq_argjson_block="${jq_argjson_block} \$s${i},"
  done

  # Trim trailing comma
  jq_argjson_block="${jq_argjson_block%,}"

  OUTPUT=$(jq -n \
    "${jq_args[@]}" \
    --arg scanned_at "$NOW_ISO" \
    --arg sp1 "$SCAN_PATH_1" \
    --arg sp2 "$SCAN_PATH_2" \
    --argjson total "$TOTAL_KNOWN" \
    --argjson found "$found_count" \
    --argjson missing "$missing_count" \
    "{
      scanned_at: \$scanned_at,
      scan_paths: [\$sp1, \$sp2],
      known_skills: [${jq_argjson_block}],
      summary: {
        total_known: \$total,
        found: \$found,
        missing: \$missing
      }
    }")
fi

# ── write registry file ───────────────────────────────────────────────────────
# Determine write target
write_target=""
if [[ -n "$REGISTRY_PATH" ]]; then
  write_target="$REGISTRY_PATH"
elif [[ -d "$(pwd)/.sxtn" ]]; then
  write_target="$(pwd)/.sxtn/skill-registry.json"
fi

if [[ -n "$write_target" ]]; then
  mkdir -p "$(dirname "$write_target")"
  echo "$OUTPUT" > "$write_target"
fi

# ── stdout output ─────────────────────────────────────────────────────────────
echo "$OUTPUT"
exit 0
