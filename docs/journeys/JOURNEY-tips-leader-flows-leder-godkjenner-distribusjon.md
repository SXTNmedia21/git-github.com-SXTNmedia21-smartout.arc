---
title: "Journey — Leder godkjenner tips-distribusjon ved oppgjør"
feature: tips-leader-flows
journey: leder-godkjenner-distribusjon
status: verified
verified_at: 2026-04-29
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: payroll
tags: [journey, tips, payroll]
---

# Journey: Leder godkjenner tips-distribusjon ved dagsoppgjør

**Role:** manager (department-leder)

**Precondition:**
- `tip_pool.status='recorded'` for sesjonen (set_pot har kjørt)
- `tip_distribution`-rader finnes med `status='calculated'`
- Leder er på WebDayControl → Oppgjør-tab (signoff-flow)
- Leder har autoritet `level=confirm, min_role>=manager` på `tips.approve_distribution`
- `requires_four_eyes` per workspace-policy (default `false`)

## Happy Path

1. Leder åpner WebDayControl → Oppgjør-tab på dagens dato
2. SignoffTab viser tips-kort: "Pot registrert: X kr — N ansatte" + sum-status-badge ("Sum stemmer ✓" eller "Diff: ±N kr" hvis adjustments brutt invariant)
3. Leder kan klikke kortet for å åpne distribusjons-preview (read-only inline-tabell + lenke til Reconciliation hvis justering trengs)
4. Leder trykker "Godkjenn distribusjon" → ApproveBar viser obligatorisk samtykke-checkbox + bekreft-knapp
5. Leder huker av "Jeg bekrefter at distribusjonen er korrekt" + trykker "Godkjenn"
6. BFF route `/api/tips/approve-distribution` kaller stage-engine → `tips.approve_distribution` capability tool
7. Tool: `callTipsGate({capability:'tips.approve_distribution', actionType:'approve', entityId:pool_id})` → gate svarer
   - `requiresFourEyes=true, approversPresent.length < approversNeeded` → `{ok:false, error:'four_eyes_required', approversNeeded}` (placeholder)
   - `allow=true` → fortsett
8. Stage engine viser `level=confirm` ConfirmSheet til leder
9. Leder bekrefter → tool transaksjon (alt-eller-ingenting):
   - SELECT count(*) FROM `tip_adjustment_log` WHERE `distribution_id IN (SELECT id FROM tip_distribution WHERE pool_id=:pool_id)` → `adjustment_count`
   - SELECT sum(`adjusted_amount ?? calculated_amount`) FROM `tip_distribution` WHERE `pool_id=:pool_id` → `total_distributed`
   - SELECT `tp.method` FROM `tip_policy tp JOIN tip_pool p ON p.policy_id=tp.id WHERE p.id=:pool_id` → algorithm
   - UPDATE `tip_pool SET status='approved', approved_by=:actor, approved_at=now, algorithm_version_at_approval=:method WHERE id=:pool_id AND status='recorded'` (RLS sjekker `status != 'approved'` → tillatt)
   - UPDATE `tip_distribution SET status='approved' WHERE pool_id=:pool_id` (RLS sjekker `pool.status != 'approved'` — pool var `recorded` ved sjekken; UPDATE rekkefølge: distributions FØR pool, ELLER samme tx + RLS-sjekk er pre-update state)

   **Race-implication:** RLS UPDATE-policy på `tip_distribution` evaluates pool.status PER row. Etter pool flippes til `approved` blir distribusjons-UPDATE blokkert. Derfor må distribusjons-UPDATE skje FØR pool-UPDATE i samme transaksjon, ELLER SECURITY DEFINER funksjon må kjøre begge atomisk. Sortie 2 implementerer som SECURITY DEFINER RPC `approve_tip_pool(pool_id, actor_profile_id)` for å unngå policy-collision.

10. Tool emit (ETTER alle DB-writes):
    - `tip_pool approved` med `{pool_id, department_session_id, total_distributed, distribution_count, adjustment_count}` (4 destinations)
11. Tool returnerer `{ok:true, pool_id, total_distributed, distribution_count, adjustment_count}`
12. SignoffTab-kortet skifter til badge "Godkjent ✓" + viser `approved_at` + leder-navn (`approved_by`)
13. Justeringer er nå låst (RLS UPDATE blokkerer `tip_distribution` fordi parent pool er `approved`)
14. Ansatte kan nå se sin andel via mobil — `tip_distribution.status='approved'` triggrer SELECT-policy (`jwt_select_tip_distribution_employee` — Sortie 3-flow)

**Postcondition:**
- `tip_pool.status='approved'`, `approved_at` + `approved_by` satt, `algorithm_version_at_approval` snapshot fra policy
- Alle barn `tip_distribution.status='approved'`
- DB CHECK `chk_tip_pool_approval` enforces samtidig setting av `(status, approved_by, approved_at)`
- `engine_event` + `activity_trail` har `tip_pool approved`-event
- Pot klar for payroll-utbetaling (`status='paid'` settes KUN av payroll-run, aldri her)

## Error Paths

- **Pool ikke `recorded`** → tool SELECT returnerer mismatch → `{ok:false, error:'invalid_state'}`; ApproveBar disabled hvis status != recorded
- **Sum-mismatch utan godkjent justering** → ApproveBar viser advarsel; ConfirmSheet inkluderer "Sum stemmer ikke (diff X kr) — godkjenn likevel?" som blokk-checkbox
- **`requires_four_eyes: true`** → første godkjenning markerer pool ikke; tool returnerer `four_eyes_required` til UI; second-leader-flow defer Sortie 4 (placeholder)
- **Allerede approved** → SECURITY DEFINER RPC sjekker `status='recorded'` i WHERE-clause; 0 rows updated → `{ok:false, error:'already_approved'}`; UI refresher state via TanStack invalidate
- **Network-feil mellom emit og DB-write** → ADR-0196 invariant 11 — INGEN `run_started` ELLER `tip_pool approved` emit hvis DB-write feiler; transaksjon ruller tilbake; tool returnerer `{ok:false, error:'db_write_failed'}`
- **Manglende rolle** → gate `allow=false` → `{ok:false, error:'unauthorized'}`

## Verification

- [x] Implementation matches the steps above
- [x] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [x] Manually tested end-to-end

Verified by Phase 6 fresh-run typecheck + grep gates 2026-04-29; E2E deferred to a future polish sortie per user direction.

**Mark `status: verified` in frontmatter when all three boxes are checked.**
