---
title: "User Journeys — Keys Admin Bug Fixes"
status: done
updated: 2026-03-03
created: 2026-03-03
module: platform-admin
tags: [keys, secrets, journeys]
---

# User Journeys — Keys Admin Bug Fixes

## Journey: Platform Admin — Add External Secret via Dialog

**Precondition:** User is a platform admin (godmode) on the Keys & Secrets page, External Secrets tab.

1. Admin clicks "Add Secret" button → System opens CreateSecretDialog
2. Admin selects a service from the grouped dropdown (e.g., "Stripe Secret Key" under Server Keys) → System shows the expected prefix hint (e.g., "starts with sk\_")
3. Admin pastes the secret value into the masked input field → System validates prefix if applicable
4. Admin selects environment (Live/Test) → System defaults to "Live"
5. Admin optionally adds a description → System pre-fills with service label + env var name
6. Admin clicks "Save Secret" → System calls POST /api/platform-admin/secrets with upsert logic
7. System stores encrypted value in Vault via upsert_secret RPC → System creates/updates metadata in platform_external_secret
8. Admin sees success confirmation with green checkmark → Admin clicks "Done" to close

**Postcondition:** Secret is encrypted in Vault, metadata row exists in platform_external_secret, service shows "Configured" status in the table.

**Error paths:**

- No service selected → Toast: "Select a service"
- Empty secret value → Toast: "Secret value is required"
- Wrong prefix (e.g., pasting `rk_` for Stripe which expects `sk_`) → Toast warning about expected prefix
- Network error → Toast: "Network error"
- Vault storage failure → Toast with vault error message

---

## Journey: Platform Admin — Rotate Existing Secret via Popover

**Precondition:** Admin is on External Secrets tab, a service already has a configured secret.

1. Admin clicks the settings gear icon on a service row → System opens popover with service name, environment selector, and action buttons
2. Admin clicks "Rotate Secret" → System closes popover, opens CreateSecretDialog with service pre-selected (disabled)
3. Admin pastes the new secret value → System validates prefix
4. Admin clicks "Save Secret" → System upserts vault value and updates metadata (last_rotated_at, last_rotated_by)
5. Admin sees success confirmation → Table refreshes showing updated rotation date

**Postcondition:** Vault contains new secret value, metadata row updated with new rotation timestamp.

**Error paths:**

- Same as "Add External Secret" error paths above
- Previously: re-setting a secret that already existed returned "A secret with this vault name already exists" (409) — now fixed with upsert logic

---

## Journey: Platform Admin — Set Secret for Unconfigured Service

**Precondition:** Admin is on External Secrets tab, a service shows "Unconfigured" status.

1. Admin clicks settings gear → Popover shows "Set Secret" button (not "Rotate Secret")
2. Admin clicks "Set Secret" → CreateSecretDialog opens with service pre-selected
3. Admin pastes secret value, selects environment, clicks "Save Secret"
4. System creates vault entry and metadata row
5. Table refreshes — service now shows "Configured" status

**Postcondition:** Service transitions from unconfigured to configured.

---

## Journey: Platform Admin — Re-save Secret Without Duplicate Error

**Precondition:** Admin previously saved a secret for a service. Attempts to save again (e.g., after a failed attempt where the vault entry was created but UI didn't update).

1. Admin opens "Add Secret" dialog or clicks "Set Secret" on the service
2. Admin pastes the (same or new) secret value → Clicks "Save Secret"
3. System calls POST /api/platform-admin/secrets → API finds existing metadata row
4. System upserts vault value (overwrites) → Updates metadata row (provider, environment, description, rotation timestamp)
5. System returns 200 (not 409) → Admin sees success

**Postcondition:** No error. Secret updated in vault, metadata refreshed.

**Error paths:**

- Previously: returned 409 "A secret with this vault name already exists" — now fixed
