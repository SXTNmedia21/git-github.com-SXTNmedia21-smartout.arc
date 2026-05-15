---
title: "User-friendly error messages with traceable error codes"
id: ADR_0328
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
---

# ADR-0328: User-friendly error messages with traceable error codes

## Context and Problem Statement

Current error surfaces in Smartout are cryptic and operator-unfriendly. Examples
observed during invite-flow debugging (2026-05-14):

- Browser toast: `Edge Function returned a non-2xx status code`
- Edge Function body: `{"error":"internal"}`
- Edge Function body: `Misconfigured`
- Next.js route handler: `{"error":"Failed to create invitation"}`

These messages tell the user nothing actionable and tell the operator nothing
traceable. There is no consistent contract between server and UI — every
function invents its own error shape. The UI cannot decide whether to show
the message verbatim, fall back to a generic banner, or open a runbook link.

We need (1) a single error envelope so the UI can render consistently, (2) a
user-readable message in Norwegian so end-users can act, (3) a stable error
code so support can grep logs and link to a known fix, and (4) a documentation
link so the user (or operator) can read what the code means.

## Decision Drivers

- **End-user trust** — opaque errors erode confidence; the system feels broken when it just needs a missing field
- **Support velocity** — stable error codes let Pontus / support grep `activity_trail` and `engine_event` for occurrence patterns
- **Operator debugging** — a single envelope means one place to look in console, one place to log structured
- **Bilingual surface** — user-facing strings must be Norwegian; codes stay English for greppability
- **Consistency across tiers** — Edge Functions, Next.js route handlers, BFF, and UI all emit/handle the same shape
- **Backward compatibility** — must coexist with existing string-only errors during migration

## Considered Options

1. **Status quo** — leave each function to invent its error shape. UI shows raw `error` field.
2. **Code + message envelope (chosen)** — standard envelope: `{code, message, docs_url, details?}`. UI renders message + "Les mer" link. Docs catalog at `docs/errors/`.
3. **Sentry-only** — push errors to Sentry, show generic "Noe gikk galt" to user. Loses end-user actionability.
4. **i18n keys instead of codes** — emit `{i18n_key, params}`. Forces i18n resolution server-side; less greppable than codes.

## Decision Outcome

Chosen option: **"Code + message envelope"**, because it gives end-users
actionable text in Norwegian, gives support a stable identifier for log
correlation, and gives the UI a single contract to render against. It also
composes with i18n (the `message` itself can be an i18n key resolved at the
edge) and with Sentry (the `code` becomes a Sentry fingerprint).

### Error envelope schema

```ts
type ErrorEnvelope = {
  ok: false;
  code: string;          // Stable identifier, e.g. "ERR_INVITE_TOKEN_INVALID"
  message: string;       // User-readable Norwegian, e.g. "Invitasjonslenken er ugyldig eller utløpt."
  docs_url: string;      // e.g. "https://app.smartout.ai/errors/ERR_INVITE_TOKEN_INVALID"
  details?: unknown;     // Optional debug payload — NEVER includes secrets or PII
  trace_id?: string;     // Sentry/Datadog trace correlation
};
```

Success responses do NOT use this envelope — they return the resource directly.
The `ok: false` discriminator lets the UI distinguish success-with-`error`-field
edge cases from real errors.

### Error code convention

| Pattern | Example |
|---|---|
| `ERR_<DOMAIN>_<REASON>` | `ERR_INVITE_TOKEN_INVALID`, `ERR_AUTH_SESSION_EXPIRED`, `ERR_PAYROLL_PERIOD_LOCKED` |

- UPPER_SNAKE_CASE, ASCII only
- Max 48 chars
- Domain matches capability or schema namespace (`INVITE`, `AUTH`, `PAYROLL`, `SCHEDULE`, etc.)
- Stable: never renamed once shipped — superseded codes get a new identifier and the old one is marked deprecated in `docs/errors/`

### Catalog location

`docs/errors/<code>.md` — one file per error code, frontmatter required:

