---
title: "Journey — Admin sends contract to employee"
feature: employee-contract
status: superseded
superseded_by: docs/architecture/contract-service/JOURNEY-contract-module.md
updated: 2026-04-29
created: 2026-04-28
module: other
tags: [journey, contracts, admin, docuseal]
---

# Journey: Admin sends contract to employee

**Precondition:** Contract row exists in `draft` status. Employee has email on profile. DocuSeal API + webhook secret configured. `infra-contract-service-1` running.

## Happy path

1. Admin opens contracts table → User sees row with status `draft` + dropdown menu.
2. Admin clicks dropdown → "Send" → System opens `ContractSendDrawer` OR sends directly if drawer flow already complete.
3. Admin reviews placeholders + previews resolved HTML → System calls `/api/contracts/resolve-placeholders` → User sees rendered contract.
4. Admin clicks "Send kontrakt" → System opens AlertDialog "Send to {employee}?" → User confirms.
5. System POSTs to `/api/contracts/[id]/send` → contract-service creates DocuSeal submission → `docuseal_submission_id` stored on contract row → status flips to `pending_signature` → System emits `contracts.send.submitted` telemetry.
6. DocuSeal sends signing email to employee → User sees toast "Sendt til {employee}" + table row updates to "Sendt" badge.

**Postcondition:** `employment_contract.status = 'pending_signature'`, `docuseal_submission_id` not null, `audit_trail` entry written, telemetry emitted, employee has email in inbox.

## Error paths

- **DocuSeal API down:** contract-service returns 502, drawer shows error banner, contract stays in `draft`, no telemetry emitted (only on success).
- **Employee email missing:** API rejects with validation error, drawer surfaces "Employee has no email on profile" with link to profile.
- **Already-sent contract:** dropdown "Send" hidden via status filter; if leaked through, API returns 409.
- **Service-key invalid:** contract-service returns 401; surface to user as generic "Could not send" with retry.
- **Slow DocuSeal (>5s):** Send button stays in pending state with spinner, no auto-cancel.
