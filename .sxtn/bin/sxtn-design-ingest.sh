#!/usr/bin/env bash
# sxtn-design-ingest.sh — Design-export drop-folder → domain scaffold
#
# Usage:
#   sxtn-design-ingest.sh <project_root> [--dry-run]
#
# Arguments:
#   project_root  — root of the project (must contain .sxtn/config.yaml)
#   --dry-run     — print planned writes, make NO changes
#
# What it does:
#   (a) If no Component Index present in .sxtn/design-export/, run
#       sxtn-component-indexer.sh over the export to emit one.
#   (b) Extract FEATURES from the index → write/merge .sxtn/feature-index.yaml
#       (project-level). Existing features are merged, not clobbered.
#   (c) DERIVE domains from features (feature → 1+ domains; grouped by module/
#       feature naming). For each domain:
#       - create docs/domains/<domain>/ if absent
#       - COPY that domain's payload into docs/domains/<domain>/design/
#         (the .jsx/.css/*-data.js for its modules)
#       - write a DESIGN-SPEC.md stub embedding the per-domain component-index slice
#   (d) AFTER successful ingest, EMPTY .sxtn/design-export/ (the mission consumes it).
#       Never deletes source files until copy is verified.
#
# Safety guarantees:
#   - Idempotent: running twice yields the same result (merge, not clobber)
#   - --dry-run prints planned writes with no disk changes
#   - Source files in design-export are NOT removed until copies are verified
#   - Existing domain docs and design files are updated, never deleted
#
# Exit:
#   0 — success (or --dry-run completed)
#   1 — ingest error
#   2 — dependency missing
#   3 — usage / config error
#
# Reference: SPEC § F10 Design-Intake, design-ingest command.

set -uo pipefail

# ============================================================
# Dependency check
# ============================================================
for dep in awk grep sed sort date cp mkdir find; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    echo "ERROR: dependency not found: $dep" >&2
    exit 2
  fi
done

# ============================================================
# Usage check
# ============================================================
if [[ $# -lt 1 ]]; then
  echo "Usage: sxtn-design-ingest.sh <project_root> [--dry-run]" >&2
  exit 3
fi

PROJECT_ROOT="$1"
shift

DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 3
      ;;
  esac
done

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "ERROR: project_root does not exist: $PROJECT_ROOT" >&2
  exit 3
fi

if [[ ! -f "$PROJECT_ROOT/.sxtn/config.yaml" ]]; then
  echo "ERROR: .sxtn/config.yaml not found in: $PROJECT_ROOT" >&2
  exit 3
fi

# ============================================================
# Resolve plugin directory (script lives in <plugin>/bin/)
# ============================================================
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INDEXER="$PLUGIN_DIR/bin/sxtn-component-indexer.sh"

if [[ ! -f "$INDEXER" ]]; then
  echo "ERROR: sxtn-component-indexer.sh not found at: $INDEXER" >&2
  exit 2
fi

# ============================================================
# Paths
# ============================================================
EXPORT_DIR="$PROJECT_ROOT/.sxtn/design-export"
FEATURE_INDEX="$PROJECT_ROOT/.sxtn/feature-index.yaml"
DOMAIN_ROOT="$PROJECT_ROOT/docs/domains"

# Opt-in domain-doc standard. When the target project declares one in config
# (design.domain_doc_standard), design-ingest emits the spine stubs a domain
# folder must carry to pass that project's domain-doc gate (e.g. SmartOut's
# ADR-0392 domain-lint). Unset → current behaviour (DESIGN-SPEC.md only).
DOMAIN_DOC_STANDARD=$(grep -E '^[[:space:]]*domain_doc_standard:' "$PROJECT_ROOT/.sxtn/config.yaml" 2>/dev/null \
  | head -1 | sed 's/.*domain_doc_standard:[[:space:]]*//' | tr -d "\"' " )

# Auto-detect when not explicitly configured: a target that ships scripts/domain-lint.mjs
# or a docs/domains/_DASHBOARD.md index enforces the ADR-0392 domain spine. The plugin
# then emits a conformant spine with NO target-side config — the capability stays entirely
# in the plugin (nothing to commit in the target). Explicit config always wins: set
# domain_doc_standard to a value to override, or to "none"/"" to opt out.
if [[ -z "$DOMAIN_DOC_STANDARD" ]]; then
  if [[ -f "$PROJECT_ROOT/scripts/domain-lint.mjs" || -f "$PROJECT_ROOT/docs/domains/_DASHBOARD.md" ]]; then
    DOMAIN_DOC_STANDARD="adr-0392"
    echo "  Auto-detected domain-doc standard: adr-0392 (target enforces a domain spine)"
  fi
fi

if [[ ! -d "$EXPORT_DIR" ]]; then
  echo "ERROR: design-export dir not found: $EXPORT_DIR" >&2
  exit 3
fi

# Check export dir is non-empty (has at least one file)
EXPORT_FILE_COUNT=$(find "$EXPORT_DIR" -type f | wc -l | tr -d ' ')
if [[ "$EXPORT_FILE_COUNT" -eq 0 ]]; then
  echo "INFO: design-export dir is empty — nothing to ingest." >&2
  exit 0
fi

# ============================================================
# Dry-run helpers
# ============================================================
_dry_echo() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] $*"
  fi
}

_run() {
  # Execute a command only when not in dry-run mode
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] would run: $*"
    return 0
  fi
  "$@"
}

# ============================================================
# STEP (a) — Ensure Component Index exists in export dir
# ============================================================
echo "→ Step (a): Component Index"

