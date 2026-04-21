---
title: "Handoff — session-lifecycle"
feature: session-lifecycle
status: done
updated: 2026-04-20
created: 2026-04-20
module: operations
tags: [handoff, session, lifecycle, daily-operation]
---

# HANDOFF — session-lifecycle

> Sub-sortie closeout. 10 commits across 4 batches (Batch 5 adds 3 docs-only commits).
> Delivered manual session creation, date navigation, status transitions, and retroactive time-entry editing to the Daily Operation D6 surface.

---

## Summary

Denne sub-sortien legger til manuell kontroll over `department_session`-livssyklusen i WebDayControl — admin kan nå opprette sessions manuelt for hvilken som helst dato, navigere fritt i datoer, transition sessions mellom statuser, og legge inn retroaktive punch_in/punch_out på shifts som aldri ble stemplet. Hver av de fire flatene (NoSessionCTA, DateNavigator, SessionActionsBar, RosterTab inline edit) erstatter en dead-end-tilstand som tidligere blokkerte admin fra å gjøre jobben sin.

Arbeidet ble drevet av Pontus' observasjon tidlig i campaign-planleggingen:

> "Når en session ikke er skapt for i dag så må vi kunne skape den... Det kan jo ikke være blockers i dette. Det kan jo være en admin sitter dag 2 dager etterpå og ser at det er noe som har skjedd."

Denne innsikten ble formalisert som **Invariant #13 — no blockers, always navigable** i campaign-doc (Deliverable 1). Alle fire flatene demonstrerer prinsippet: empty-state = CTA, ikke blindvei.

10 commits landet over fire batches: Batch 2 (Server Actions + authority seed + telemetri), Batch 3 (UI-komponenter), Batch 4 (wire-up i WebDayControl/PreflightGate/RosterTab), Batch 5 (docs-only — denne handoff + journey + invariant). Totalt ~3 dev-days fra plan-fil til close-ready.

---

## Decisions made

### D1 — Idempotent `openSessionAction` via find-then-insert

D6-tabellene har ikke `UNIQUE(department_id, date)` på database-nivå (design-valg — sessions kan teoretisk være multi-per-dag ved shift-splitting), så `ON CONFLICT DO NOTHING` eller upsert er ikke trygt. Vi implementerer idempotens klient-side:

1. Query `department_session WHERE department_id = ? AND date = ?` først.
2. Hvis rad finnes → returnér eksisterende session-ID uten å skrive eller emit.
3. Hvis ingen rad → INSERT + emit `session opened`.

**Trade-off:** Extra read per call, men korrekt semantikk. Alternativet (race-condition mellom to admins som klikker samtidig) ville dupplikert sessions.

**File:** `apps/web/src/app/actions/session-actions.ts` (Batch 2 commit `af5fe0d3`).

### D2 — Dual-gated `transitionSessionAction`

Transitioner til `status='closed'` utgjør session sign-off (låser oppgjøret, trigger downstream reconciliation-flow). Dette er C4-nivå autoritet og bør ikke kunne gjøres med en generisk "session.transition"-capability.

**Løsning:** Server Action sjekker begge capabilities på `target='closed'`:

```ts
if (target === 'closed') {
  await requireCapability(profileId, 'session.transition');
  await requireCapability(profileId, 'session.signoff');
} else {
  await requireCapability(profileId, 'session.transition');
}
```

**Impact:** UI-en speiler dette ved at "Godkjenn oppgjør"-knapp i SessionActionsBar skjules hvis admin mangler `session.signoff`, selv om andre transitions er tilgjengelige.

**File:** `apps/web/src/app/actions/session-actions.ts` (Batch 2 commit `f3c09ea4`).

### D3 — Manual time-entry uses find-then-update-or-insert

`timesheet.time_entry.shift_id` har ikke UNIQUE-constraint (en shift kan teoretisk ha multiple entries ved split-shift patterns). Derfor kan vi ikke bruke `.upsert({ onConflict: "shift_id" })` — Postgres ville kastet feil fordi det ikke finnes matching unique index.

**Løsning:** Explicit find-then-update-or-insert pattern:

```ts
const { data: existing } = await supabase
  .from("time_entry")
  .select("id")
  .eq("shift_id", shiftId)
  .maybeSingle();

if (existing) {
  await supabase.from("time_entry").update({ punch_in, punch_out, notes }).eq("id", existing.id);
} else {
  await supabase.from("time_entry").insert({ shift_id, punch_in, punch_out, notes });
}
```

**Trade-off:** 1 extra query per call (read-before-write), men korrekt og safe mot concurrency. Alternativet (å legge til UNIQUE constraint retroaktivt) ville brutt split-shift-flyten.

**File:** `apps/web/src/app/actions/shift-actions.ts` (Batch 2 commit `ba298c41`).

### D4 — Admin override moved to PreflightGate peer

Opprinnelig plan plasserte admin-override som en escape-modal gjemt bak en "..." meny. Review under Batch 4 flyttet det til peer-CTA i blocker-header via ny `overrideSlot?: ReactNode` prop på `PreflightGate`.

