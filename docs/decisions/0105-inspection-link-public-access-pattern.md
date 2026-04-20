---
title: "ADR-0105: inspection_link Public-Access Pattern"
id: ADR-0105
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0105: inspection_link Public-Access Pattern

**Status:** Accepted (MVP schema only; UI deferred to Phase 4)
**Date:** 2026-04-15

## Context and Problem Statement

Norwegian regulators (Arbeidstilsynet, Mattilsynet, etc.) need scoped, time-limited, auditable access to governance evidence without a full Smartout account. This is a high-sensitivity public entrypoint: it must respect ADR-0077 (PII handling) and ADR-0078 (channel restriction), and default to anonymization so a non-completion never surfaces a sick employee's name.

## Decision Drivers

- Tokens in URLs are the simplest distribution channel but must never be stored plaintext.
- Access must be scoped (which policies/protocols/time window) and revocable.
- Every view must be audit-logged for GDPR accountability.
- Default rendering must not leak PII — absence of evidence must read as `utilgjengelig`, not "not completed".

## Considered Options

- **A.** Issue regulator accounts in Supabase Auth per inspection.
- **B.** `inspection_link` with hashed token + scope JSONB + validity window + view audit, served through a `public-api` Edge Function.
- **C.** Send signed PDFs via email per request.

## Decision Outcome

Chosen option: **B** (MVP schema only; UI deferred to Phase 4).

- Schema includes:
  - `token_hash` (never plaintext; hashed per secrets-protocol),
  - `scope` JSONB,
  - `valid_from` / `valid_to`,
  - `revoked_at`,
  - `justification` (required; supports GDPR Art. 9 processing),
  - `anonymization` ENUM (`anonymized` default, `names_visible`).
- `public-api` Edge Function validates the token hash, checks the validity window and revocation, and enforces scope per request.
- Every view writes to `inspection_link_view` audit table.

## Rules & Consequences enforced for Agents

- **Good, because** regulators get exactly what they need, nothing more; every view is accountable.
- **Good, because** default anonymization aligns with PII protocol — gaps render `utilgjengelig`.
- **Bad, because** operational burden (justification, revocation hygiene) sits with admins.
- **Agent Impact:** Token MUST be hashed (never stored plaintext). Justification is REQUIRED on create. Scope is enforced on EVERY request, not only at creation. Default is `anonymized` — flipping to `names_visible` requires explicit admin action and is logged. UI is deferred to Phase 4; do not ship UI surfaces before the schema and Edge Function are in place.
