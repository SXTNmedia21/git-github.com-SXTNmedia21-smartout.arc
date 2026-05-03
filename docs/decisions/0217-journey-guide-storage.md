---
title: "Journey Guide Storage — Dedicated `journey_guide` DB Table"
id: ADR-0217
status: accepted
layer: decision
created: 2026-04-27
updated: 2026-04-27
module: journey-engine
tags: [journey-engine, publish-guide, journey-guide, storage, rls, versioning]
---

# ADR-0217: Journey Guide Storage — Dedicated `journey_guide` DB Table

## Context and Problem Statement

`journey.publish_guide` (ADR-0173, one of the four frozen capability names) is
currently neutered: it returns `{ok:false, error:"not_implemented"}` and emits
no telemetry (ADR-0196 Invariant 11 compliance). The comment in `tools.ts` at
the stub explicitly names the missing decision:

> "USER-GUIDE generator wiring requires ADR decision on storage (Supabase
> Storage vs journey_guide DB table)."

Before the body work can proceed, the canonical storage target for the
MDX-formatted USER-GUIDE artefact must be settled. The choice determines the
write path in the capability body, the read path for the admin UI and
runtime users, and the RLS model.

## Decision Drivers

- **RLS uniformity** — every workspace-scoped table in Smartout carries
  `workspace_id` RLS using the same JWT-claim pattern (ADR-0004, established
  schema conventions). A Supabase Storage bucket is a separate RLS surface
  (object path–based policies) that would require a parallel policy regime.
- **Queryability** — the admin UI must be able to list all published guides for
  a workspace, filter by `journey_version_id`, and surface creation/update
  timestamps without a secondary index table. A DB table supports this natively;
  Storage requires a sidecar metadata table anyway (doubling the surfaces).
- **Transactional consistency** — the `publish_mission` body (landed
  `e5326401`) already demonstrates the pattern: insert the main row, insert
  child rows, emit only on success. `journey_guide` is a single-row artefact;
  the write is one INSERT and trivially atomic.
- **Content size** — a USER-GUIDE for a typical journey (10–20 steps, prose
  description, 1–2 sections per step) produces ≤ 32 KB of MDX. Well inside
  Postgres TEXT column operating range; large-row bloat is a concern only above
  ~1 MB per row. Journey guides will not approach that threshold.
- **Operational simplicity** — Supabase Storage adds a second operational
  surface (bucket lifecycle, CDN rules, access-key management). No other
  Journey Engine artefact uses Storage; introducing it here adds complexity
  that does not pay off at ≤ 32 KB content.
- **Cost** — Supabase Pro Storage costs $0.021 / GB-month plus $0.09 / GB
  egress beyond the free tier. At ≤ 32 KB per guide, 10 000 published guides
  = ~320 MB → < $0.01 / month in storage, but egress (serving guides to users)
  is charged by bandwidth. Serving MDX from Postgres via the API Gateway
  (included in Pro) is effectively free at these sizes. Storage would save
  nothing meaningful while adding egress cost and surface complexity.

## Considered Options

1. **Supabase Storage bucket** — MDX written as objects; metadata stored
   separately in a sidecar table or `journey_version` extension columns.
2. **Dedicated `journey_guide` DB table** — MDX stored in a `TEXT` column;
   relational FK to `journey_version`; standard RLS + workspace isolation.

## Decision Outcome

Chosen option: **Option 2 — dedicated `journey_guide` DB table**, because it
provides uniform workspace-scoped RLS, transactional consistency with the rest
of the engine schema, native queryability without a sidecar, and no
meaningful cost or size advantage for guides that will remain well under 1 MB.

---

## Rules & Consequences

- **Good, because** workspace_id RLS is enforced by the same JWT-claim
  policies used across all engine tables — no new policy regime, no parallel
  access-key surface.
- **Good, because** the capability body follows the same insert → emit pattern
  established by `publish_mission` (ADR-0194). Tooling, testing, and review
  patterns transfer directly.
- **Good, because** the admin UI can list, filter, and paginate guides with a
  single `supabase.from("journey_guide").select(...)` call — no storage
  list + sidecar join.
- **Good, because** migrations are the single write path (ADR-0013 convention);
  no bucket lifecycle rules, no CDN configuration, no separate access-key
  rotation.
- **Bad, because** very large guides (edge case: auto-generated docs for
  journeys with 100+ steps or embedded code blocks) inflate row size. Mitigation:
  a column CHECK constraining `length(mdx_content) < 1048576` (1 MB) at the
  DB layer; anything beyond that requires a bespoke content pipeline (out of
  scope for Journey Engine v1).
- **Bad, because** serving raw MDX at high request volume (future public guide
  pages) bypasses CDN caching. Mitigation: a Next.js ISR (Incremental Static
  Regeneration) route at `apps/web/app/guides/[slug]/page.tsx` reads from DB
  once and caches at the edge; the DB is not hot-path for end users.
- **Agent Impact:** The `publish_guide` capability body MUST insert into
  `journey_guide`, not write to Supabase Storage. Any future contributor
  considering a Storage migration must open a superseding ADR and migrate RLS
  policies atomically.

---

## Detailed Specification

### Table Schema

