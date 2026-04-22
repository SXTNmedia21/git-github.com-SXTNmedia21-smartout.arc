---
title: User Journeys — Cascade Drift Observability (Passive Layer)
status: verified
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [contracts, cascade, drift, k1a, k1b, passive, journey, phase-4]
verified_by: council-gate-3 2026-04-22
verified_note: DriftDiffDrawer + lineage badge + amber drift chip (Nordic Split --warning token) + deprecated banner live on feat/contract-hub-redesign. E2E spec exists (apps/e2e/tests/contracts/cascade-drift-observability.spec.ts). Active remediation deferred to Phase 5 behind ADR-0183.
---

# User Journeys — Cascade Drift Observability (Passive Layer)

> Phase 4 of the contract redesign ships passive drift observability: workspace admins *see* when their K1b forks lag behind K1a source templates, but no interactive remediation or change_proposal flow yet. Active remediation (interactive diff, accept/reject per clause, auto-generated `change_proposal` rows) is deferred to Phase 5 behind ADR-0183 (industry_intelligence capability).

## Roles

- **Admin / Owner** — sees drift indicators on own workspace templates; can navigate to K1a source but cannot auto-apply changes
- **Manager** — sees indicators in read-only; no actions available
- **Platform Admin** — sees cross-workspace drift distribution on `/platform-admin/contracts/templates` (covered in `JOURNEY-platform-k1a-curation.md`)
- **Employee** — never sees drift surfaces; contracts are composed from `framework_snapshot` (immutable)

---

## Journey 1: Admin sees passive K1a badge on a forked template

**Precondition:** Workspace has at least one K1b template with `source_template_id IS NOT NULL`.

1. Admin clicks `Maler` tab on `/dashboard/contracts` and selects a forked template
2. Workbench header renders beneath the template name:
   → Cascade chip (muted pill): `Basert på K1a: Hospitality Fulltid v2.3`
   → Chip is clickable — opens a right-side diff drawer (see Journey 2)
   → Chip uses `text-muted-foreground` + `bg-muted` — never brand colors (ambient, not primary)
3. Admin hovers the chip
   → Tooltip: `Klonet 2026-03-14 fra system-mal versjon 2.3. System er nå på versjon 2.5 — 2 endringer tilgjengelig.`
   → Tooltip appears with spring (stiffness 40, damping 22, mass 2.2) after 300ms delay

**Postcondition:** Admin knows the lineage of their template at a glance without leaving the workbench.

**Error paths:**
- `source_template_version` is NULL (legacy template forked before G5 migration): chip renders `Basert på K1a: Hospitality Fulltid (versjon ukjent)` — honest about the gap
- Source template deleted from platform (should not happen — `ON DELETE SET NULL` on FK): chip renders `Original system-mal ikke lenger tilgjengelig` with muted tone

---

## Journey 2: Admin sees amber drift chip when K1a has updated

**Precondition:** Workspace template has `source_template_version < current K1a version` for the same `source_template_id`.

1. Admin lands on `Maler` tab
   → Each template row that has drift shows a small amber dot (hue 50 warm, not red) on the right side of the row
   → Selected row's workbench header shows the full drift chip: `Oppdatering tilgjengelig fra Smartout` with amber hue 50 background wash
2. Amber dot + drift chip never block any action — they're ambient signal only (Phase 4 scope)
3. Admin clicks the drift chip
   → Diff drawer slides in from right (Sheet, 640px, glass surface)
   → Drawer header: Instrument Serif `Oppdatering fra Smartout`
   → Subtitle: `Hospitality Fulltid har fått 2 endringer siden du klonte malen.`
   → Body renders clause-level diff (side-by-side) — read-only in Phase 4
   → No `Godta endring` actions in Phase 4 (deferred to Phase 5)
   → Footer: `Lukk` button only
4. Admin reads the diff, closes drawer, continues with current template unchanged

**Postcondition:** Admin is aware of upstream change but is not forced to act. Workspace autonomy respected per council verdict (Q7 passive-now, active-later).

**Error paths:**
- K1a version lookup fails: amber chip renders generic `Kunne ikke sjekke oppdateringer` in muted tone; no blocker
- Diff computation times out (>3s): drawer renders `Forskjellen er for stor til å vise her — kontakt support` message
- Multiple K1a versions between fork and current: all intermediate diffs concatenated chronologically

---

## Journey 3: Admin sees deprecated-template banner in composition drawer