COMPONENT_INDEX_FILE=""
# Look for a pre-made component index (YAML file with entries: key)
for f in "$EXPORT_DIR"/*.yaml "$EXPORT_DIR"/*.yml; do
  [[ -f "$f" ]] || continue
  if grep -q '^entries:' "$f" 2>/dev/null; then
    COMPONENT_INDEX_FILE="$f"
    echo "  Found pre-made Component Index: $(basename "$f")"
    break
  fi
done

# Generate one if absent
if [[ -z "$COMPONENT_INDEX_FILE" ]]; then
  echo "  No Component Index found — running sxtn-component-indexer.sh..."

  # Check if there are any .jsx/.tsx files in export dir
  JSX_COUNT=$(find "$EXPORT_DIR" -type f \( -name "*.jsx" -o -name "*.tsx" \) | wc -l | tr -d ' ')
  if [[ "$JSX_COUNT" -eq 0 ]]; then
    echo "ERROR: no .jsx/.tsx files in $EXPORT_DIR and no pre-made Component Index found" >&2
    exit 1
  fi

  GENERATED_INDEX="$EXPORT_DIR/.component-index.yaml"
  _dry_echo "would generate component index at: $GENERATED_INDEX"

  if [[ "$DRY_RUN" == "false" ]]; then
    bash "$INDEXER" "$EXPORT_DIR" "$GENERATED_INDEX" >&2
    COMPONENT_INDEX_FILE="$GENERATED_INDEX"
    echo "  Component Index generated: $GENERATED_INDEX"
  else
    COMPONENT_INDEX_FILE=""
  fi
fi

# ============================================================
# Helper: parse Component Index YAML → pipe-delimited lines
#
# Emits one record per entry with 8 fields (fixed order):
#   feat|tier|mod|ikey|component_id|trigger_kind|operation|nav_target
#
# Fields default: tier=default, operation=none, nav_target="" (empty)
# component_id and trigger_kind default to "" when absent.
# Operates as a function (all vars local).
# ============================================================
_parse_index_simple() {
  local index_file="$1"
  local in_entries="false"
  local feat="" tier="default" mod="" ikey=""
  local cid="" ctype="" tkind="" op="none" ntgt=""

  # Internal: flush current entry as a pipe record
  _flush_entry() {
    if [[ -n "$feat" && -n "$ikey" ]]; then
      printf '%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
        "$feat" "$tier" "$mod" "$ikey" "$cid" "$ctype" "$tkind" "$op" "$ntgt"
    fi
  }

  # Internal: reset per-entry vars
  _reset_entry() {
    feat=""; tier="default"; mod=""; ikey=""
    cid=""; ctype=""; tkind=""; op="none"; ntgt=""
  }

  while IFS= read -r line; do
    # Start of entries block
    if [[ "$line" == "entries:" ]]; then
      in_entries="true"
      continue
    fi
    # End of entries block (consistency_gate or noop_gate follows)
    if [[ "$line" == "consistency_gate:" || "$line" == "noop_gate:" ]]; then
      if [[ "$in_entries" == "true" ]]; then
        _flush_entry
        _reset_entry
      fi
      in_entries="false"
      continue
    fi

    [[ "$in_entries" == "false" ]] && continue

    # New entry start (lines like "  - index_key:") — flush previous
    if echo "$line" | grep -qE '^ {2}- '; then
      _flush_entry
      _reset_entry
      # The "  - " line may itself contain the first field (index_key: ...)
      if echo "$line" | grep -q 'index_key:'; then
        ikey=$(echo "$line" | sed 's/.*index_key:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
      fi
      continue
    fi

    # Parse fields from indented lines
    if echo "$line" | grep -q 'index_key:'; then
      # Tolerant: accept quoted OR unquoted (R1). Token-like values, no internal quotes.
      ikey=$(echo "$line" | sed 's/.*index_key:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
    elif echo "$line" | grep -q 'component_id:'; then
      cid=$(echo "$line" | sed 's/.*component_id:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
    elif echo "$line" | grep -q 'feature:'; then
      feat=$(echo "$line" | sed 's/.*feature:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
    elif echo "$line" | grep -qE '[[:space:]]tier:'; then
      local raw
      raw=$(echo "$line" | sed 's/.*tier:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
      [[ -n "$raw" ]] && tier="$raw"
    elif echo "$line" | grep -q 'module:'; then
      mod=$(echo "$line" | sed 's/.*module:[[:space:]]*//' | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*$//')
    elif echo "$line" | grep -q 'component_type:'; then
      ctype=$(echo "$line" | sed 's/.*component_type:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
    elif echo "$line" | grep -q 'trigger_kind:'; then
      tkind=$(echo "$line" | sed 's/.*trigger_kind:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
    elif echo "$line" | grep -q 'operation:'; then
      local raw_op
      raw_op=$(echo "$line" | sed 's/.*operation:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
      [[ -n "$raw_op" ]] && op="$raw_op"
    elif echo "$line" | grep -q 'nav_target:'; then
      ntgt=$(echo "$line" | sed 's/.*nav_target:[[:space:]]*//' | tr -d '"' | tr -d "'")
      # Strip leading/trailing whitespace
      ntgt=$(echo "$ntgt" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    fi

  done < "$index_file"

  # Flush final entry
  if [[ "$in_entries" == "true" ]]; then
    _flush_entry
  fi
}

# ============================================================
# Helper: derive domain from feature name
#   ansatte-directory → ansatte
#   schedule-view     → schedule
#   dashboard         → dashboard
# ============================================================
_feature_to_domain() {
  echo "$1" | cut -d'-' -f1
}

# ============================================================
# STEP (b) — Build feature→domain mapping from parsed entries
# ============================================================
echo ""
echo "→ Step (b): Extract features from Component Index"

# Maps: feature → tier/domains/modules/keys (space-separated values)
# Initialise with explicit =() so set -u is satisfied
declare -A FEAT_TIER=()
declare -A FEAT_DOMAINS_RAW=()
declare -A FEAT_MODULES_RAW=()
declare -A FEAT_KEYS_RAW=()
FEAT_ORDER=()

# Extended rollup maps (new fields)
# FEAT_COMPONENTS_RAW: feature → newline-separated "cid:::itype:::op:::ntgt:::ikey" records
declare -A FEAT_COMPONENTS_RAW=()
# FEAT_CRUD_CREATE/READ/UPDATE/DELETE: feature → "true" or "false"
declare -A FEAT_CRUD_CREATE=()
declare -A FEAT_CRUD_READ=()
declare -A FEAT_CRUD_UPDATE=()
declare -A FEAT_CRUD_DELETE=()
# FEAT_HAS_API: feature → "true" when any component has trigger_kind in (api,both,telemetry)
declare -A FEAT_HAS_API=()
# FEAT_HAS_NAV: feature → "true" when any navigation component exists
declare -A FEAT_HAS_NAV=()
# FEAT_HAS_MODAL_TOGGLE: feature → "true" when any card/modal/toggle component exists with no CRUD
declare -A FEAT_HAS_MODAL_TOGGLE=()

# Navigation gate collector: space-separated "cid:::ntgt:::ikey" triplets (global across all features)
NAV_GATE_ENTRIES=""

# ────────────────────────────────────────────────────────────
# Map component_type + trigger_kind → interaction_type
#
# Precedence (highest first):
#   1. component_type == card               → card
#   2. trigger_kind == navigation           → navigation  (carry nav_target)
#   3. trigger_kind in (api, both)          → action
#   4. trigger_kind == telemetry            → event
#   5. trigger_kind == none AND cid/name
#      matches settings|config|innstilling
#      |tilpass|customize                   → customize-settings
#   6. else                                 → action
# ────────────────────────────────────────────────────────────
_map_interaction_type() {
  local ctype="$1" tkind="$2" cid="$3"
  if [[ "$ctype" == "card" ]]; then
    echo "card"
  elif [[ "$tkind" == "navigation" ]]; then
    echo "navigation"
  elif [[ "$tkind" == "api" || "$tkind" == "both" ]]; then
    echo "action"
  elif [[ "$tkind" == "telemetry" ]]; then
    echo "event"
  elif [[ "$tkind" == "none" ]] && echo "$cid" | grep -qiE 'settings|config|innstilling|tilpass|customize'; then
    echo "customize-settings"
  else
    echo "action"
  fi
}

# ────────────────────────────────────────────────────────────
# Heuristic: feature_type
#
# Precedence (highest first):
#   wizard  — feature name matches wizard|onboard|steg|step
#   crud    — crud_coverage has ≥2 of create/update/delete
#   control — any modal/toggle component with NO CRUD at all
#   view    — only navigation/read (no create/update/delete, no api)
#   flow    — else
# ────────────────────────────────────────────────────────────
_derive_feature_type() {
  local feat="$1"
  local feat_name_lower
  feat_name_lower=$(echo "$feat" | tr '[:upper:]' '[:lower:]')

  # wizard
  if echo "$feat_name_lower" | grep -qE 'wizard|onboard|steg|step'; then
    echo "wizard"; return
  fi

  # Count CRUD operations
  local crud_count=0
  [[ "${FEAT_CRUD_CREATE[$feat]:-false}" == "true" ]] && crud_count=$((crud_count+1))
  [[ "${FEAT_CRUD_UPDATE[$feat]:-false}" == "true" ]] && crud_count=$((crud_count+1))
  [[ "${FEAT_CRUD_DELETE[$feat]:-false}" == "true" ]] && crud_count=$((crud_count+1))

  if [[ "$crud_count" -ge 2 ]]; then
    echo "crud"; return
  fi

  local has_any_crud=false
  [[ "${FEAT_CRUD_CREATE[$feat]:-false}" == "true" ]] && has_any_crud=true
  [[ "${FEAT_CRUD_READ[$feat]:-false}" == "true"   ]] && has_any_crud=true
  [[ "${FEAT_CRUD_UPDATE[$feat]:-false}" == "true" ]] && has_any_crud=true
  [[ "${FEAT_CRUD_DELETE[$feat]:-false}" == "true" ]] && has_any_crud=true

  # control — modal/toggle with no CRUD at all
  if [[ "${FEAT_HAS_MODAL_TOGGLE[$feat]:-false}" == "true" && "$has_any_crud" == "false" ]]; then
    echo "control"; return
  fi

  # view — only navigation/read, no write CRUD, no api
  local has_write_crud=false
  [[ "${FEAT_CRUD_CREATE[$feat]:-false}" == "true" ]] && has_write_crud=true
  [[ "${FEAT_CRUD_UPDATE[$feat]:-false}" == "true" ]] && has_write_crud=true
  [[ "${FEAT_CRUD_DELETE[$feat]:-false}" == "true" ]] && has_write_crud=true

  if [[ "$has_write_crud" == "false" && "${FEAT_HAS_API[$feat]:-false}" == "false" ]]; then
    echo "view"; return
  fi

  echo "flow"
}

# ────────────────────────────────────────────────────────────
# Derive user_stories[] from a feature's rollup data
# Stable order: create read update delete perform view
# ────────────────────────────────────────────────────────────
_derive_user_stories() {
  local feat="$1"
  local stories=""

  _append_story() {
    local s="$1"
    if [[ -z "$stories" ]]; then stories="$s"
    else stories="$stories $s"; fi
  }

  [[ "${FEAT_CRUD_CREATE[$feat]:-false}" == "true" ]] && _append_story "create"
  [[ "${FEAT_CRUD_READ[$feat]:-false}"   == "true" ]] && _append_story "read"
  [[ "${FEAT_CRUD_UPDATE[$feat]:-false}" == "true" ]] && _append_story "update"
  [[ "${FEAT_CRUD_DELETE[$feat]:-false}" == "true" ]] && _append_story "delete"
  # perform: any trigger_kind in (api, both, telemetry)
  [[ "${FEAT_HAS_API[$feat]:-false}" == "true" ]] && _append_story "perform"
  # view: add ONLY when navigation exists (read is already captured above via CRUD_READ).
  # This keeps stable order [create,read,update,delete,perform,view] without duplicating "read".
  if [[ "${FEAT_HAS_NAV[$feat]:-false}" == "true" ]]; then
    _append_story "view"
  fi

  echo "$stories"
}

# Parsing is read-only (populates in-memory maps); run it in dry-run too so the
# preview reports the real feature/domain counts. Only the WRITES below are gated.
if [[ -n "$COMPONENT_INDEX_FILE" && -f "$COMPONENT_INDEX_FILE" ]]; then
  while IFS='|' read -r feat tier mod ikey cid ctype tkind op ntgt; do
    [[ -z "$feat" ]] && continue

    # Register feature (first occurrence wins for tier)
    if [[ -z "${FEAT_TIER[$feat]+x}" ]]; then
      FEAT_TIER[$feat]="${tier:-default}"
      FEAT_DOMAINS_RAW[$feat]=""
      FEAT_MODULES_RAW[$feat]=""
      FEAT_KEYS_RAW[$feat]=""
      FEAT_COMPONENTS_RAW[$feat]=""
      FEAT_CRUD_CREATE[$feat]="false"
      FEAT_CRUD_READ[$feat]="false"
      FEAT_CRUD_UPDATE[$feat]="false"
      FEAT_CRUD_DELETE[$feat]="false"
      FEAT_HAS_API[$feat]="false"
      FEAT_HAS_NAV[$feat]="false"
      FEAT_HAS_MODAL_TOGGLE[$feat]="false"
      FEAT_ORDER+=("$feat")
    fi

    # Derive domain
    feat_domain=$(_feature_to_domain "$feat")

    # Append domain (space-separated, deduplicated)
    if [[ -z "${FEAT_DOMAINS_RAW[$feat]}" ]]; then
      FEAT_DOMAINS_RAW[$feat]="$feat_domain"
    elif ! echo "${FEAT_DOMAINS_RAW[$feat]}" | grep -qw "$feat_domain"; then
      FEAT_DOMAINS_RAW[$feat]="${FEAT_DOMAINS_RAW[$feat]} $feat_domain"
    fi

    # Append module (deduplicated)
    if [[ -n "$mod" ]]; then
      if [[ -z "${FEAT_MODULES_RAW[$feat]}" ]]; then
        FEAT_MODULES_RAW[$feat]="$mod"
      elif ! echo "${FEAT_MODULES_RAW[$feat]}" | grep -qw "$mod"; then
        FEAT_MODULES_RAW[$feat]="${FEAT_MODULES_RAW[$feat]} $mod"
      fi
    fi

    # Append component key
    if [[ -n "$ikey" ]]; then
      if [[ -z "${FEAT_KEYS_RAW[$feat]}" ]]; then
        FEAT_KEYS_RAW[$feat]="$ikey"
      else
        FEAT_KEYS_RAW[$feat]="${FEAT_KEYS_RAW[$feat]} $ikey"
      fi
    fi

    # ── New rollup fields ──────────────────────────────────

    # Map to interaction_type
    # (no 'local' — this loop runs at script top-level, not inside a function)
    _itype_tmp=$(_map_interaction_type "$ctype" "$tkind" "$cid")

    # Append component record (delimiter ::: is safe since none of these fields contain it)
    _comp_rec_tmp="${cid}:::${_itype_tmp}:::${op:-none}:::${ntgt}:::${ikey}"
    if [[ -z "${FEAT_COMPONENTS_RAW[$feat]}" ]]; then
      FEAT_COMPONENTS_RAW[$feat]="$_comp_rec_tmp"
    else
      FEAT_COMPONENTS_RAW[$feat]="${FEAT_COMPONENTS_RAW[$feat]}
${_comp_rec_tmp}"
    fi

    # CRUD coverage
    case "${op:-none}" in
      create) FEAT_CRUD_CREATE[$feat]="true" ;;
      read)   FEAT_CRUD_READ[$feat]="true" ;;
      update) FEAT_CRUD_UPDATE[$feat]="true" ;;
      delete) FEAT_CRUD_DELETE[$feat]="true" ;;
    esac

    # API / telemetry flag (for perform/view user-story and feature_type)
    if [[ "$tkind" == "api" || "$tkind" == "both" || "$tkind" == "telemetry" ]]; then
      FEAT_HAS_API[$feat]="true"
    fi

    # Navigation flag
    if [[ "$tkind" == "navigation" ]]; then
      FEAT_HAS_NAV[$feat]="true"
    fi

    # Modal/toggle flag (for control feature_type)
    if [[ "$ctype" == "modal" || "$ctype" == "toggle" ]]; then
      FEAT_HAS_MODAL_TOGGLE[$feat]="true"
    fi

    # Navigation gate collector (no 'local' — top-level loop)
    if [[ "$tkind" == "navigation" && -n "$ntgt" ]]; then
      _nav_rec_tmp="${cid}:::${ntgt}:::${ikey}"
      if [[ -z "$NAV_GATE_ENTRIES" ]]; then
        NAV_GATE_ENTRIES="$_nav_rec_tmp"
      else
        NAV_GATE_ENTRIES="${NAV_GATE_ENTRIES}
