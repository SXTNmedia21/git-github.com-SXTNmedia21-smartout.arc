---
title: "Journey — Employee signs contract (webhook → status update)"
feature: employee-contract
status: superseded
superseded_by: docs/architecture/contract-service/JOURNEY-contract-module.md
updated: 2026-04-29
created: 2026-04-28
module: other
tags: [journey, contracts, employee, docuseal, webhook]
---

# Journey: Employee signs contract

**Precondition:** Contract in `pending_signature` status with valid `docuseal_submission_id`. Employee has signing email link. DocuSeal webhook configured to POST to `/api/webhooks/docuseal` (Next.js — the canonical handler per ADR; contract-service `/webhooks/docuseal` is DEPRECATED but kept for local dev).

## Happy path

1. Employee opens email → clicks signing link → DocuSeal renders contract in browser.
2. Employee reviews contract → fills signature field → clicks "Sign".
3. DocuSeal posts `form.completed` event to `/api/webhooks/docuseal` with `x-docuseal-secret` header → System validates secret → looks up contract by `docuseal_submission_id`.
4. System updates `employment_contract.status = 'signed'`, `signed_at = NOW()`, persists signed PDF URL → emits `contracts.signed` telemetry → activity_trail written → workspace activation triggered if first contract.
5. Admin reloads contracts table OR receives realtime update → User sees row status update to "Signert".

**Postcondition:** Contract `status = 'signed'`, `signed_at` set, signed document fetchable via `/contracts/[id]/fetch-documents`, audit trail complete, employee permissions activated if applicable.

## Error paths

- **Webhook secret invalid:** webhook returns 401, no DB write, DocuSeal retries per its own backoff. No user-visible effect; admin sees stale `pending_signature` indefinitely if persistent.
- **Submission ID not found in DB:** webhook returns 404, logs warn. Possible cause: contract deleted/reassigned mid-flight. Manual reconciliation required.
- **Employee declines:** DocuSeal posts `form.declined` → status flips to `declined` → admin sees declined badge + decline_reason if provided.
- **Webhook unreachable / Vercel down:** DocuSeal retries; contract-service deprecated handler picks it up if local dev. Status update delayed but not lost.
- **Concurrent webhooks (race):** STATUS_WEIGHT logic ensures progression — never regress from `signed` back to `viewed`.
- **Document fetch fails:** /fetch-documents endpoint returns error, admin sees fallback "Document pending" with retry button.
