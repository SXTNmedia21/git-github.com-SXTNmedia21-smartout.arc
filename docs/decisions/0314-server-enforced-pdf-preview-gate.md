---
title: "Server-Enforced PDF-Preview Gate"
id: ADR_0314
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [contracts, pdf-gate, sma-310, adr-0244, server-enforcement]
---

# ADR-0314 — Server-Enforced PDF-Preview Gate

## Context

ADR-0244 established that the admin must confirm PDF preview before contract dispatch (Aml. §14-5
bevisbyrde — employer must prove employee received full contract information). Previously, this was
enforced client-side only: the "Send" button was disabled until `pdfViewed === true`. A scripted
request could bypass this gate by omitting the `pdf_preview_viewed_at` field.

## Decision

The PDF preview gate is enforced **server-side** at `/api/contracts/send`:

1. `pdf_preview_viewed_at: z.string().datetime()` added to `SendBodySchema` as **required field**.
   Zod validation fails 400 if field is absent.

2. **Server validation** (before mutation): timestamp must be ISO, must be in the past.
   Future timestamps indicate a forged request. Returns 422 `INVALID_PDF_GATE` + `i18n_key`.

3. **Persistence**: `pdf_preview_viewed_at` persisted to `employment_contract` column (migration
   `20260615200100_employment_contract_pdf_preview_viewed.sql` — `timestamptz NULL`).

4. **Post-persist verification**: SELECT row after UPDATE; if `pdf_preview_viewed_at IS NULL`,
   returns 422 `PDF_GATE_NOT_PERSISTED` and emits `contract.pdf_gate.bypassed_attempt` (attack signal).

5. **Success path**: emits `contract.pdf_gate.enforced` (posthog + logger).

**Error format** (CLAUDE.md i18n constraint — never hardcoded Norwegian in server responses):
```json
{
  "error": "pdf_preview_viewed_at must be a valid past timestamp",
  "code": "INVALID_PDF_GATE",
  "i18n_key": "contracts.send.errors.invalid_pdf_gate"
}
```
Client renders `i18n_key` value from locale file.

**Client side**: `ContractDispatchDrawer` sends `pdf_preview_viewed_at: state.pdfPreviewViewedAt`
in POST body. `pdfViewed` state remains for UX button-disable; server is authoritative.

## Rationale

- Closes L-0107 (third manifestation): UI disable ≠ server enforcement.
- `timestamptz` column enables compliance queries (when did admin confirm PDF read for each contract).
- Post-persist verify catches infrastructure failures (RLS rewrite, failed update) before DocuSeal dispatch.
- `i18n_key` pattern prevents Norwegian text in server responses (CLAUDE.md requirement).
- `contract.pdf_gate.bypassed_attempt` routes to `activity_trail` — security review surface.

## Consequences

- All existing clients sending to `/api/contracts/send` must include `pdf_preview_viewed_at`.
- `ContractDispatchDrawer` must have `pdfPreviewViewedAt` in its state before enablement.
- E2E tests must include `pdf_preview_viewed_at` in POST body.
- Norwegian locale file (`packages/i18n/locales/nb/contracts.json`) requires `contracts.send.errors.*` keys.

## References

- ADR-0244: Aml. §14-5 bevisbyrde — strict/advisory contract enforcement
- ADR-0151: server source of truth
- L-0107: authority appearance ≠ authority presence (third manifestation)
- SMA-310 (PDF-gate server-enforce)
