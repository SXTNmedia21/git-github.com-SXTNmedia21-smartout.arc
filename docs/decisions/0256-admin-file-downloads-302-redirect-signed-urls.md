---
title: "Admin file downloads via 302-redirect to short-TTL signed Storage URLs"
id: ADR_0256
status: accepted
layer: decision
created: 2026-05-02
updated: 2026-05-02
module: billing
tags: [apps-admin, storage, downloads, security, telemetry]
---

# ADR-0256: Admin file downloads via 302-redirect to short-TTL signed Storage URLs

## Context and Problem Statement

`apps/admin` (admin.smartout.ai) is the accountant-facing app for Erik. M7 introduces settlement artifacts — four PDFs/CSVs per settlement run — that must be downloadable by the accountant. The admin app will accumulate further download endpoints over time: invoice PDFs, audit exports, GDPR exports. Without a canonical pattern, each engineer would independently re-derive the redirect-vs-proxy choice, pick an arbitrary signed-URL TTL, and may omit the access telemetry that makes downloads auditable under Bokføringsloven.

## Decision Drivers

- Downloads must be gated on authenticated accountant identity (`getAccountantUserId`) — public Storage URLs are not acceptable.
- Settlement artifacts are stored in Supabase Storage (private bucket); the download pattern must work with the existing storage layout.
- Every download must appear in `activity_trail` for audit coverage (ADR-0004).
- Server Actions cannot return `Response` / redirect objects — they are not viable for download endpoints.
- Minimise bandwidth cost and latency: streaming artifact bytes through the server wastes resources vs a CDN-served signed URL.

## Considered Options

1. **302-redirect to short-TTL signed Storage URL** (via Next.js Route Handler)
2. **Stream artifact bytes through a Server Action** (base64 or stream)
3. **Direct Storage public URL** (no auth gate)
4. **Supabase Edge Function** (workspace-api gateway, ADR-0039)

## Decision Outcome

Chosen option: **"302-redirect to short-TTL signed Storage URL"**, because it is the cheapest-correct pattern: auth is enforced server-side, the browser receives a CDN-served file directly, and the signed URL expires before it can be forwarded usefully.

**Implementation contract:**

- Endpoint type: Next.js Route Handler (`route.ts`) — not a Server Action, not an Edge Function.
- Auth: `getAccountantUserId(request)` must resolve before any Storage call. Missing/invalid session → 401.
- Ownership re-check: query the entity row via the service-role client after JWT auth; verify `entity.initiated_by === userId` or equivalent ownership field. Mismatch → 403.
- Signed URL TTL: **60 seconds**. Short enough to prevent URL leakage via copy-paste or logs; long enough for browser handoff.
- Client used to generate the signed URL: **service-role Supabase client** (Storage signing requires service role).
- Telemetry: `emit()` call on every access to populate `activity_trail`. Emit MUST be **fire-and-forget** (`void emit(...)`) — do NOT await it, to avoid blocking the 302 response.
- Response: `NextResponse.redirect(signedUrl, { status: 302 })`.

## Rules & Consequences

- **Good, because** every admin download is auditable in `activity_trail` with zero extra infrastructure.
- **Good, because** artifact bytes are served by Supabase CDN, not proxied through the Next.js server — zero bandwidth overhead.
- **Good, because** 60-second TTL makes leaked URLs effectively useless.
- **Bad, because** each new download endpoint requires ~4 lines of boilerplate (auth + ownership + signedUrl + emit + redirect). Mitigation: extract a `createArtifactDownloadHandler(config)` helper if a third distinct download endpoint appears.
- **Risk:** if `emit()` is awaited, a slow telemetry write will delay the 302. Always fire-and-forget.
- **Agent Impact:** any engineer adding a download endpoint in `apps/admin` must follow this pattern. No alternative patterns (proxy, public URL, Server Action) are permitted without a new ADR.

---

## References

- ADR-0039 — workspace-api gateway boundary (explains why Edge Functions are wrong here)
- ADR-0004 — Unified Telemetry & Audit Trail Engine
- L-0177 — forgeable-ID class (ownership re-check rationale)
- M7c implementation: `apps/admin/src/app/api/avstemming/[run_id]/artifact/[type]/route.ts`

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
