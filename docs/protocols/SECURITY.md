---
title: "Security Protocol"
id: PROTO_SECURITY
status: canonical
layer: protocol
created: 2026-02-28
updated: 2026-03-01
---

# Security Protocol

> High-level enforcement. Every agent and developer MUST follow these rules. No exceptions.

---

## Three Laws

1. **Never plaintext secrets** in code, config, logs, or database columns.
2. **Never bypass RLS** for convenience.
3. **Never commit secrets** to Git.

---

## Secrets Management

| Rule           | Enforcement                                     |
| -------------- | ----------------------------------------------- |
| Never expose   | No raw values in prompts, code, or logs         |
| Classify first | env / type / scope tags required before storage |
| Master record  | 1Password always updated first                  |
| Rotate         | 30 days (runtime keys), 90 days (build keys)    |
| Reference      | Use `op://` references, never raw values        |

### Key Storage Tiers

| Tier   | What                              | Storage                             | Why                                              |
| ------ | --------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Tier 1 | Workspace API keys                | SHA-256 hash in `api_key` table     | Raw key shown once at creation, only hash stored |
| Tier 2 | External secrets (Stripe, Twilio) | Supabase Vault (pgsodium)           | Needs plaintext retrieval for API calls          |
| Tier 3 | Service-to-service keys           | SHA-256 hash in `service_key` table | Internal auth, never needs retrieval             |

> Architecture details: `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md`

---

## Authentication & Authorization

| Scope                        | Rule                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| User-facing operations       | Always use anon key + RLS via `auth.uid()`                    |
| Admin operations             | Service role only for platform-admin, never for user-facing   |
| Edge Functions with API keys | `verify_jwt = false` + shared auth middleware                 |
| RLS helpers                  | Use `get_workspace_ids_for_user()`, `is_admin_in_workspace()` |
| Workspace isolation          | Every workspace-scoped table has `workspace_id` + RLS policy  |

---

## What Triggers This Protocol

You MUST read this protocol before touching:

- Edge Functions with auth logic
- Vault or secret storage
- RLS policies
- API key creation, rotation, or validation
- Frontend key management UI
- Any `.env` file or environment variable changes

---

## Violations

If you discover a violation (exposed secret, missing RLS, hardcoded credential):

1. **Stop** current work
2. **Fix** the violation immediately
3. **Rotate** any exposed credentials
4. **Write** a Learning record documenting the incident
5. **Verify** no other instances exist in the codebase
