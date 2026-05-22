---
title: "Multimodal image-storage contract (Storage path + tool-scoped vision)"
id: ADR_0395
status: accepted
layer: decision
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [procedure-engine, multimodal, vision, storage, stage-engine, mobile]
---

# ADR-0395: Multimodal image-storage contract — Storage path + tool-scoped vision

## Context and Problem Statement

The 2B procedure-engine capture-to-author flow (ADR-0394) must move a photo from the mobile
device to a vision model and produce a structured `RoutineDraft`. Three design questions arise:

1. **Transport format:** base64 passthrough vs Supabase Storage path.
2. **Extraction architecture:** inject the image into the main agent chat loop vs a dedicated
   extraction route.
3. **BFF surface:** where does the mobile client call, and who proxies to stage-engine.

The naive solution — base64 the image in a chat message and let the agent loop handle it — is
cheap to prototype but creates bloat in every turn's context, loses the image after the session,
and mixes vision concerns into the general-purpose agent loop.

Spec: `docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md` §3 + §5.

## Decision Drivers

- Image provenance must be durable — the source image is a legal artifact for workplace procedure
  documentation; it must survive beyond the Botsson session.
- The main agent chat loop must remain text-only — multimodal capability must not leak into
  every tool call's context window (token cost + complexity).
- ADR-0132 mobile thin client — no authoring/extraction logic on device; BFF proxies.
- ADR-0393 `routine.source_reference` — the committed routine must carry a reference back to the
  source image; a Storage path is the natural FK-less reference.
- Short-lived URL security — the vision model must receive an accessible URL, but that URL must
  not be embeddable in client responses or logs.

## Considered Options

1. **Storage path + dedicated `/routine/extract` route + BFF proxy** (chosen) — image stored in
   `routine-source` bucket; BFF mints a short-lived service-role signed URL; stage-engine runs
   `generateObject` on a dedicated route; main agent loop is untouched.
2. **Base64 passthrough via chat message** — image sent as base64 in a user chat turn;
   agent loop handles extraction inline. Rejected: base64 bloats every subsequent turn's context
   window; image is ephemeral (session only, no provenance); vision concern bleeds into general loop.
3. **Client uploads directly to storage, passes URL to chat** — device uploads, then sends public
   URL in a chat message to trigger extraction. Rejected: public bucket = security risk;
   vision still runs in the main loop; no BFF gate.

## Decision Outcome

Chosen option: **Option 1**.

### Storage contract

- **Bucket:** `routine-source` — private, not publicly accessible.
- **Upload path:** `{workspace_id}/{routine_id}/{timestamp}-{uuid}.{ext}`.
  Mobile uploads via a presigned URL minted by `POST /api/mobile/routine/upload-url` (BFF).
  The BFF enforces workspace ownership before minting. Device receives the Storage path
  (not the signed URL) as the receipt; the path becomes `routine.source_reference`.
- **Access:** Only service-role signed URLs, minted on demand by stage-engine's extract handler.
  Short TTL (60 s) — never cached, never returned to client.

Migration `20260623100500` creates the bucket and RLS policies (workspace-scoped read via
service role only; no anon/public access).

### Vision architecture

- **Single multimodal touch point:** `POST /routine/extract` on stage-engine.
  Receives `{ storagePath, workspaceId }`. Mints signed URL internally. Calls
  `generateObject` (Vercel AI SDK) with the image URL + extraction schema.
  Returns `RoutineDraft` (title, steps[], notes, suggested governance).
- **Main agent loop untouched:** `/agent/chat` and all existing Botsson capability tools remain
  text-only. No multimodal message injection into the running conversation.
- **Schema:** `RoutineDraft` is a Zod schema (`packages/ai/src/schemas/routine-draft.ts`),
  validated on the stage-engine response before the BFF forwards it to the client.

### BFF mobile routes (Arch B thin proxies, ADR-0132)

| Route | Method | Purpose |
|---|---|---|
| `/api/mobile/routine/upload-url` | POST | Mint presigned upload URL for `routine-source` bucket |
| `/api/mobile/routine/extract` | POST | Proxy to stage-engine `/routine/extract`; returns `RoutineDraft` |
| `/api/mobile/routine/commit` | POST | Validate human edits; insert `routine` row with `created_via=camera_capture` + `source_reference`; emit telemetry |

All three routes: JWT-authenticated, workspace ownership enforced server-side (ADR-0151),
`workspace_id` never trusted from body (derived from JWT).

### Provenance chain

```
device camera
  → presigned upload → routine-source/{workspace_id}/{routine_id}/…
  → /routine/extract (service-role signed URL, 60s TTL) → vision model
  → RoutineDraft (validated Zod)
  → human confirm (C4 gate, ADR-0394)
  → /routine/commit → routine row {created_via: camera_capture, source_reference: <path>}
```

The Storage path in `source_reference` is the durable link — even if the signed URL expires,
the object remains and can be re-accessed with service-role credentials.

## Rules & Consequences

- **Good, because** the stored image is a durable provenance artifact; the routine can always be
  traced back to its source image via `source_reference`.
- **Good, because** base64 bloat is eliminated from the agent loop; every text turn stays lean.
- **Good, because** the main chat loop is untouched — `generateObject` runs on a dedicated route,
  not injected into existing tool/capability infrastructure.
- **Good, because** short-TTL signed URLs ensure the vision model accesses the image but the URL
  is never a leak surface in logs or client responses.
- **Bad, because** the `routine-source` bucket is a new storage surface that needs operational
  retention and cleanup policies (images accumulate; lifecycle rules are future work).
- **Bad, because** a 60-second signed URL TTL can fail under high latency or cold-start
  conditions. Mitigation: stage-engine mints the URL immediately before the `generateObject` call
  (not at request ingress). Future work: increase TTL or mint inside the extraction closure.
- **Agent Impact:** The ONLY multimodal call in the 2B flow is `generateObject` inside
  `/routine/extract`. Do NOT inject image URLs or base64 into agent chat turns. Do NOT access
  `routine-source` bucket objects without service-role credentials. Mobile BFF routes follow the
  `/api/mobile/*` thin-proxy pattern — no business logic on device. `source_reference` on a
  committed routine is the Storage path (not a signed URL) — always re-mint before passing to
  the vision model.

Refs: ADR-0393 (brownfield routines + `source_reference` column), ADR-0394 (mobile carve-out,
C4 human-confirm gate), ADR-0132 (mobile thin client + BFF pattern), ADR-0151 (server-derived
identity, workspace ownership), ADR-0136 (camera evidence as cascade extension).
Spec: `docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md` §3 + §5.

---

> Registered in `docs/decisions/0000-decision-log.md`.
