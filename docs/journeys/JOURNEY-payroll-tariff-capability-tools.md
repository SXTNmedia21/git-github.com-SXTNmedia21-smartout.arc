---
title: "Journey — payroll-tariff-capability-tools"
status: verified
updated: 2026-05-17
created: 2026-05-17
module: MODULE_AGENT_SDK
tags: [journey, payroll, tariff, delegation, adr-0356, phase-7f]
---

# Journey — payroll-tariff-capability-tools

> Phase 7f payroll tariff tools consuming cascade delegation surface (Sortie 3 `bfcdfc6b5`).

## Journey: Admin sets up first tariff binding during onboarding

**Precondition:** Workspace exists, no active `workspace_union_binding` row, admin authenticated with payroll capability authority seeded.

1. Admin → "Vi er NHO Reiseliv-medlem, Riksavtalen 2025" in dashboard chat
2. Intent classifier → `payroll` (high confidence — tariff-keyword)
3. Tool selector → `setup_workspace_tariff`
4. Tool fail-fast: verifies `ctx.workspaceId` + `ctx.profileId` non-empty (L-0177); else MISSING_PROFILE_CONTEXT
5. Tool ADR-0151 block: verifies `input.workspace_id === ctx.workspaceId`; else CROSS_WORKSPACE_BLOCKED
6. Tool ADR-0078 channel guard: chat-only
7. Tool `mutateWithGate('setup_workspace_tariff', ...)` → payroll gate fires (admin required)
8. Tool calls `cascade.bind_workspace_union(caller_capability='payroll', amendment_classifier='BOOTSTRAP', ...)`
9. Cascade tool: independent gate fires (cross-namespace defense per ADR-0356)
10. Cascade tool calls atomic RPC `public.bind_workspace_union_atomic` — INSERT new row
11. Cascade emits `cascade.workspace_union_binding_created` with `actor_capability='cascade', delegated_via='payroll'`
12. Cache trigger updates `payroll.workspace_settings.active_union_id` + `active_binding_id`
13. Payroll tool emits `payroll.workspace_tariff_setup` with `actor_capability='payroll', delegated_via='cascade'`, official_effective_date captured
14. Botsson responds: "Bundet til Riksavtalen 2025, gjelder fra i dag. Aml. §14-6 godkjent."

**Postcondition:** `workspace_union_binding` row exists, both cache columns populated, audit chain complete (2 emits with reciprocal actor/delegated fields).

**Error paths:**
- Missing ctx → `MISSING_PROFILE_CONTEXT` envelope (ADR-0152 shape)
- Body workspace_id mismatch → `CROSS_WORKSPACE_BLOCKED`
- Wrong channel (voice) → `INVALID_CHANNEL`
- Admin role missing on workspace → `MutateWithGateDenied` (payroll authority gate)
- Workspace already bound → cascade returns INSERT conflict → pass-through, Botsson suggests `change_workspace_tariff`

## Journey: Admin switches to new law_version

**Precondition:** Existing active `workspace_union_binding` row, new Riksavtalen 2026 published.

1. Admin → "Bytt til Riksavtalen 2026, gjeldende fra 1. juni"
2. Tool → `change_workspace_tariff` with new_law_version='2026'
3. Same fail-fast + ADR-0151 + channel + gate sequence as setup
4. Tool classifies amendment (same union + new version → `UP`; different union → `MATERIAL`)
5. Tool calls `cascade.bind_workspace_union(caller_capability='payroll')` switch flow
6. Atomic RPC: UPDATE old effective_to + INSERT new row in single transaction
7. Cascade + payroll emit (audit-symmetry)
8. Botsson: "Riksavtalen 2026 aktiv fra 1. juni 2026. Gammel binding lukket."

**Postcondition:** Old row has `effective_to` set, new row active, cache columns repointed via trigger, both layers emitted.

**Error paths:**
- No existing binding → cascade returns appropriate envelope, Botsson suggests `setup_workspace_tariff`
- Cascade `ENDRINGSOPPSIGELSE` classification → `AMENDMENT_BLOCKED`, Botsson explains re-signing requirement

## Journey: Manager adds workspace-specific evening supplement

**Precondition:** Workspace tariff-bound; tariff floor for kveldstillegg = 27% per Riksavtalen §6.

1. Manager → "Legg til 30% kveldstillegg etter kl 22 for våre baransatte"
2. Tool → `add_supplement_override` with rate_value=30, supplement_type='evening'
3. Fail-fast + ADR-0151 + channel guard
4. Tool `mutateWithGate('add_supplement_override', ...)` — manager OR admin authority
5. Tool calls `cascade.add_supplement_rule(caller_capability='payroll', ...)`
6. Cascade tool INSERTs to `public.supplement_rule`
7. PostgreSQL tariff-floor TRIGGER `enforce_supplement_tariff_floor` checks: 30 >= 27 → PASS
8. Cascade emits `cascade.supplement_rule_added` (audit-symmetry)
9. Payroll emits `payroll.supplement_override_added`
10. Botsson: "Lagt til. 30% kveldstillegg gjelder for bartenderne."

**Postcondition:** `public.supplement_rule` row created, both layers emitted.

**Error paths:**
- Below tariff floor (e.g. 25%) → trigger raises PostgreSQL exception → cascade transforms to ADR-0152 envelope `SUPPLEMENT_BELOW_TARIFF_FLOOR` with `{aml_ref: '§14-15', floor: 27, proposed: 25}` → pass-through to user
- Manager role missing → gate denied
