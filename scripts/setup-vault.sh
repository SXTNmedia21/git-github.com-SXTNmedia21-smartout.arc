#!/usr/bin/env bash
# setup-vault.sh — Reads .env.template and creates vault + items in 1Password
# Usage: ./scripts/setup-vault.sh [path-to-env-template]
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

# ── Input ───────────────────────────────────────────────────
ENV_FILE="${1:-.env.template}"

if [ ! -f "$ENV_FILE" ]; then
  fail "Filen $ENV_FILE finnes ikke"
fi

# ── Sjekk op CLI ───────────────────────────────────────────
if ! command -v op &>/dev/null; then
  fail "1Password CLI (op) er ikke installert"
fi

if ! op whoami &>/dev/null; then
  fail "Ikke logget inn i 1Password. Kjør: op signin"
fi

# ── Parse .env.template ────────────────────────────────────
declare -A VAULTS
declare -A ITEMS

log "Leser $ENV_FILE..."

while IFS= read -r line; do
  # Hopp over kommentarer og tomme linjer
  [[ "$line" =~ ^[[:space:]]*#.*$ || -z "${line// }" ]] && continue

  # Match op:// referanser (med eller uten quotes)
  # Vault: first segment, Item: middle segment (may contain spaces), Field: last segment
  if [[ "$line" =~ ^[A-Za-z0-9_]+=[\"\']?op://([^/]+)/([^/]+)/([^/\"\'[:space:]]+) ]]; then
    vault="${BASH_REMATCH[1]}"
    item="${BASH_REMATCH[2]}"
    field="${BASH_REMATCH[3]}"

    VAULTS["$vault"]=1

    # Unngå duplikat-felter
    existing="${ITEMS["${vault}/${item}"]:-}"
    if [[ ! " $existing " =~ " $field " ]]; then
      ITEMS["${vault}/${item}"]+="${field} "
    fi
  fi
done < "$ENV_FILE"

if [ ${#VAULTS[@]} -eq 0 ]; then
  fail "Ingen op:// referanser funnet i $ENV_FILE"
fi

# ── Vis plan ───────────────────────────────────────────────
echo ""
log "Fant følgende struktur:"
echo ""

total_items=0
total_fields=0

for vault in "${!VAULTS[@]}"; do
  echo -e "  ${CYAN}Vault:${NC} $vault"
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

log "Totalt: ${#VAULTS[@]} vault(s), ${total_items} items, ${total_fields} felter"
echo ""

read -p "Opprett denne strukturen i 1Password? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log "Avbrutt."
  exit 0
fi

# ── Opprett vaults ─────────────────────────────────────────
for vault in "${!VAULTS[@]}"; do
  if op vault get "$vault" &>/dev/null; then
    ok "Vault '$vault' eksisterer allerede"
  else
    log "Oppretter vault '$vault'..."
    op vault create "$vault"
    ok "Vault '$vault' opprettet"
  fi
done

# ── Opprett items ──────────────────────────────────────────
created=0
skipped=0

for key in "${!ITEMS[@]}"; do
  vault="${key%%/*}"
  item="${key#*/}"
  fields="${ITEMS[$key]}"

  if op item get "$item" --vault "$vault" &>/dev/null; then
    ok "Item '$item' eksisterer allerede — hopper over"
    skipped=$((skipped + 1))
    continue
  fi

  FIELD_ARGS=()
  for field in $fields; do
    FIELD_ARGS+=("${field}=REPLACE_ME")
  done

  log "Oppretter item '$item' i vault '$vault'..."
  op item create \
    --vault "$vault" \
    --category "API Credential" \
    --title "$item" \
    "${FIELD_ARGS[@]}"
  ok "Item '$item' opprettet"
  created=$((created + 1))
done

# ── Oppsummering ───────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Ferdig!"
echo -e "  ${GREEN}Opprettet:${NC} ${created} items"
echo -e "  ${YELLOW}Hoppet over:${NC} ${skipped} items (eksisterte allerede)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
warn "Neste steg:"
echo "  1. Åpne 1Password og erstatt REPLACE_ME med ekte verdier"
echo "  2. Items å fylle inn:"

for key in "${!ITEMS[@]}"; do
  vault="${key%%/*}"
  item="${key#*/}"
  echo -e "     ${CYAN}${vault}/${item}${NC}"
done

echo ""
echo "  3. Verifiser: op run --env-file=$ENV_FILE -- env | grep SUPABASE"
echo "  4. Kjør:      op run --env-file=$ENV_FILE -- pnpm run dev"
echo ""