**Begrunnelse:** Override er en peer-handling til "løs blockers" — ikke en escape-hatch. Admin med autoritet skal se override som en likestilt knapp, ikke som et nødutgang-valg. Dette alignerer med Invariant #13 (empty-state = CTA, ikke blindvei).

**Impact:** PreflightGate header-layout endret til grid med `overrideSlot` i høyre-området. Rendres bare hvis prop er passed (opt-in per call-site).

**File:** `apps/web/src/components/recon/PreflightGate.tsx` (Batch 4 commit `59b9b21e`).

### D5 — `TransitionTarget` narrow type excludes "upcoming"

`SessionActionsBar` lokal `Status` type inkluderer "upcoming" for display-purposes (vi må kunne rendre knapper fra `upcoming` → andre states). Men `TransitionTarget` (type som `transitionSessionAction` aksepterer) er bevisst smalere — den inkluderer bare de 4 lovlige target-verdiene: `active`, `closed`, `missed`, `cancelled`.

**Begrunnelse:** UI bør ikke kunne tilby "transition til upcoming" som en handling (det er startstaten, ikke en target). Ved å holde type-en smal fanges misbruk i compile-time.

**Impact:** Hvis noen prøver å legge til en "Gå tilbake til upcoming"-knapp, typecheck feiler. Design-valg over flexibility.

**File:** `apps/web/src/components/day/SessionActionsBar.tsx` (Batch 3 commit `e339051e`).

---

## Learnings captured

### L1 — Schema verification is mandatory before writing Server Actions

Opprinnelig plan refererte til kolonnenavn som `capability_key`, `punched_in_at`, `employee_id`, `admin_note`. Reality-check mot `packages/supabase/src/database.types.ts` viste at faktiske kolonner var `capability`, `punch_in`, `profile_id`, `notes`. Fire schema-mismatches ville ført til runtime-feil hvis Batch 2 hadde skrevet SQL basert på plan-fil alene.

**Fix:** Batch 2 subagent leste `supabase/migrations/` + `database.types.ts` FØR SQL ble skrevet. Fant alle fire mismatches, oppdaterte Zod-schemas og Server Actions før første commit.

**Takeaway:** Plan-filer er design-artefakter, ikke sannhetskilder. Code + DB schema wins alltid per CLAUDE.md. Verifisering av kolonnenavn skal være første steg i enhver Server Action-implementasjon.

### L2 — Emit event names are canonical, not inventive

Plan-fil skrev `emit('department_session opened', ...)`. Registry-canon i `packages/telemetry/src/registry.ts` var `session opened` (uten tabell-prefix). Å emit med feil navn hadde opprettet en parallel event-stream — QA-dashbord ville ikke fanget events fordi PostHog-filtere matcher canonical names.

**Fix:** Batch 2 subagent grep'et `registry.ts` for `session` og oppdaget canonical navn. Korrigerte alle emit-calls før commit.

**Takeaway:** `packages/telemetry/src/registry.ts` er source of truth for event-names. Aldri finn på navn basert på tabell + verb — grep registry først. Hvis et event mangler, legg det til registry før du emitter.

### L3 — Commitlint kebab-case scope rejects single-word scopes

Første commit-forsøk i Batch 2 brukte `feat(session)` som scope → commitlint rejecter med `scope-case: scope must be kebab-case`. Grunnen: kebab-case-regelen krever eksplisitt bindestrek. Single-word scopes treffer ikke pattern.

**Fix:** Omformulerte scopes med eksplisitt hyphen — `feat(session-action)`, `feat(shift-action)`, `feat(db-migration)`, `feat(day-control)`. Aldri brukt `--no-verify` (forbudt per CLAUDE.md).

**Takeaway:** Commitlint kebab-case rejects single words. Bruk alltid hyphenated scopes (`recon-v2`, `session-action`, `day-control`), ikke single tokens (`session`, `recon`, `day`). Dette er samme trap som memory-fil dokumenterte for `chore(e2e)` tidligere — worth re-noting per campaign.

---

## Known issues / debt

### FU-1 — `openSessionAction` does not C4-gate future dates beyond today

Admin med `session.open` capability kan opprette sessions for hvilken som helst dato, inkludert fremtidige. Dette er intensjonelt for forhåndsplanlegging, men hvis business rules krever "no future manual sessions" må vi legge til:

1. Zod refine i `openSessionActionInputSchema`: `.refine((data) => new Date(data.dateISO) <= new Date())`.
2. RPC-level check som validerer mot `workspace_config.allow_future_session_creation`-flag.

**Scope:** Follow-on sortie eller M2 (clockout-wizard) hvis relevant.

### FU-2 — Stop-hooks running typecheck against MAIN repo produce noise

Pre-commit og stop-hooks kjører `pnpm turbo typecheck` som inkluderer `~/dev/smartout.ai/` (main repo, ikke worktree). Dette avdekker pre-existing feil i:

- `@smartout/telemetry` — `EVENT_ROUTING` mangler entries for nye events lagt til i annen campaign.
- `@smartout/mobile` → `@smartout/ui` resolution feiler i noen edge-cases.

