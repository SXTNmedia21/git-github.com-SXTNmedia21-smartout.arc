---
title: User Journeys — Platform K1a Template Curation
status: draft
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [contracts, platform-admin, k1a, curation, industry-intelligence, journey]
---

# User Journeys — Platform K1a Template Curation

> Pontus's flow for curating the K1a industry template catalog. Platform admin owns the system-level templates that workspaces fork from via `JOURNEY-workspace-template-fork.md`. This journey covers catalog CRUD, version publishing, and cross-workspace drift distribution view. Visual parity with workspace `Maler` tab — Nordic Split applied consistently across both surfaces.

## Roles

- **Platform Admin (Pontus)** — full CRUD on K1a templates; owns clause_library; seeds industry-default bindings via I1 bootstrap
- **Workspace Admin** — NEVER appears in this journey; their surface is `/dashboard/contracts` hub
- **Botsson (platform mode)** — currently no platform-scope capability; all curation is manual in Phase 1

---

## Journey 1: Platform admin lists the K1a catalog

**Precondition:** User is authenticated with `user_identity.is_godmode = true` (platform admin gate).

1. Platform admin navigates to `/platform-admin/contracts/templates`
   → Route verifies `getSuperAdminId()` before rendering (server-side check)
   → Non-godmode users redirected to `/dashboard`
2. System renders catalog page with Nordic Split styling (parity with workspace `Maler` tab)
   → Heading: Instrument Serif `K1a Industribibliotek`
   → Subtitle: `Maler tilgjengelig for alle arbeidsflater i en bransje`
   → Ambient orb low-right (hue 50, 25% opacity)
3. Filter chips top row (ghost style, active chip gets brand fill):
   → Industry: `Hospitality · Retail · Healthcare`
   → Status: `Utkast · Publisert · Arkivert`
   → Version: `Aktiv · Alle`
4. Content layout mirrors workspace: left zone = template list, right zone = workbench
5. Each template row: Instrument Serif name, Geist Sans one-line description, Geist Mono metadata (`47 arbeidsflater bruker denne · Publisert 2026-03-14 · v2.3`)
6. Hover row: `bg-muted` lift, reveals right-aligned `Rediger` + `Se distribusjon` actions

**Postcondition:** Platform admin sees the full K1a catalog filtered by industry/status/version with Nordic Split consistency.

**Error paths:**
- User not godmode: redirect to `/dashboard` with toast `Krever plattform-admin-rolle`
- No templates at all: empty state `Ingen K1a-maler enda — lag din første` with CTA `Ny mal`

---

## Journey 2: Platform admin edits a K1a template

**Precondition:** Platform admin selected a template in catalog left zone.

1. Right zone renders template workbench (same component as workspace, role-gated actions)
2. Workbench header:
   → Template name (editable inline)
   → Version badge: `v2.3` muted
   → Metadata: `Publisert 2026-03-14 · 47 arbeidsflater bruker denne · 3 har avviket klausuler`
   → Primary action (top-right): `Publiser ny versjon` (deliberate — requires version bump)
3. Platform admin edits clauses via Tiptap (full formatting toolbar, insert-section, remove-section, reorder available)
   → These authoring tools are wired ONLY to platform-admin scope per ADR-0133 supervisor scope fence
4. `Lagre endringer` saves to draft state
   → Does NOT bump `version` — that's a separate publish action
5. Admin can preview the rendered document (same `ContractPreviewEditor` component as workspace)

**Postcondition:** K1a template `content_html` updated at current version (draft edits). Workspaces have not yet received the update (they see the published version).

**Error paths:**
- Non-godmode user reaches edit route via URL tampering: 403
- Tiptap content exceeds size limit (>2MB): toast error + last-saved state retained

---

## Journey 3: Platform admin publishes a new K1a version

**Precondition:** Draft edits exist; admin wants to propagate to workspaces (as drift signals, not auto-apply).

1. Platform admin clicks `Publiser ny versjon`
2. Dialog opens with:
   → New version input (suggested bump: `2.3` → `2.4`; editable for manual overrides like `3.0` major bumps)
   → Changelog textarea (required, min 20 chars): `Hva endret seg? Dette vises til arbeidsflater som har klonet denne malen.`
   → Confirm + Cancel buttons
