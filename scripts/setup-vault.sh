#!/usr/bin/env bash
# setup-vault.sh — Reads .env.template and ensures vault structure in 1Password
#
# Usage:
#   ./scripts/setup-vault.sh                        # Setup dev vault from .env.template
#   ./scripts/setup-vault.sh --sync                 # Setup dev + create prod vault with same structure
#   ./scripts/setup-vault.sh --prod-vault NAME      # Specify prod vault name (default: {dev}_prod)
#   ./scripts/setup-vault.sh --env-file FILE        # Use different template file
#
# Two-Vault Architecture:
#   Every project has {product}_dev and {product}_prod vaults.
#   This script creates missing items and adds missing fields to existing items.
#   With --sync, it mirrors the structure to the prod vault.
#
# WSL: Run eval $(op signin) before running this script.
#
set -eo pipefail

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[setup]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn]${NC} $1"; }
fail() { echo -e "${RED}[ fail]${NC} $1"; exit 1; }

# ── Args ─────────────────────────────────────────────────────
ENV_FILE=".env.template"
SYNC_PROD=false
PROD_VAULT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync)       SYNC_PROD=true; shift ;;
    --prod-vault) PROD_VAULT="$2"; shift 2 ;;
    --env-file)   ENV_FILE="$2"; shift 2 ;;
    *)            ENV_FILE="$1"; shift ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  fail "Filen $ENV_FILE finnes ikke"
fi

# ── Sjekk op CLI ───────────────────────────────────────────
if ! command -v op &>/dev/null; then
  fail "1Password CLI (op) er ikke installert"
fi

if ! op whoami &>/dev/null; then
  fail "Ikke logget inn i 1Password. Kjor: eval \$(op signin)"
fi

# ── Parse .env.template ────────────────────────────────────
# ITEMS maps "vault/item" -> space-separated field names
declare -A VAULTS
declare -A ITEMS

log "Leser $ENV_FILE..."