```sql
CREATE TABLE journey_guide (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  journey_version_id UUID NOT NULL REFERENCES journey_version(journey_version_id) ON DELETE CASCADE,
  journey_id       UUID NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  slug             TEXT NOT NULL,            -- mirrors journey.slug; used as URL key
  version_number   INTEGER NOT NULL,         -- mirrors journey_version.version_number
  title            TEXT NOT NULL,
  mdx_content      TEXT NOT NULL CHECK (length(mdx_content) < 1048576),
  is_public        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (journey_version_id)               -- one guide per version snapshot
);
```

The `UNIQUE (journey_version_id)` constraint makes re-publish idempotent via
`ON CONFLICT (journey_version_id) DO UPDATE SET mdx_content = EXCLUDED.mdx_content,
updated_at = now()` — same pattern as `engine_missions` upsert semantics.

A `UNIQUE (workspace_id, slug, version_number)` composite index supports
URL routing (`/guides/<slug>/v<version_number>`) without table scans.

### Write Path

```
admin UI → Server Action → journey.publish_guide capability tool
  1. ADR-0134 guard: workspaceId + profileId non-empty.
  2. Load journey_version (ir_json, journey_id, version_number) — workspace-scoped.
  3. Load parent journey (slug) — workspace-scoped.
  4. Generate MDX via JourneyIR → USER-GUIDE generator (packages/journey-ir).
  5. callGateAction() — ADR-0196 Invariant 13: mandatory regardless of authority default.
  6. INSERT INTO journey_guide (... mdx_content = generatedMdx ...).
  7. emit("journey run_started") — ONLY after successful INSERT (ADR-0196 Invariant 11).
  8. Return {ok:true, guide_id, slug, version_number}.
```

Step 5 (gate before mutation) matches the `publish_mission` ordering. The
`emit` follows the last successful DB write — same phantom-prevention invariant.

### Read Path

**Admin UI (platform-admin/journeys):**
```ts
supabase
  .from("journey_guide")
  .select("id, slug, version_number, title, is_public, created_at")
  .eq("workspace_id", workspaceId)
  .order("created_at", { ascending: false })
```
Renders a listing card (title, published date, public/private badge, "View"
link). No Storage API calls.

**Runtime user-facing (ISR page):**
Next.js route `apps/web/app/guides/[slug]/page.tsx`:
```ts
// Runs at build time + revalidates on-demand (ISR).
const { data } = await supabase
  .from("journey_guide")
  .select("mdx_content, title, is_public")
  .eq("slug", slug)
  .eq("workspace_id", workspaceId)  // resolved from subdomain / tenant header
  .eq("is_public", true)
  .order("version_number", { ascending: false })
  .limit(1)
  .single();
```
MDX rendered via `@mdx-js/mdx` at the Next.js layer; HTML served from edge
cache. DB read is build-time only (ISR), not request-time.

### RLS Model

```sql
-- Workspace members can read their own workspace's guides (private or public).
CREATE POLICY "workspace_member_read" ON journey_guide
  FOR SELECT USING (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
  );

-- Public guides are readable without auth (anonymous + authenticated).
CREATE POLICY "public_guide_read" ON journey_guide
  FOR SELECT USING (is_public = true);

-- Service-role (capability tool body) can insert/update.
CREATE POLICY "service_role_write" ON journey_guide
  FOR ALL USING (auth.role() = 'service_role');
```

API key (service role) policies follow the dual-auth pattern established by
ADR-0004 / ADR-0054. The capability body runs as service role via
`ctx.supabaseAdmin`; the admin UI reads via the JWT session token (workspace
member read policy).

### Versioning

- **One guide per `journey_version_id`** (unique constraint). A version is an
  immutable snapshot of the IR; its guide is equally immutable once published.
- **Re-publish** of the same `journey_version_id` upserts: new MDX overwrites,
  `updated_at` refreshes. This is the intended correction flow (author noticed
  a typo in the generated MDX → re-triggers `publish_guide` → same DB row
  updated atomically).
- **New journey version** → new `journey_version_id` → new `journey_guide`
  row. Older guide rows remain (historical archive; admin UI can list all
  versions per journey slug).
- There is no automatic archive/deprecation of older guide versions. M4
  authoring UI may add a "set as canonical" flag later (out of scope for
  this ADR).

### Cost / Ops

| Metric | Estimate |
|--------|---------|
| Guide size (avg) | ~16 KB MDX |
| Guides per workspace (1-year) | ~50 |
| Workspaces on Pro plan (yr 1) | ~100 |
| Total data | ~80 MB |
| Supabase Pro DB storage cost | Included in Pro ($25/mo base) up to 8 GB |
| Supabase Storage (alternative) | $0.021/GB-mo storage + $0.09/GB egress; 80 MB < $0.01/mo storage, but egress charges accumulate with traffic |
| Operational surfaces | DB only (vs DB + Storage bucket + CDN rules) |

DB storage wins on cost at this scale. If a future workspace generates > 100 MB
of guide content (unlikely before series A), the mitigation is Postgres
TOAST compression (automatic for TEXT > 2 KB) + a periodic cold-tier archive
job — both simpler than a Storage migration.

---

> After writing: registered in `docs/decisions/0000-decision-log.md`.
> Campaign CLAUDE.md references ADR-0217 under "Binding ADRs" when the
> `publish_guide` body sub-sortie opens.