3. Platform admin fills changelog, clicks Confirm
   → System calls `POST /platform-admin/api/contracts/templates/[id]/publish-version`
   → Route writes new `contract_template` row (or updates `version` + appends to changelog history) depending on schema implementation (open design question — see debt below)
   → Route emits `contract_template published` event
4. All workspaces with forks at `source_template_version < new_version` will now see amber drift chip on next view (see `JOURNEY-cascade-drift-observability.md`)

**Postcondition:** K1a template has new version. Workspaces not auto-updated; drift observability kicks in.

**Error paths:**
- Changelog too short: dialog validation blocks submit
- Version number conflicts (version already exists): dialog shows error `Versjon X finnes allerede`
- Publishing a K1a template with `is_system = false` reaches this path: 403 (should not happen via UI)

---

## Journey 4: Platform admin sees cross-workspace drift distribution

**Precondition:** Platform admin selected a K1a template that has been forked by multiple workspaces.

1. Platform admin clicks `Se distribusjon på tvers av arbeidsflater`
2. Distribution view renders (right zone replaces workbench):
   → Heading: `Hvordan bruker arbeidsflater 'Hospitality Fulltid'?`
   → Histogram or stacked bar chart (lightweight — no Recharts overkill in Phase 1):
     - Column: Version groups (`v2.3 — 32 arbeidsflater`, `v2.2 — 12 arbeidsflater`, `v2.1 — 3 arbeidsflater`)
     - Column: Diverged clauses (`Like som system — 41 · Har avveket — 6`)
   → Table below: workspace name | version | forked_at | clauses_diverged | last_used_at
3. Platform admin can click a workspace row to see its specific fork + diff against current K1a
   → Opens diff drawer (same component as workspace but cross-tenant read — godmode access)

**Postcondition:** Platform admin sees adoption patterns and can identify workspaces that need outreach (e.g. stuck on v2.1 for 6 months).

**Error paths:**
- No workspaces have forked this template: empty state `Ingen arbeidsflater har klonet denne malen enda`
- Workspace data access fails (RLS issue): skeleton with retry; godmode should bypass RLS via admin client

---

## Journey 5: Platform admin manages clause_library

**Precondition:** Platform admin wants to add, edit, or retire a canonical clause used in K1a templates.

1. Platform admin navigates to `/platform-admin/contracts/clauses` (or a subtab of the templates page — design TBD)
2. List renders: clauses with industry_codes, contract_types, language, tags, is_active
3. Admin edits a clause's `content_html`
   → Note: this does NOT propagate to templates that have already inlined the clause (inline-clause drift documented in ADR-0181 known debt)
   → Warning: `Denne klausulen er inkludert i 12 K1a-maler. Endringer påvirker kun maler som refererer den direkte (ikke inlinede kopier).`
4. Admin saves
   → System calls `PUT /platform-admin/api/contracts/clauses/[id]`
   → Emits `clause_library updated` event (follow-up telemetry, out of current Gate G2 scope)

**Postcondition:** Clause updated. Templates referencing it by ID (if clause-reference extraction lands in Phase 5) pick up the change; inline-copy templates do not.

**Error paths:**
- Clause referenced by active K1a templates: admin sees usage list before save
- Non-godmode: 403 (route-level gate)

---

## Journey 6: Platform admin seeds industry-default bindings (I1 bootstrap)

**Precondition:** New workspace is created with a specific industry (e.g. `hospitality`); I1 bootstrap runs before any admin interaction.

1. Workspace creation triggers I1 bootstrap (platform-owned, runs server-side)
   → Code path: `packages/ai/src/industry/loader.ts` loads industry package
   → Industry package defines default K1a templates per employment_category (Fast / Deltid / Tilkalling)
   → Platform's SQL templates in `supabase/templates/restaurant/` apply on fresh workspace
2. Bootstrap inserts `contract_template_binding` rows:
   → Default: `(workspace_id, employment_category='fast', template_id=<hospitality fulltid k1a>)` with `priority=1000`
   → Repeated for deltid + tilkalling categories