```markdown
---
code: ERR_INVITE_TOKEN_INVALID
title: "Ugyldig eller utløpt invitasjonslenke"
http_status: 400
introduced: 2026-05-14
deprecated: null
---

## Hva skjedde
Invitasjonslenken du brukte er enten ugyldig eller har utløpt.

## Hva du kan gjøre
1. Be om en ny invitasjon fra arbeidsgiver
2. ...

## For operatører
Common causes: token mismatch, TTL expired (>7d), already-consumed.
Log fields: `invitation_id`, `consumed_at`.
```

A registry script (`infra/scripts/error-catalog-check.sh`) verifies every
emitted code has a `docs/errors/<code>.md` and every catalog entry is still
referenced somewhere in code. Runs in CI.

### Server-side helper

`supabase/functions/_shared/errors.ts` and `apps/web/src/lib/errors.ts` both
expose the same shape:

```ts
export function makeError(
  code: string,
  message: string,
  opts?: { status?: number; details?: unknown },
): Response {
  return Response.json(
    {
      ok: false,
      code,
      message,
      docs_url: `https://app.smartout.ai/errors/${code}`,
    },
    { status: opts?.status ?? 400 },
  );
}
```

Edge Functions, route handlers, and BFF endpoints MUST use the helper. No
ad-hoc `Response.json({error: "..."})` for error paths.

### Client-side rendering

UI surfaces (toasts, dialogs, banners) MUST:

1. Display `message` verbatim (already Norwegian)
2. Render a "Les mer" link to `docs_url`
3. Show `code` in a small monospace footer (for support to read)
4. NEVER display `details` to end-users (operator-only via console / Sentry)
5. NEVER display the raw HTTP status or "non-2xx" string

A new shared component `<ErrorBanner code message docs_url />` in
`packages/ui/` becomes the canonical render path. `sonner.error()` is wrapped
to call it.

### Migration strategy

- **Phase 1 (this ADR):** ship helper + 10 highest-traffic error codes in
  invite/auth/payroll/schedule paths. Catalog them. Wire `ErrorBanner`.
- **Phase 2:** every new Edge Function or route handler MUST emit the envelope
  (enforced by `adr-contract-audit` skill check).
- **Phase 3 (3-month sweep):** migrate all existing error sites. Anything
  still emitting raw strings becomes an audit finding.

Legacy clients that don't understand the envelope can read `message` as a
plain string (it always exists), so the envelope is backward-compatible.

### Non-goals

- This ADR does NOT define i18n for `message` — for now Norwegian is the only
  supported locale. Multi-locale is deferred to a follow-up ADR.
- This ADR does NOT mandate Sentry coverage — `trace_id` is optional and
  populated when Sentry is configured.
- This ADR does NOT cover validation-error shape inside the envelope (field-level
  Zod errors). A follow-up ADR will define the `details` schema for
  validation-class errors specifically.

## Consequences

### Positive

- End-users see useful Norwegian errors with "Les mer" links
- Support can grep one column in `activity_trail` for error codes
- New developers find a single helper + a single catalog instead of 30 ad-hoc shapes
- Audit skill can verify every code in code has a docs file and vice versa

### Negative

- Migration cost — ~60 Edge Functions + dozens of route handlers must be touched
- Catalog discipline — every new error code is a doc-write; risk of stale entries (mitigated by registry check in CI)
- Risk of code-fatigue — too many fine-grained codes lose meaning. Mitigation: review every PR that adds >2 new codes; consolidate aggressively

### Neutral

- Error rendering becomes a UI-component concern, not a per-page concern
- `details` field becomes a new vector for accidental PII leakage — mitigated by linting + code review

## Reference

- `_shared/errors.ts` (to be created)
- `apps/web/src/lib/errors.ts` (to be created)
- `packages/ui/src/error-banner.tsx` (to be created)
- `docs/errors/` (catalog, to be created)
- `infra/scripts/error-catalog-check.sh` (CI gate, to be created)
- Related: ADR-0179 (browser → route handler, not Edge Function), ADR-0265 (deploy pipeline)
