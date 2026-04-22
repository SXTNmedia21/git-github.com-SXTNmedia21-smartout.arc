---
title: User Journeys — Workspace Template Fork (K1a → K1b)
status: draft
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [contracts, templates, k1a, k1b, fork, lineage, cascade, journey]
---

# User Journeys — Workspace Template Fork (K1a → K1b)

> Council 2026-04-22 resolution Q1=B: workspace admins can clone K1a system templates and fully edit their K1b copies, including clauses. This journey documents fork, edit, publish, and deprecate. Lineage is tracked via `source_template_id + source_template_version + forked_at` columns (Gate G5). Drift observability is separate — see `JOURNEY-cascade-drift-observability.md`.

## Roles

- **Admin / Owner** — can fork, edit, publish, deprecate workspace templates
- **Manager** — read-only access to workspace template list; cannot fork
- **Platform Admin** — does NOT edit workspace forks; owns K1a catalog (see `JOURNEY-platform-k1a-curation.md`)
- **Botsson** — can surface `fork_template`, `publish_workspace_template`, `deprecate_workspace_template` as `suggest`-authority tools (chat-channel only)

---

## Journey 1: Admin forks a K1a template

**Precondition:** Admin on `Maler` tab; at least one K1a template exists for workspace's industry.

1. Admin clicks the `Maler` tab on `/dashboard/contracts`
   → Left zone renders workspace templates (possibly empty)
   → If empty: curated K1a catalog preview renders (see `JOURNEY-contract-hub-redesign.md` Journey 3)
2. Admin clicks `Bruk denne` on a K1a row (or `Klon fra system` on a populated workspace list)
   → Glass surface slides up from below (`bg-background/80 backdrop-blur-xl`)
   → Confirmation text: `Denne malen kopieres til din arbeidsflate. Du kan redigere alle klausuler. Oppdateringer fra Smartout varsles, men aldri påtvinges.`
   → Two buttons: `Kopier mal` (primary) + `Avbryt` (ghost)
3. Admin clicks `Kopier mal`
   → System calls `POST /api/contract-templates/copy` with `{ system_template_id }`
   → Alternatively, Botsson can invoke `fork_template` capability tool (same route under the hood)
   → Route validates admin/owner role via user-scoped client
   → Route inserts new `contract_template` row with:
     - `workspace_id` = caller's workspace
     - `is_system` = false
     - `source_template_id` = system template id (lineage FK)
     - `source_template_version` = system template's `version` at fork time
     - `forked_at` = `now()`
     - `published_at` = NULL (draft)
     - `deprecated_at` = NULL
     - `content_html` + `placeholders` + `header_html` + `footer_html` + `content_css` + `accent_color` copied from source
   → Route emits `contract_template forked` telemetry event (registered per Gate G2)
4. Glass surface dismisses with spring flight; new template appears at top of workspace list
   → Entrance highlight: brand hue 40 glow pulsing 3 times, 800ms each, to tell admin where the new template landed (no toast)
5. Admin clicks the new template row
   → Right zone renders template workbench (see Journey 2)

**Postcondition:** New `contract_template` row exists in K1b with full lineage. Template is in draft state (`published_at IS NULL`) and cannot yet be resolved by `contract_template_binding` (binding resolver filters `published_at IS NOT NULL AND deprecated_at IS NULL`).

**Error paths:**
- Admin is not admin/owner: route returns 403
- Source template is not `is_system=true` AND not in same workspace: route returns 400
- Clone payload too large (>1MB): route returns 413 with friendly message
- Post-insert telemetry emit fails: insert still commits; telemetry logs error; ops alert fires

---

## Journey 2: Admin edits a forked template

**Precondition:** Admin selected a forked K1b template in `Maler` tab left zone.

1. Right zone renders template workbench
   → Top: editable Instrument Serif template name (click to edit inline)
   → Below name: cascade chip — muted pill `Hospitality · Fulltid · v2.3`, clickable to show K1a source diff
   → Meta row: `Bundet til 3 regler · 12 ansatte bruker · Sist oppdatert 2 dager siden`
   → If `source_template_version < current K1a version`: amber drift chip visible (see `JOURNEY-cascade-drift-observability.md`)
2. Workbench body: two vertical columns separated by space (no borders between)
   → Left column: clause list — each clause is a Geist Sans paragraph with hover-reveal `Rediger` + `Fjern` ghost buttons
   → Right column: placeholder inspector — list of `{{employee_name}}`, `{{start_date}}`, etc. with resolution rules in Geist Mono