${_nav_rec_tmp}"
      fi
    fi

  done < <(_parse_index_simple "$COMPONENT_INDEX_FILE")
fi

FEAT_COUNT=${#FEAT_ORDER[@]}

# ── Fallback: if the component index yielded 0 features (e.g. JSX had no
# interactive elements so the indexer emitted entries: []), derive features
# directly from the filenames of .jsx/.tsx files in the export dir.
# Naming convention: <module>-<rest>.jsx → feature = basename without extension.
if [[ "$FEAT_COUNT" -eq 0 ]]; then
  while IFS= read -r -d '' jsx_file; do
    fname=$(basename "$jsx_file")
    # Skip hidden files
    [[ "$fname" == .* ]] && continue
    feat_name=$(basename "$fname" .jsx)
    feat_name=$(basename "$feat_name" .tsx)
    # Normalize to kebab-case lower
    feat_name=$(echo "$feat_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
    [[ -z "$feat_name" ]] && continue
    if [[ -z "${FEAT_TIER[$feat_name]+x}" ]]; then
      FEAT_TIER[$feat_name]="default"
      FEAT_DOMAINS_RAW[$feat_name]=""
      FEAT_MODULES_RAW[$feat_name]=""
      FEAT_KEYS_RAW[$feat_name]=""
      FEAT_ORDER+=("$feat_name")
    fi
    feat_domain=$(_feature_to_domain "$feat_name")
    if [[ -z "${FEAT_DOMAINS_RAW[$feat_name]}" ]]; then
      FEAT_DOMAINS_RAW[$feat_name]="$feat_domain"
    elif ! echo "${FEAT_DOMAINS_RAW[$feat_name]}" | grep -qw "$feat_domain"; then
      FEAT_DOMAINS_RAW[$feat_name]="${FEAT_DOMAINS_RAW[$feat_name]} $feat_domain"
    fi
  done < <(find "$EXPORT_DIR" -type f \( -name "*.jsx" -o -name "*.tsx" \) -print0 2>/dev/null | sort -z)
  FEAT_COUNT=${#FEAT_ORDER[@]}
  if [[ "$FEAT_COUNT" -gt 0 ]]; then
    echo "  Fallback: derived ${FEAT_COUNT} feature(s) from export filenames (component index had no entries)"
  fi
fi

echo "  Discovered ${FEAT_COUNT} feature(s)"

# ============================================================
# Write/merge .sxtn/feature-index.yaml
# ============================================================
_write_feature_index() {
  local out_file="$1"
  local generated_at
  generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  if [[ -f "$out_file" ]]; then
    echo "  Merging with existing feature-index.yaml"
  fi

  # ── Resolve navigation_gate ────────────────────────────────
  # Build lookup: known feature ids + first domain of each feature
  local known_targets=""
  for feat in "${FEAT_ORDER[@]}"; do
    # Add feature id itself
    known_targets="$known_targets $feat"
    # Add first domain of the feature
    local dom0
    dom0=$(echo "${FEAT_DOMAINS_RAW[$feat]:-}" | awk '{print $1}')
    [[ -n "$dom0" ]] && known_targets="$known_targets $dom0"
  done

  # Resolve a single nav_target: echo "resolved" or "dangling"
  # Strategy: strip leading /, take first path segment, strip :param suffixes,
  # then compare case-insensitively to known feature ids and domains.
  _resolve_nav_target() {
    local target="$1"
    local segment
    # Strip leading slash(es), take first path segment, strip :param
    segment=$(echo "$target" | sed 's|^/*||' | cut -d'/' -f1 | cut -d':' -f1 | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/^-//;s/-$//')
    for kt in $known_targets; do
      local kt_lower
      kt_lower=$(echo "$kt" | tr '[:upper:]' '[:lower:]')
      if [[ "$segment" == "$kt_lower" ]]; then
        echo "resolved"; return
      fi
    done
    echo "dangling"
  }

  {
    printf 'generated_at: "%s"\n' "$generated_at"
    printf 'source: "%s"\n' "$EXPORT_DIR"
    printf 'features:\n'

    for feat in "${FEAT_ORDER[@]}"; do
      local tier="${FEAT_TIER[$feat]:-default}"
      local domains_raw="${FEAT_DOMAINS_RAW[$feat]:-}"
      local modules_raw="${FEAT_MODULES_RAW[$feat]:-}"
      local keys_raw="${FEAT_KEYS_RAW[$feat]:-}"
      local comps_raw="${FEAT_COMPONENTS_RAW[$feat]:-}"

      printf '  - feature: "%s"\n' "$feat"
      printf '    tier: "%s"\n' "$tier"

      printf '    domains:\n'
      if [[ -n "$domains_raw" ]]; then
        for d in $domains_raw; do
          printf '      - "%s"\n' "$d"
        done
      else
        printf '      - "%s"\n' "$(_feature_to_domain "$feat")"
      fi

      printf '    modules:\n'
      if [[ -n "$modules_raw" ]]; then
        for m in $modules_raw; do
          printf '      - "%s"\n' "$m"
        done
      else
        printf '      - "%s"\n' "$feat"
      fi

      printf '    component_keys:\n'
      if [[ -n "$keys_raw" ]]; then
        for k in $keys_raw; do
          printf '      - "%s"\n' "$k"
        done
      else
        printf '      []\n'
      fi

      # ── components[] ───────────────────────────────────────
      if [[ -n "$comps_raw" ]]; then
        printf '    components:\n'
        while IFS= read -r comp_rec; do
          [[ -z "$comp_rec" ]] && continue
          local c_cid c_itype c_op c_ntgt c_ikey
          # All fields use ::: as delimiter — extract with awk
          c_cid=$(echo   "$comp_rec" | awk -F':::' '{print $1}')
          c_itype=$(echo "$comp_rec" | awk -F':::' '{print $2}')
          c_op=$(echo    "$comp_rec" | awk -F':::' '{print $3}')
          c_ntgt=$(echo  "$comp_rec" | awk -F':::' '{print $4}')
          c_ikey=$(echo  "$comp_rec" | awk -F':::' '{print $5}')
          printf '      - component_id: "%s"\n' "$c_cid"
          printf '        interaction_type: "%s"\n' "$c_itype"
          [[ -n "$c_op" && "$c_op" != "none" ]] && printf '        operation: "%s"\n' "$c_op"
          [[ -n "$c_ntgt" ]] && printf '        nav_target: "%s"\n' "$c_ntgt"
          [[ -n "$c_ikey" ]] && printf '        index_key: "%s"\n' "$c_ikey"
        done <<< "$comps_raw"
      else
        printf '    components: []\n'
      fi

      # ── crud_coverage ──────────────────────────────────────
      local has_any_component=false
      [[ -n "$comps_raw" ]] && has_any_component=true
      if [[ "$has_any_component" == "true" ]]; then
        printf '    crud_coverage:\n'
        printf '      create: %s\n' "${FEAT_CRUD_CREATE[$feat]:-false}"
        printf '      read: %s\n'   "${FEAT_CRUD_READ[$feat]:-false}"
        printf '      update: %s\n' "${FEAT_CRUD_UPDATE[$feat]:-false}"
        printf '      delete: %s\n' "${FEAT_CRUD_DELETE[$feat]:-false}"
      fi

      # ── user_stories[] ─────────────────────────────────────
      if [[ "$has_any_component" == "true" ]]; then
        local stories
        stories=$(_derive_user_stories "$feat")
        if [[ -n "$stories" ]]; then
          printf '    user_stories:\n'
          for s in $stories; do
            printf '      - "%s"\n' "$s"
          done
        else
          printf '    user_stories: []\n'
        fi
      fi

      # ── feature_type ───────────────────────────────────────
      if [[ "$has_any_component" == "true" ]]; then
        local ftype
        ftype=$(_derive_feature_type "$feat")
        printf '    feature_type: "%s"\n' "$ftype"
      fi
    done

    # ── navigation_gate (top-level, always present) ─────────
    # Must emit [] (empty array) when no navigation components — bare key = null in YAML
    if [[ -z "$NAV_GATE_ENTRIES" ]]; then
      printf 'navigation_gate: []\n'
    else
      printf 'navigation_gate:\n'
    fi
    if [[ -n "$NAV_GATE_ENTRIES" ]]; then
      while IFS= read -r nav_rec; do
        [[ -z "$nav_rec" ]] && continue
        local ng_cid ng_ntgt ng_ikey ng_status ng_msg
        ng_cid=$(echo  "$nav_rec" | awk -F':::' '{print $1}')
        ng_ntgt=$(echo "$nav_rec" | awk -F':::' '{print $2}')
        ng_ikey=$(echo "$nav_rec" | awk -F':::' '{print $3}')
        ng_status=$(_resolve_nav_target "$ng_ntgt")
        if [[ "$ng_status" == "resolved" ]]; then
          ng_msg="nav_target '${ng_ntgt}' resolved to a known feature or domain"
        else
          ng_msg="nav_target '${ng_ntgt}' does not match any known feature or domain"
        fi
        printf '  - component_id: "%s"\n' "$ng_cid"
        printf '    nav_target: "%s"\n' "$ng_ntgt"
        printf '    status: "%s"\n' "$ng_status"
        [[ -n "$ng_ikey" ]] && printf '    index_key: "%s"\n' "$ng_ikey"
        printf '    message: "%s"\n' "$ng_msg"
      done <<< "$NAV_GATE_ENTRIES"
    fi

  } > "$out_file"
}

_dry_echo "would write feature-index to: $FEATURE_INDEX"

if [[ "$DRY_RUN" == "false" ]]; then
  mkdir -p "$(dirname "$FEATURE_INDEX")"
  _write_feature_index "$FEATURE_INDEX"
  echo "  Feature index written: $FEATURE_INDEX"
fi

# ============================================================
# ADR-0392 domain-doc spine (opt-in via design.domain_doc_standard).
# A domain folder must carry these 8 spine files (with frontmatter) to pass
# the target's domain-lint gate. Idempotent: an existing spine file is never
# clobbered. ROADMAP.md is aspirational by design → carries no truth axis.
# ============================================================
_adr0392_mirror_required() {
  case "$1" in ROADMAP.md) return 1 ;; *) return 0 ;; esac
}

_emit_adr0392_spine() {
  local dom="$1" dir="$2" d f fp title
  d=$(date -u +%Y-%m-%d)
  for f in README.md OVERVIEW.md ARCHITECTURE.md DATA-MODEL.md USER-FLOWS.md ROADMAP.md GAPS-AND-DEBT.md E2E-COVERAGE.md; do
    fp="$dir/$f"
    _dry_echo "  spine: $dom/$f"
    [[ "$DRY_RUN" == "true" ]] && continue
    [[ -f "$fp" ]] && continue   # idempotent — never clobber human-authored spine
    title="${f%.md} — ${dom}"
    {
      echo "---"
      echo "title: ${title}"
      echo "status: draft"
      echo "created: ${d}"
      echo "updated: ${d}"
      echo "domain: ${dom}"
      echo "tags: [design, ${dom}]"
      if _adr0392_mirror_required "$f"; then
        echo "mirror: aspirational"
        echo "last_verified: ${d}"
      fi
      echo "---"
      echo ""
      echo "# ${title}"
      echo ""
      echo "> Spine stub generated by \`sxtn-design-ingest\` (ADR-0392 domain-doc standard)."
      echo "> Replace with real content; once reconciled against code, set \`mirror: verified\` and bump \`last_verified\`."
    } > "$fp"
  done
  [[ "$DRY_RUN" == "false" ]] && echo "  ADR-0392 spine ensured: $dir"
}

_ensure_dashboard_entry() {
  local dashboard="$1" dom="$2" d
  _dry_echo "  dashboard: ensure ./${dom}/"
  [[ "$DRY_RUN" == "true" ]] && return 0
  d=$(date -u +%Y-%m-%d)
  if [[ ! -f "$dashboard" ]]; then
    {
      echo "---"
      echo "title: Domains — Status Dashboard"
      echo "status: in_progress"
      echo "created: ${d}"
      echo "updated: ${d}"
      echo "domain: _dashboard"
      echo "tags: [domains, dashboard]"
      echo "---"
      echo ""
      echo "# Domains — Status Dashboard"
      echo ""
      echo "| Domain | Status |"
      echo "| ------ | ------ |"
    } > "$dashboard"
  fi
  grep -q "\./${dom}/" "$dashboard" 2>/dev/null || echo "| [${dom}](./${dom}/) | draft |" >> "$dashboard"
}

# ============================================================
# STEP (c) — Derive domains + scaffold domain folders
# ============================================================
echo ""
echo "→ Step (c): Derive domains + scaffold design folders"

# Collect all domains across all features
declare -A ALL_DOMAINS_FEATURES=()
ALL_DOMAINS_ORDER=()

# Read-only domain rollup — run in dry-run too so the preview lists the domains.
for feat in "${FEAT_ORDER[@]}"; do
  local_doms="${FEAT_DOMAINS_RAW[$feat]:-}"
  [[ -z "$local_doms" ]] && local_doms=$(_feature_to_domain "$feat")
  for dom in $local_doms; do
    if [[ -z "${ALL_DOMAINS_FEATURES[$dom]+x}" ]]; then
      ALL_DOMAINS_FEATURES[$dom]="$feat"
      ALL_DOMAINS_ORDER+=("$dom")
    else
      if ! echo "${ALL_DOMAINS_FEATURES[$dom]}" | grep -qw "$feat"; then
        ALL_DOMAINS_FEATURES[$dom]="${ALL_DOMAINS_FEATURES[$dom]} $feat"
      fi
    fi
  done
done

for dom in "${ALL_DOMAINS_ORDER[@]}"; do
  DOMAIN_DIR="$DOMAIN_ROOT/$dom"
  DESIGN_DIR="$DOMAIN_DIR/design"

  _dry_echo "domain: $dom → $DESIGN_DIR"
  _run mkdir -p "$DESIGN_DIR"

  # Copy domain's payload files from export dir
  # Naming convention: files whose first hyphen-segment matches the domain
  # e.g. domain=ansatte → copy ansatte-directory.jsx, ansatte-data.js, ansatte*.css
  COPIED_FILES=()
  while IFS= read -r -d '' src_file; do
    fname=$(basename "$src_file")
    # Skip hidden files (like .component-index.yaml)
    [[ "$fname" == .* ]] && continue
    # Derive domain prefix from filename
    file_domain=$(echo "$fname" | cut -d'.' -f1 | cut -d'-' -f1)
    if [[ "$file_domain" == "$dom" ]]; then
      DEST="$DESIGN_DIR/$fname"
      _dry_echo "  copy $fname → $DESIGN_DIR/"
      if [[ "$DRY_RUN" == "false" ]]; then
        # Collision guard (R2): recursive find can surface two nested files with
        # the same basename + domain prefix. First wins; never clobber silently.
        if [[ -f "$DEST" ]]; then
          echo "WARNING: basename collision for domain '$dom' — '$fname' already copied; skipping duplicate at $src_file" >&2
        else
          cp "$src_file" "$DEST"
          COPIED_FILES+=("$fname")
        fi
      fi
    fi
  done < <(find "$EXPORT_DIR" -type f \( -name "*.jsx" -o -name "*.tsx" -o -name "*.css" -o -name "*-data.js" \) -print0 2>/dev/null | sort -z)

  # Write DESIGN-SPEC.md stub
  DESIGN_SPEC="$DOMAIN_DIR/DESIGN-SPEC.md"
  _dry_echo "  write DESIGN-SPEC.md for domain: $dom"

  if [[ "$DRY_RUN" == "false" ]]; then
    SPEC_DATE=$(date -u +%Y-%m-%d)
    DOMAIN_FEATURES="${ALL_DOMAINS_FEATURES[$dom]:-}"

    # Per-domain component index slice
    DOMAIN_ENTRIES=""
    if [[ -n "$COMPONENT_INDEX_FILE" && -f "$COMPONENT_INDEX_FILE" ]]; then
      DOMAIN_ENTRIES=$(grep -A 10 "feature: \"${dom}" "$COMPONENT_INDEX_FILE" 2>/dev/null || true)
    fi

    {
      cat <<FRONTMATTER
---
title: Design Spec — ${dom}
status: draft
updated: ${SPEC_DATE}
created: ${SPEC_DATE}
module: ${dom}
tags: [design, design-spec, ${dom}]
---
FRONTMATTER

      printf '\n# Design Spec: %s\n\n' "$dom"
      printf '> Auto-generated by `sxtn-design-ingest` on %s.\n' "$SPEC_DATE"
      printf '> Update this file as implementation progresses.\n\n'
      printf '## Features in this domain\n\n'

      for f in $DOMAIN_FEATURES; do
        t="${FEAT_TIER[$f]:-default}"
        echo "- \`${f}\` (tier: ${t})"
      done

      printf '\n## Component Index (domain slice)\n\n'
      printf '> Sourced from the Component Index emitted during design ingest.\n'
      printf '> Entries sorted by `index_key`. Duplicate `component_id` = UX inconsistency.\n\n'
      printf '```yaml\n'
      if [[ -n "$DOMAIN_ENTRIES" ]]; then
        printf '%s\n' "$DOMAIN_ENTRIES"
      else
        printf '(no component entries found for domain: %s)\n' "$dom"
      fi
      printf '```\n\n'

      printf '## Design files\n\n'
      printf 'Files copied into `docs/domains/%s/design/`:\n\n' "$dom"
      if [[ "${#COPIED_FILES[@]}" -gt 0 ]]; then
        for cf in "${COPIED_FILES[@]}"; do
          echo "- \`${cf}\`"
        done
      else
        echo "_(no files matched domain prefix \`${dom}\`)_"
      fi

      printf '\n## Next steps\n\n'
      echo '- [ ] Review component entries for consistency-gate violations'
      echo '- [ ] Map features to PRD requirements'
      echo '- [ ] Assign implementation tickets'
    } > "$DESIGN_SPEC"

    echo "  DESIGN-SPEC.md written: $DESIGN_SPEC"
  fi

  # ADR-0392 domain spine + dashboard listing (opt-in via config).
  if [[ "$DOMAIN_DOC_STANDARD" == "adr-0392" ]]; then
    _emit_adr0392_spine "$dom" "$DOMAIN_DIR"
    _ensure_dashboard_entry "$DOMAIN_ROOT/_DASHBOARD.md" "$dom"
  fi
done

# ============================================================
# STEP (d) — Empty design-export dir (mission consumes it)
# Only after copies are verified.
# ============================================================
echo ""
echo "→ Step (d): Empty design-export dir"

if [[ "$DRY_RUN" == "false" ]]; then
  # Verify feature-index.yaml exists
  if [[ ! -f "$FEATURE_INDEX" ]]; then
    echo "ERROR: feature-index.yaml not written — aborting export-dir cleanup" >&2
    exit 1
  fi

  # Verify at least one domain/design dir has files, OR there are no JSX/TSX
  # source files at all (nothing to scaffold).
  #
  # SAFETY RULE: if JSX/TSX files are present in the export dir but 0 domain
  # folders were derived and created, we must NOT delete the source files.
  # "0 domains" with JSX present = an ingest failure, not a success.
  VERIFIED=false
  # Count JSX/TSX files that were in the export dir (hidden files excluded)
  EXPORT_JSX_COUNT=$(find "$EXPORT_DIR" -type f \( -name "*.jsx" -o -name "*.tsx" \) ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')
  if [[ ${#ALL_DOMAINS_ORDER[@]} -eq 0 && "$EXPORT_JSX_COUNT" -eq 0 ]]; then
    # Genuinely nothing to scaffold (no JSX/TSX files) — clean up any other files
    VERIFIED=true
  elif [[ ${#ALL_DOMAINS_ORDER[@]} -eq 0 && "$EXPORT_JSX_COUNT" -gt 0 ]]; then
    # JSX files were present but ingest produced 0 domains — safety: preserve source
    echo "ERROR: 0 domains derived from ${EXPORT_JSX_COUNT} JSX/TSX file(s) — export preserved" >&2
    echo "  Check $EXPORT_DIR — no domain folders were created" >&2
    exit 1
  else
    for dom in "${ALL_DOMAINS_ORDER[@]}"; do
      DESIGN_DIR="$DOMAIN_ROOT/$dom/design"
      if [[ -d "$DESIGN_DIR" ]] && [[ -n "$(find "$DESIGN_DIR" -type f 2>/dev/null | head -1)" ]]; then
        VERIFIED=true
        break
      fi
    done
  fi

  if [[ "$VERIFIED" == "true" ]]; then
    find "$EXPORT_DIR" -type f -delete
    echo "  design-export dir emptied"
  else
    echo "WARNING: domain copy verification failed — design-export NOT emptied" >&2
    echo "  Check docs/domains/ for errors, then manually empty $EXPORT_DIR"
  fi
else
  _dry_echo "would empty: $EXPORT_DIR"
fi

# ============================================================
# Summary
# ============================================================
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
  echo "════════════════════════════════════════"
  echo "DRY-RUN complete — no changes made"
  echo "════════════════════════════════════════"
else
  echo "════════════════════════════════════════"
  echo "Design ingest complete"
  echo "  Features: $FEAT_COUNT"
  echo "  Domains:  ${#ALL_DOMAINS_ORDER[@]}"
  echo "  Index:    $FEATURE_INDEX"
  echo "════════════════════════════════════════"
fi

exit 0