**Precondition:** A template used by a binding is deprecated (`deprecated_at IS NOT NULL`); composition drawer resolved to this template via binding fallback chain.

1. Admin triggers composition (Kontrakter tab `Lag kontrakt` or reverse flow from employee page)
2. CompositionDrawer step 3 (Gjennomgang) renders
3. If resolved template has `deprecated_at IS NOT NULL`:
   → Amber banner at top of step body: `Denne malen er avviklet. Vurder å velge en annen mal før du sender.`
   → Banner uses `bg-muted` + amber `border-l-4` accent (hue 50 warm)
   → Banner is non-blocking — admin can proceed
   → Banner includes inline link `Gå til Maler-fanen` (opens new tab)
4. Admin either continues or closes the drawer to pick a different template

**Postcondition:** Admin cannot send a contract on a deprecated template without seeing a warning. Historical contracts unaffected.

**Error paths:**
- Binding resolver returns deprecated template because no active fallback exists: banner includes stronger copy `Ingen aktiv mal funnet for denne kategorien — bind en ny mal før sending`
- Template deprecated mid-composition (race condition): banner renders on next mount; current render completes with warning at end

---

## Journey 4: Manager sees read-only drift indicators

**Precondition:** Manager is on `Maler` tab (visible to managers if role permits — currently NO per `JOURNEY-contract-hub-redesign.md` role matrix; this journey covers future state if matrix opens).

1. Manager views template list with amber drift dots visible
2. Manager clicks a template → workbench opens in READ-ONLY mode
3. All edit affordances (`Rediger` on clauses, `Lagre endringer`, `Publiser`, `Avvikle`) hidden
4. Drift chip clickable → same diff drawer as admin, but always read-only

**Postcondition:** Manager observability matches admin, minus mutation rights.

**Error paths:**
- Manager tries to POST `/api/contract-templates/[id]` via URL tampering: 403 returned
- Cache leaks show edit buttons for a flash: `suppressHydrationWarning` + server-side role check prevents this on SSR

---

## Cross-cutting concerns

### What is drift?

`drift = (workspace_template.source_template_version < system_template.version)` for the same `source_template_id`.

- Detected on-read via join: `contract_template` workspace row vs platform `contract_template` row where `is_system = true`.
- No background cron in Phase 4 — evaluated lazily when a template is viewed.
- Phase 5 will add `industry_intelligence.check_drift` capability tool for proactive detection.

### Why amber, not red?

- Amber (hue 50 warm) = informational, non-blocking
- Red (destructive) = confirm destructive action only
- Council frontend-designer: "cascade drift must feel like weather, not emergency"
- Respects workspace autonomy — an out-of-date template is not automatically wrong

### Deferred to Phase 5 (ADR-0183)

- Interactive diff-drawer with per-clause `Godta endring` / `Behold min versjon` actions
- `change_proposal` row generation on accept
- Proactive cron detection of drift across all workspaces
- Botsson capability: `propose_clause_update` that auto-generates `change_proposal` from K1a diff

### Telemetry

- `contract_template.drift_viewed` (new, Phase 4) — emitted when admin opens diff drawer
- `contract_template.drift_dismissed` (new, Phase 4) — emitted when admin closes drawer without action
- Both events need registry entry (Gate G2).

### What is NOT covered in this journey

- Re-fork from latest K1a (admin clones again): covered in `JOURNEY-workspace-template-fork.md` Journey 1
- Platform-side cross-workspace drift distribution: covered in `JOURNEY-platform-k1a-curation.md`
- Employee-side view of template drift: N/A — employees see `framework_snapshot` which is immutable

### Visual contract (Nordic Split)

- Ambient drift dot: 8px, amber (hue 50 warm), 80% opacity
- Drift chip: `bg-muted` with 2px amber left border (`border-l-2 border-[hsl(50_60%_50%)]` — CSS variable once tokens land)
- Diff drawer: standard Sheet with glass surface, `bg-background/80 backdrop-blur-xl`
- NO hardcoded `amber-500` — use CSS variable `--warning` once available in design tokens
- NO red anywhere in drift surfaces

### Known debt

- Phase 4 has no way to re-sync without re-cloning — admin must deprecate old fork + clone fresh (mitigated by Phase 5 merge flow)
- Drift detection is read-time only; workspaces that never view a template never learn of upstream changes
- Clause-level drift granularity limited by inline `content_html` — clause-reference extraction is a follow-up ADR