3. Admin clicks `Rediger` on a clause
   → Clause expands inline into an editor; other clauses dim to 60% opacity with 300ms spring
   → Tiptap editor with formatting toolbar (bold, italic, underline, headings, lists, undo/redo)
4. Admin modifies clause text
   → `Lagre endringer` button (bottom-right, brand fill) appears as soon as content is dirty
5. Admin clicks `Lagre endringer`
   → System calls `PUT /api/contract-templates/[id]` with updated `content_html`
   → Route verifies admin/owner role and `is_system=false` (cannot edit system templates from this route — enforced by G3 trigger)
   → Route emits `contract_template clause_updated` event with clause slug
6. Toast: `Endringer lagret`; `Lagre endringer` button hides until next edit

**Postcondition:** Template `content_html` updated. `updated_at` reflects mutation. Telemetry event logged. No employment_contract that was composed from this template prior to the edit is affected (immutability via `framework_snapshot` per ADR-0076).

**Error paths:**
- Admin not admin/owner: PUT returns 403
- Template `is_system = true` somehow reached this path: trigger raises `is_system is immutable` exception (G3)
- Compliance warning shown at composition time (not here) — framework-rule violations are a composition-time check per ADR-0076
- Concurrent edit by two admins: last-write-wins with a `Noen andre redigerte denne malen`-toast (no optimistic locking in Phase 1)

---

## Journey 3: Admin publishes a workspace template

**Precondition:** Admin finished editing a draft workspace template (`published_at IS NULL`).

1. Admin clicks `Publiser` button in workbench header (only visible when `published_at IS NULL`)
2. Confirmation dialog: `Når publisert kan malen bindes til lønnsgrupper og bruk i kontrakter. Du kan fortsatt redigere. Vil du fortsette?`
3. Admin clicks `Publiser`
   → System calls `POST /api/contract-templates/[id]/publish`
   → Alternatively, Botsson can invoke `publish_workspace_template` capability tool
   → Route verifies admin/owner role, `is_system=false`, `deprecated_at IS NULL`
   → Route sets `published_at = now()`
   → Route emits `contract_template published` event
4. Workbench header updates: `Publisert 2026-04-22 · v1` badge replaces `Utkast` badge
5. Template now resolvable by `contract_template_binding` resolver for composition

**Postcondition:** Template is published and eligible for binding. Admin can bind it to employment categories via `Bindinger` tab.

**Error paths:**
- Admin lacks role: 403
- Template already deprecated: 400 `Kan ikke publisere avviklet mal — klon først`
- Template is K1a system template: 403 `System-maler publiseres via platform-admin`

---

## Journey 4: Admin deprecates a workspace template

**Precondition:** Published workspace template exists; admin wants to retire it without deleting historical record.

1. Admin clicks `Avvikle` in workbench action menu (only visible when `published_at IS NOT NULL AND deprecated_at IS NULL`)
2. Confirmation dialog: `Eksisterende kontrakter påvirkes ikke. Nye kontrakter kan ikke bruke denne malen etter avvikling. Du kan aktivere på nytt senere. Fortsett?`
3. Admin clicks `Avvikle`
   → System calls `POST /api/contract-templates/[id]/deprecate`
   → Alternatively, Botsson can invoke `deprecate_workspace_template` tool
   → Route sets `deprecated_at = now()`
   → Route emits `contract_template deprecated` event
4. Workbench badge changes to `Avviklet` (muted destructive tint, hue 50 warm)
5. Template is hidden from `contract_template_binding` resolver (filtered by `deprecated_at IS NULL`)
6. Existing bindings that reference the template are preserved but marked `stale` in the Bindinger tab

**Postcondition:** Template is deprecated; no new compositions can resolve to it; historical contracts remain intact via their `framework_snapshot`.

**Error paths:**
- Admin lacks role: 403
- Template not yet published: 400 `Utkast kan slettes, ikke avvikles`
- Template has active bindings: confirmation dialog warns with binding count, admin must acknowledge before deprecation proceeds

---

## Journey 5: Admin re-activates a deprecated template

**Precondition:** Deprecated workspace template exists; admin wants to re-enable it.