while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*#.*$ || -z "${line// }" ]] && continue

  if [[ "$line" =~ ^[A-Za-z0-9_]+=[\"\']?op://([^/]+)/([^/]+)/([^/\"\'[:space:]]+) ]]; then
    vault="${BASH_REMATCH[1]}"
    item="${BASH_REMATCH[2]}"
    field="${BASH_REMATCH[3]}"

    VAULTS["$vault"]=1

    existing="${ITEMS["${vault}/${item}"]:-}"
    if [[ ! " $existing " =~ " $field " ]]; then
      ITEMS["${vault}/${item}"]+="${field} "
    fi
  fi
done < "$ENV_FILE"

if [ ${#VAULTS[@]} -eq 0 ]; then
  fail "Ingen op:// referanser funnet i $ENV_FILE"
fi

# Determine prod vault name
DEV_VAULT=""
for v in "${!VAULTS[@]}"; do
  DEV_VAULT="$v"
  break
done

if [ -z "$PROD_VAULT" ]; then
  # Convention: {product}_prod
  PROD_VAULT="${DEV_VAULT}_prod"
fi

# ── Vis plan ───────────────────────────────────────────────
echo ""
log "Fant folgende struktur:"
echo ""

total_items=0
total_fields=0

for vault in "${!VAULTS[@]}"; do
  echo -e "  ${CYAN}Dev vault:${NC} $vault"
  if $SYNC_PROD; then
    echo -e "  ${CYAN}Prod vault:${NC} $PROD_VAULT (sync)"
  fi
  echo ""
  for key in "${!ITEMS[@]}"; do
    if [[ "$key" == "${vault}/"* ]]; then
      item="${key#*/}"
      fields="${ITEMS[$key]}"
      field_count=$(echo "$fields" | wc -w)
      total_items=$((total_items + 1))
      total_fields=$((total_fields + field_count))
      echo -e "    ${GREEN}Item:${NC} $item (${field_count} felter)"
      for field in $fields; do
        echo -e "      - $field"
      done
    fi
  done
  echo ""
done

log "Totalt: ${total_items} items, ${total_fields} felter"
if $SYNC_PROD; then
  log "Vil opprette i BEGGE vaults: $DEV_VAULT + $PROD_VAULT"
fi
echo ""

read -p "Fortsett? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log "Avbrutt."
  exit 0
fi

# ── Ensure vault exists ──────────────────────────────────────

ensure_vault() {
  local vault_name="$1"
  if op vault get "$vault_name" &>/dev/null; then
    ok "Vault '$vault_name' eksisterer"
  else
    log "Oppretter vault '$vault_name'..."
    op vault create "$vault_name"
    ok "Vault '$vault_name' opprettet"
  fi
}

# ── Ensure item + fields exist ───────────────────────────────

ensure_item_fields() {
  local vault_name="$1"
  local item_name="$2"
  local fields="$3"
  local default_value="${4:-REPLACE_ME}"

  if op item get "$item_name" --vault "$vault_name" &>/dev/null; then
    # Item exists — check for missing fields and add them
    local existing_json
    existing_json=$(op item get "$item_name" --vault "$vault_name" --format json 2>/dev/null)
    local added=0

    for field in $fields; do
      # Check if field exists in the item
      if echo "$existing_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
fields = [f.get('label','') for f in data.get('fields',[])]
sys.exit(0 if '$field' in fields else 1)
" 2>/dev/null; then
        continue  # Field exists
      fi

      # Add missing field
      log "  Legger til felt '$field' i '$item_name' ($vault_name)..."
      op item edit "$item_name" --vault "$vault_name" "${field}=${default_value}" 2>/dev/null && added=$((added + 1)) || warn "Kunne ikke legge til '$field'"
    done

    if [ $added -gt 0 ]; then
      ok "Item '$item_name' ($vault_name): $added nye felter lagt til"
    else
      ok "Item '$item_name' ($vault_name): alle felter finnes"
    fi
  else
    # Create new item with all fields
    FIELD_ARGS=()
    for field in $fields; do
      FIELD_ARGS+=("${field}=${default_value}")
    done

    log "Oppretter item '$item_name' i vault '$vault_name'..."
    op item create \
      --vault "$vault_name" \
      --category "API Credential" \
      --title "$item_name" \
      "${FIELD_ARGS[@]}"
    ok "Item '$item_name' opprettet i '$vault_name'"
  fi
}

# ── Dev vault ────────────────────────────────────────────────
echo ""
log "=== Dev vault: $DEV_VAULT ==="
ensure_vault "$DEV_VAULT"

created_dev=0
for key in "${!ITEMS[@]}"; do
  vault="${key%%/*}"
  item="${key#*/}"
  fields="${ITEMS[$key]}"
  ensure_item_fields "$vault" "$item" "$fields" "REPLACE_ME"
  created_dev=$((created_dev + 1))
done

# ── Prod vault (if --sync) ───────────────────────────────────
created_prod=0
if $SYNC_PROD; then
  echo ""
  log "=== Prod vault: $PROD_VAULT ==="
  ensure_vault "$PROD_VAULT"

  for key in "${!ITEMS[@]}"; do
    vault="${key%%/*}"
    item="${key#*/}"
    fields="${ITEMS[$key]}"
    # Same items, same fields — but in the prod vault
    ensure_item_fields "$PROD_VAULT" "$item" "$fields" "REPLACE_ME_PROD"
    created_prod=$((created_prod + 1))
  done
fi

# ── Oppsummering ───────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Ferdig!"
echo -e "  ${GREEN}Dev vault:${NC}  $DEV_VAULT ($created_dev items sjekket)"
if $SYNC_PROD; then
  echo -e "  ${GREEN}Prod vault:${NC} $PROD_VAULT ($created_prod items sjekket)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
warn "Neste steg:"
echo "  1. Apne 1Password og erstatt REPLACE_ME med dev-verdier (localhost URLs, test keys)"
if $SYNC_PROD; then
  echo "  2. Erstatt REPLACE_ME_PROD med prod-verdier (ekte URLs, live keys)"
  echo "  3. Verifiser dev:  op run --env-file=$ENV_FILE -- env | grep SCRAPLING"
  echo "  4. Verifiser prod: (bytt vault-referanser i template)"
else
  echo "  2. Verifiser: op run --env-file=$ENV_FILE -- env | grep SCRAPLING"
  echo "  3. Kjor:      op run --env-file=$ENV_FILE -- pnpm run dev"
  echo ""
  echo "  For a opprette prod vault med samme struktur:"
  echo "    ./scripts/setup-vault.sh --sync"
fi
echo ""