**Status:** Ikke relatert til session-lifecycle arbeid. Ikke blokkerende for merge, men gir støy i close-feature output. Logged separat som development-branch tech debt.

### FU-3 — `manualTimeEntryAction` does not validate shift belongs to admin's active department

Server Action verifiserer at admin har `shift.manual_time_entry` capability, men ikke at `shift.department_id === admin.active_department_id`. Hvis admin-cross-department access er en concern (workspace med flere avdelinger der admin bare skal se sin egen), må vi legge til:

```ts
const shift = await getShift(shiftId);
if (shift.department_id !== actorContext.active_department_id) {
  throw new Error("UNAUTHORIZED_DEPARTMENT");
}
```

**Scope:** Vurderes når multi-department RLS policies revisiteres i Milestone 3 (handover-migration).

---

## Next steps

### Batch 6 — E2E + bug fixes

Playwright spec at `apps/e2e/tests/daily-operation-session-lifecycle.spec.ts`:

- E2E-J1: Admin oppretter active session for i dag via NoSessionCTA.
- E2E-J2: Admin navigerer 2 dager tilbake + oppretter upcoming session.
- E2E-J3: Admin legger inn punch-in/out via RosterTab Pencil + dialog.
- E2E-J4: Admin transitioner session upcoming → active via SessionActionsBar.

Kjør mot dev-server på port 3061. Forventet runtime: ~45 sekunder for alle fire journeys.

### Batch 7 — `close-feature.sh` merge to `campaign/daily-operation`

Verifiser close-feature gates:

1. Decision log oppdatert (D1-D5 over — vurder om noen fortjener formell ADR).
2. Journey-fil verified (`feature: session-lifecycle`, `status: verified`).
3. Typecheck 0 feil (eksklusive FU-2 pre-existing).
4. Handoff skrevet (denne fila).
5. E2E tests grønne.

Deretter `close-feature.sh <N>` → merge til `campaign/daily-operation` → sync `origin/development` inn.

### Follow-on sub-sortie — `clockout-wizard` (M2)

Per campaign roadmap er M2 neste milestone. Prereqs:

- ADR-NEXT-02 "Mobile clockout-wizard trigger kontrakt" må skrives før M2 starter.
- Session-lifecycle arbeid (denne sub-sortien) gir `transitionSessionAction` som M2 sannsynligvis bruker for `pending_signoff` → `closed`-transition etter wizard submit.

---

## Commit index

Chronological commits for session-lifecycle sub-sortie:

| # | SHA | Batch | Description |
|---|---|---|---|
| 1 | `af5fe0d3` | 2 | feat(session-action): openSessionAction — idempotent manual session creation |
| 2 | `f3c09ea4` | 2 | feat(session-action): transitionSessionAction — lifecycle progression |
| 3 | `ba298c41` | 2 | feat(shift-action): manualTimeEntryAction — retroactive clock-in/out |
| 4 | `4852053a` | 2 | chore(db-migration): seed session lifecycle authority capabilities |
| 5 | `b4613cba` | 3 | feat(day-control): DateNavigator with back/forward + Calendar popover |
| 6 | `bd5afe61` | 3 | feat(day-control): NoSessionCTA — empty-state becomes Create CTA, not dead-end |
| 7 | `e339051e` | 3 | feat(day-control): SessionActionsBar — manual lifecycle transitions, always visible |
| 8 | `56a650dc` | 4 | feat(day-control): wire DateNavigator + NoSessionCTA + SessionActionsBar into WebDayControl |
| 9 | `59b9b21e` | 4 | refactor(preflight-gate): override is peer CTA in gate, not escape (Inv #13) |
| 10 | `c99e4b10` | 4 | feat(day-control-roster): inline manual time-entry edit per row |
| 11 | `74200a98` | 5 | docs(campaign): add invariant #13 — no blockers, always navigable |
| 12 | `0b1204af` | 5 | docs(journeys): add J1-J4 for session-lifecycle sub-sortie |
| 13 | _(this commit)_ | 5 | docs(handoff): session-lifecycle sub-sortie closeout |

Merknad: commit `1ec7963b` landet en tidlig versjon av Invariant #13 under campaign-doc-scaffolding; commit 11 over oppdaterte til fullstendig Rule/Why/How-to-apply-struktur.

---

## Related docs

- `docs/plans/CAMPAIGN-daily-operation.md` — Invariant #13 (commit 11).
- `docs/journeys/JOURNEY-session-lifecycle.md` — J1-J4 verified journeys (commit 12).
- `docs/plans/PLAN-session-lifecycle.md` — 14-task implementation plan (untracked, created Batch 1).
- `docs/superpowers/plans/2026-04-20-session-lifecycle.md` — 1285-line writing-plans output from brainstorm.
- `docs/decisions/0000-decision-log.md` — no new ADRs this sub-sortie (D1-D5 are design decisions, not architecturally cross-cutting enough for ADR — re-evaluate if M2 depends on them).