3. Workspace admin later sees these as pre-filled bindings on `Bindinger` tab, can override or deprecate
4. No platform-admin UI action needed for bootstrap — it happens automatically
5. Platform admin CAN curate which K1a templates are the industry default (via a `is_industry_default` flag on the template or via priority in a dedicated bindings table — TBD)

**Postcondition:** Every new workspace starts with sensible K1a defaults pre-bound. Workspace admin is never stuck on a blank Bindinger tab.

**Error paths:**
- I1 bootstrap fails: workspace creation completes but Bindinger tab is empty; admin sees curated catalog preview instead (per `JOURNEY-contract-hub-redesign.md` Journey 3)
- Industry package missing for the workspace's industry: bootstrap skips; workspace gets empty bindings; admin forks manually

---

## Cross-cutting concerns

### Platform vs workspace scope isolation

| Action | Platform Admin | Workspace Admin |
|---|---|---|
| Create K1a template (`is_system=true`) | ✓ | ✗ |
| Edit K1a clauses | ✓ | ✗ |
| Publish K1a version | ✓ | ✗ |
| See cross-workspace distribution | ✓ | ✗ |
| Manage clause_library | ✓ | ✗ |
| Fork K1a → K1b | ✗ (not their tenant) | ✓ |
| Edit K1b clauses | ✗ | ✓ |
| Accept upstream drift (Phase 5) | ✗ | ✓ (own tenant only) |
| Seed I1 industry-default bindings | ✓ (via platform tool) | ✗ (receives defaults) |

### Gate G3 — is_system immutability

Trigger prevents anyone (including service_role via Edge Functions) from flipping `is_system=true` to `false` or vice versa after creation. K1a templates stay K1a; K1b stays K1b.

### Visual parity (Nordic Split)

- Same ambient orb, same Instrument Serif headings, same typography hierarchy
- Same `AnimatedWizardShell` spring values (stiffness 35, damping 22, mass 2.2)
- Same workbench two-column layout (clause list + placeholder inspector)
- Same cascade chip rendering (but platform sees "Publisert v2.3 · 47 arbeidsflater bruker" instead of lineage-to-parent)
- Removes existing raw `<Table>` + zinc-* violations in `/platform-admin/contracts/templates/page.tsx` — migration required as part of Phase 2

### Telemetry

- `contract_template forked` — emitted on workspace clone (Journey 1 of `JOURNEY-workspace-template-fork.md`)
- `contract_template published` — emitted on platform publish (Journey 3 here) AND on workspace publish (`JOURNEY-workspace-template-fork.md` Journey 3) — same event name, different actor scope
- `contract_template deprecated` — emitted on platform archive OR workspace deprecate

All events registered per Gate G2.

### Authority (Platform-side C4)

- `engine_authority_config` must have rows granting platform admin access to: `fork_template`, `publish_workspace_template`, `deprecate_workspace_template`, clause_library CRUD
- Default-allow is REJECTED (per CVE-class finding from 2026-04-19 helpdesk council)
- Each tool requires explicit `default_allow: false` + per-actor authority check

### Botsson (platform mode)

Currently no platform-admin capability set for Botsson. If added in Phase 5:
- `allowedChannels: ["chat"]` (platform admin never uses voice for curation)
- Intent classifier route: new `platform_curation` intent
- Separate from `contract` + `contract_intake` + `industry_intelligence` capabilities

### Known debt

- Version schema: open question whether `contract_template.version` is a single bumpable integer or if we need a separate `contract_template_version` child table with full snapshot per version. Phase 1 defers decision; ADR-0181 mentions drift but doesn't specify version storage.
- Cross-workspace distribution view uses admin client (godmode bypasses RLS) — need audit logging on every access to prevent silent cross-tenant reads being invisible
- Clause library inline drift (documented in ADR-0181) — follow-up ADR on clause-reference extraction
- No I1 bootstrap UI — platform admin cannot curate which K1a templates are industry defaults via the UI yet (requires either a flag or a dedicated binding table)