1. Admin opens the deprecated template in workbench
2. Admin clicks `Aktiver på nytt`
3. Confirmation dialog: `Malen blir tilgjengelig for nye kontrakter igjen. Sjekk at innholdet fortsatt er korrekt.`
4. Admin clicks `Aktiver på nytt`
   → System calls `POST /api/contract-templates/[id]/reactivate`
   → Route sets `deprecated_at = NULL` and keeps `published_at` intact
   → Route emits `contract_template published` event (same event — re-publish semantics; not adding a sixth registry entry)
5. Template becomes eligible for composition again

**Postcondition:** Template is active; existing `stale` bindings in `Bindinger` tab clear.

**Error paths:**
- Template drift since deprecation: amber chip persists on re-activation; admin should verify via diff against K1a source
- Admin lacks role: 403

---

## Journey 6: Botsson surfaces fork/publish/deprecate as suggest-level tools

**Precondition:** Admin engaging Botsson on the hub via chat (ADR-0078 restricts template authoring to chat channel — never voice).

1. Admin says: `Jeg vil lage en deltidsmal som samsvarer med Riksavtalen`
   → Intent classifier routes to `contract` capability
   → Tool selector at `suggest` authority surfaces `fork_template`
   → Botsson proposes: `Jeg foreslår å klone systemmal 'Arbeidsavtale — Deltid v2.1'. Vil du fortsette?`
2. Admin confirms in UI
3. Tool executes per Journey 1 flow
4. Botsson reads resulting template back: `Malen er klonet som utkast. Vil du redigere klausul 4 (arbeidstid)?`
5. Admin says yes → Botsson cannot edit HTML directly (authoring tools `insert-section`, `remove-section`, `edit-text`, `reorder-sections` are platform-admin-only per Supervisor's ADR-0133 scope fence)
6. Botsson points admin to `Maler` tab workbench: `Åpne malen i Maler-fanen for å redigere klausul 4.`

**Postcondition:** Botsson handled the framing and the fork; editing remained on workbench. No capability tool mutated clauses directly in workspace scope.

**Error paths:**
- Authority too low (`read_only`): tool selector does not surface `fork_template`; Botsson cannot propose
- Chat channel not set on `AgentToolContext`: tool refuses to execute with `channel not allowed for this tool`

---

## Cross-cutting concerns

### Lineage columns (Gate G5)

Every workspace-forked template carries:

| Column | Type | Purpose |
|---|---|---|
| `source_template_id` | UUID nullable FK → `contract_template.template_id` ON DELETE SET NULL | Parent template (null for true-from-scratch) |
| `source_template_version` | text nullable | Parent version at fork time |
| `forked_at` | timestamptz nullable | When fork happened |
| `published_at` | timestamptz nullable | Lifecycle: active from this moment |
| `deprecated_at` | timestamptz nullable | Lifecycle: retired at this moment |

Constraint: `CHECK (source_template_id IS NULL OR forked_at IS NOT NULL)`.

### Telemetry events (Gate G2)

All five events registered before implementation:
- `contract_template forked`
- `contract_template clause_updated`
- `contract_template published`
- `contract_template deprecated`
- `contract_template deleted` (workspace-owned hard-delete only, not covered in this journey)

All events route to 4 destinations: activity_trail, engine_event, posthog, logger.

### Immutability enforcement (Gate G3)

Trigger on `contract_template` raises exception if `OLD.is_system IS DISTINCT FROM NEW.is_system`. Prevents app-layer bypass via service_role.

### Scope fence (ADR-0133)

- Fork/edit/publish/deprecate surfaces live on WEB only
- Mobile `suggestTools` for `contract` capability must NOT include these tools
- Authoring tools (`insert-section`, etc.) live in `packages/ai/src/tools/contract/` but are wired to platform-admin capability only, not workspace-scope `contract` capability

### Compliance semantics

- Template-level editing: NO framework-rule validation (per ADR-0076, compliance is composition-time check)
- Composition-time: `resolveComposition` validates against current workspace `framework_rule` and flags blockers
- Drift: separate concern — see `JOURNEY-cascade-drift-observability.md`

### Known debt

- No clause-library reference extraction — clauses are inlined into `content_html` (drift trap documented in ADR-0181, follow-up ADR scheduled for Phase 5)
- No optimistic locking on concurrent edits — last-write-wins for Phase 1
- Bulk-fork (admin forks multiple K1a templates at once) not supported — one-at-a-time flow only
