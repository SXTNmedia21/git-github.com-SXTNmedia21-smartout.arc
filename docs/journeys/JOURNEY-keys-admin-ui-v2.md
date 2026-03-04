---
title: "User Journeys — keys-admin-ui-v2"
status: done
updated: 2026-03-02
created: 2026-03-02
module: platform-admin
tags: [keys, secrets, vault, platform-admin, journeys]
---

# User Journeys — keys-admin-ui-v2

## Journey: Platform Admin — Browse External Secrets by Category

**Precondition:** User has godmode access (`is_godmode = true`).

1. User navigates to Platform Admin > Keys
2. System shows "API Keys & Secrets" page with two main tabs: API Keys, External Secrets
3. User clicks "External Secrets" tab
4. System shows 4 sub-tabs: Client Keys, Server Keys, Runtime Keys, Webhooks & Tokens
5. User clicks "Server Keys" sub-tab
6. System shows server keys grouped by tag (AI & Voice, Billing, Notifications, Contracts)
7. Each group shows a table with: Name, Prefix, Tag badge, Status (configured/unconfigured), Environment (live/test), Actions
8. User sees at a glance which secrets are configured vs missing

**Postcondition:** User has a categorized view of all platform secrets.

**Error paths:**

- Non-godmode user → redirected to `/dashboard`
- API fetch fails → toast "Failed to load data"

---

## Journey: Platform Admin — Import Secrets from .env File

**Precondition:** User has godmode access. Has a `.env.local` or similar file with secrets.

1. User clicks "Import .env" button in the page header
2. System opens dialog: "Import from .env" with a textarea
3. User pastes .env file contents (e.g., `OPENROUTER_API_KEY=sk-or-...`, `STRIPE_SECRET_KEY=sk_live_...`)
4. User clicks "Preview"
5. System parses lines, matches env vars against the service registry
6. System shows two sections:
   - Matched (N) — table with Service name, Tag badge, masked value
   - Unmatched — skipped (M) — table with env var name and "unconfigured" badge
7. User clicks "Import N secrets"
8. System calls `POST /api/platform-admin/secrets/bulk` with `action: "import"`
9. For each matched secret: Vault `upsert_secret` RPC + metadata row upsert
10. System shows toast "Imported N secrets"
11. Dialog closes, table refreshes — imported secrets now show as "configured"

**Postcondition:** Matched secrets are stored in Vault with metadata in `platform_external_secret`.

**Error paths:**

- No valid KEY=VALUE lines → toast "No valid KEY=VALUE lines found"
- No lines match known services → toast "No lines matched known services"
- Vault upsert fails for a secret → that secret reported as failed in response, others still imported
- Network error → toast "Network error"

---

## Journey: Platform Admin — Rotate a Secret Value

**Precondition:** User has godmode access. Secret is already configured.

1. User finds the secret in the appropriate sub-tab
2. User clicks the settings (gear) icon on the secret row
3. System opens a popover with: service name, environment selector (Live/Test), actions
4. User optionally changes environment
5. User clicks "Rotate Secret"
6. Browser prompt asks for new secret value
7. User enters the new value and confirms
8. System calls `POST /api/platform-admin/secrets` with the new value
9. System shows toast "Service Name updated"
10. Popover closes, table refreshes

**Postcondition:** Secret value updated in Vault, metadata row updated with new `last_rotated_at`.

**Error paths:**

- User cancels browser prompt → no action taken
- Vault upsert fails → toast with error message
- Network error → toast "Network error"

---

## Journey: Platform Admin — Delete a Secret

**Precondition:** User has godmode access. Secret is configured.

1. User clicks settings icon on a configured secret
2. User clicks "Delete Secret" (red text)
3. Browser confirm dialog: "Delete Service Name? This will remove the secret from Vault."
4. User confirms
5. System calls `POST /api/platform-admin/secrets/bulk` with `action: "delete", keys: [key]`
6. System deletes from Vault via `delete_vault_secret` RPC + removes metadata row
7. Toast "Service Name deleted"
8. Popover closes, table refreshes — secret now shows as "unconfigured"

**Postcondition:** Secret removed from Vault and `platform_external_secret` table.

**Error paths:**

- User cancels confirm → no action taken
- Vault delete fails → toast "Failed to delete secret"
- Network error → toast "Network error"

---

## Journey: Platform Admin — Set a Secret for the First Time

**Precondition:** User has godmode access. Secret is not yet configured (status: unconfigured).

1. User finds the unconfigured secret in the appropriate sub-tab
2. User clicks settings icon
3. Popover shows "Set Secret" button (instead of "Rotate Secret")
4. User clicks "Set Secret"
5. Browser prompt asks for the secret value
6. User enters the value
7. System calls `POST /api/platform-admin/secrets` with value + environment
8. Toast "Service Name updated"
9. Table refreshes — secret now shows as "configured"

**Postcondition:** New secret stored in Vault, metadata row created.

**Error paths:** Same as Rotate journey.
