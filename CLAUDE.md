# CLAUDE.md — campaign/daily-operation

> Worktree: `~/dev/smartout.ai-daily-operation` · Branch: `campaign/daily-operation` · Started: 2026-04-20
> Campaign doc: `docs/plans/CAMPAIGN-daily-operation.md`
>
> **Scoped CLAUDE.md.** This file reflects the sole purpose of this worktree — the Daily Operation campaign. For full Smartout v3 project rules (stack, repo layout, all 23 modules, all 54 ADRs, global traps), read `CLAUDE.md` on `development` via `git show development:CLAUDE.md`. Everything in this file is additive or narrowing relative to that baseline.

---

## 🎯 Mission — Why This Worktree Exists

**Build the world's best daily operations panel for shift-based businesses.** Not "good enough." Not "feature-parity with ConnectTeam/Quinyx/7shifts." Best — measured by the people who actually open, run, and close restaurants, cafés, hotels, and multi-site chains at 07:00 Monday and 23:47 Friday.

### The promise this worktree delivers

1. **The shift leader never guesses.** WebDayControl shows live truth — not cached, not mocked, not "roughly." Every KPI, every knapp, every funksjon er `var(--data)`, ikke `var(--aspiration)`.
2. **The admin never reconstructs.** Avstemming (reconciliation) carries its own audit trail. Edit-history is first-class, not a follow-up. Oppgjør signeres én gang, auditeres for alltid.
3. **The mobile app never lies.** Clockout-wizard, handover, punch, HACCP-avvik — each mutation resolverer `workspace_id` + `actor_id` ikke-null FØR `emit()`. No empty-string fallbacks. No "we'll fix telemetri later."
4. **The system never crosses its wire.** D6 skriver D6-tabeller. D4-demand bor i `campaign/year-wheel`. Tickets bor i `campaign/helpdesk`. Voice bor i `campaign/botsson-arena`. Authoring bor på web. Utførelse bor på mobil.
5. **The ambition never waters down.** 4–6 min clockout-wizard. 0 hardkodede farger. Spring physics på alle bevegelser. Every interaction respektere `useReducedMotion()`. "Best in class" er ikke en slogan — det er en merge-gate.

### How "best" is measured (ikke generisk, konkret)

- **Leader-closing-time:** Median time fra "last punch out" til "reconciliation submitted" < 8 min on busy Friday, < 5 min on quiet Tuesday.
- **Handover-read-rate:** > 85 % av neste-skift-ledere leser forrige-skift-handover før de starter (telemetri-drevet).
- **Admin-preflight-override-rate:** < 10 % av godkjenninger bruker override. Hvis høyere → preflight-blockers er feilkonfigurert.
- **Mobile-offline-recovery:** 100 % av Zod-validerte wizard-steg gjenopptas uten data-tap etter connection-restore.
- **`tasks_completed`-integritet:** 0 drift mellom DB og UI over 30 dager (engine-dispatch vs client-derivasjon — ADR-0156 invariants holder).
- **Quality-bar CI-gates:** 3 CI-gates (se campaign-doc Invariant #1) grønne på hver PR. Rødt = ingen merge.

### The 12 Campaign Invariants

Alle sub-sorties i dette worktree-et MÅ passere campaign-dokumentets 12 invariants før close-feature merger. Se `docs/plans/CAMPAIGN-daily-operation.md` §Campaign Invariants for full liste og håndhevelse. Seks arkitektur-invarianter (live-wiring, single-source-of-truth, emit-registry, ADR-0133/0134/close-gate) + seks hospitality-invarianter (role-gated trigger, resumability, admin override, conditional steps, split-shift semantikk, Riksavtalen i KPI).

### 100% Dedikasjon — Ikke-forhandlingbar

**Dette worktree-et implementerer KUN daily operations.** Ingen unntak:

- Scheduling authoring (drag-drop) → `campaign/year-wheel` eller separate sortie fra main
- Helpdesk/tickets → `campaign/helpdesk`
- Voice/agent-router → `campaign/botsson-arena`
- Onboarding/contract-compose → web-only, ikke her
- Training/learning-management → separat worktree

Hvis en oppgave krysser D6-grensen → **STOPP**. Flag til user. Ikke skriv kode. Spawn ny sortie eller coordinate med riktig campaign. Worktree-hygienen er en del av kvalitetsbaren.

### Roadmap — Fem faser (ikke bare 4 milestones)

Se `docs/plans/CAMPAIGN-daily-operation.md` §Roadmap for detaljer per fase. Kort:

- **Fase A (nå):** Foundation — 4 milestones. Recon-v2, clockout-wizard, handover-migration, mobile-parity-poc. ~12–16 dev-days.
- **Fase B:** Intelligens-lag — AI-copilot-forslag under service (avvik-deteksjon, prep-prediksjon, anomali-varsling).
- **Fase C:** Multi-site & consolidation — roll-up på tvers av avdelinger og sites; benchmarking.
- **Fase D:** Operativ mestring — playbook-system, mentor-modus, skills-progresjon per ansatt.
- **Fase E:** Autonom drift — semi-autonome wizards (POS-auto-fill), AI-genererte handovers og recon-narratives.

Hver fase revisiteres når forrige er i produksjon. Faser er retning, ikke lovnader.

---

## Campaign Purpose

**Build the Daily Operation layer.** The runtime surface where a shift-based business opens, runs, and closes its day. In cascade terms:

- **D6 Production & Product** (primary) — `department_session` as the daily operational container; `session_hook` (pre_open → open → scheduled → pre_close → close) drives time; `session_task` is work performed against hooks; `deviation` captures what went wrong.
- **D1 Operational Envelope** (consumes) — `resolve_hours()` determines when a session opens/closes.
- **C1 Calibration** (produces) — session outcomes feed `daily_reconciliation` / plan-vs-actual.
- **C4 Governance** (enforces) — session sign-off requires authorization via `engine_authority_config`.

Complementary lens: **Module 4 Operations** (`docs/architecture/modules/SMARTOUT_MODULE_4_OPERATIONS.md`) is canonical business-logic spec. **Season = the battlefield you prepare. Department Session = the daily battle.**

### In-Scope Surfaces

| Surface | Path | Owner |
|---|---|---|
| Operations dashboard (web) | `apps/web/src/app/dashboard/operations/**` | This campaign |
| Operations Calendar (mobile) | `apps/mobile/**` calendar views | This campaign |
| Department Session runtime | `department_session`, `session_hook`, `session_task`, `recurring_task_config` | This campaign |
| Deviation flow | `deviation`, `DeviationDialog.tsx` | This campaign |
| Daily reconciliation surfacing | `daily_reconciliation`, `workspace_budget` readouts | This campaign |
| Day notes / bookings / shift notes | `schedule_day_message`, `schedule_day_booking`, `shift_note` | This campaign (read-integration only) |
| Engine Event consumers for D6 hooks | `engine_dispatch`, `assign_task`, `schedule_control` handlers wired to session hooks | This campaign |

### Explicit Out-of-Scope

- **Scheduling authoring** (drag-drop, shift composition) — stays on web per ADR-0133; not this campaign.
- **Season / year-wheel planning** — handled by `campaign/year-wheel`.
- **Helpdesk / channel tickets** — handled by `campaign/helpdesk` (ticket = `engine_state`, not D6).
- **Botsson / agent-router / voice capabilities** — handled by `campaign/botsson-arena`.
- **Onboarding wizard / contract composition / governance authoring** — web-only per ADR-0133; not this campaign.

> If a task slides into out-of-scope territory, stop and flag it — do not cross campaign boundaries silently.

---

## Source of Truth (narrowed)

Read these before touching D6 code:

0. `docs/ORIENTATION.md` — North Star cheat sheet (first at session start).
1. **Code + DB schema** — always wins.
2. **Module 4 spec** — `docs/architecture/modules/SMARTOUT_MODULE_4_OPERATIONS.md`.
3. **Cascade spec** — `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (§D6, §C1, §C4).
4. **Operations Calendar spec** — `docs/superpowers/specs/2026-03-28-operations-calendar-design.md` (mobile).
5. **Mobile Production Readiness spec** — `docs/superpowers/specs/2026-03-26-mobile-production-readiness-design.md`.
6. **Operations UI journeys** — `docs/journeys/JOURNEY-operations-ui-redesign.md`.
7. **Decision log** — `docs/decisions/0000-decision-log.md` (filter: D6, session, task, operations).

### Directly-Relevant ADRs

Skim at session start; re-read before changing the affected area:

- **ADR-0047** — schedule DB persistence (informs session↔shift join paths).
- **ADR-0075** — orientation / doc hierarchy (how this file fits).
- **ADR-0078** — channel policy (D6 notifications never route secrets by voice).
- **ADR-0127–0131** — Mobile Strategy Council verdict (web composes, mobile executes).
- **ADR-0132** — Mobile AI Routing (thin-client, BFF → stage-engine, no direct capability calls).
- **ADR-0133** — Mobile Surface Boundary: **D6 production + C4 acceptance belong to mobile**; authoring stays web. *This campaign is the canonical implementation of the mobile side of ADR-0133.*
- **ADR-0134** — Mobile Telemetry Contract (workspace_id + actor_id non-null, `getProfileContext()`, Zod-validated offline queue).
- **ADR-0135** — LiveKit on mobile (not Ultravox).
- **ADR-0136** — camera evidence (D6 witness mode).

> New D6-related decisions during this campaign land in `docs/decisions/` and are registered before merging to development.

---

## Sibling Campaigns (awareness, not dependency)

| Campaign | Worktree | What they own |
|---|---|---|
| helpdesk | `~/dev/smartout.ai-helpdesk` | `channel_type='desk'` + `engine_state` as ticket. Phase 1 merged; Phase 2 active (SLA orb, auto-assign, mobile embed). |
| year-wheel | `~/dev/smartout.ai-year-wheel` | Season planning (D4 demand, `planning_cycle`, `season_budget`). |
| botsson-arena | `~/dev/smartout.ai-botsson-arena` | Agent capability work, voice routing, stage-engine. |

If D6 work needs something from a sibling campaign, open a coordination note; never duplicate their tables or routes here.

---

## Database Focus

Tables this campaign mutates or consumes heavily. Review `database.types.ts` before changing any of them:

- `department_session` (D6 runtime instance)
- `session_hook` (time-bound phases)
- `session_task` (work against hooks)
- `recurring_task_config` (task templates)
- `deviation` (failure capture)
- `schedule_shift` (read: who's on)
- `schedule_absence` (read: who's out)
- `schedule_day_booking`, `schedule_day_message`, `shift_note` (day context read-integration)
- `daily_reconciliation`, `workspace_budget` (C1 readout)
- `engine_process`, `engine_state`, `engine_state_step` (hook → action wiring)
- `engine_authority_config` (C4 gate for sign-off)
- `activity_trail`, `engine_event` (telemetry destinations)

**Hard rules inherited from the project CLAUDE.md — all apply, no exceptions:**

- All new tables require `workspace_id`, `created_at`, `updated_at`, UUID PK.
- Migrations only via `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
- RLS everywhere. Both JWT **and** API key policies for any workspace-scoped table.
- Never hardcode regulatory rates — use `framework_rule` / `tariff_rate_table`.
- Never reference `operating_hours` — use `department_operating_hours` + `resolve_hours()`.
- **Never mix dimension concerns** — D6 writes D6 tables. Do not stuff D4 demand data into `session_task`.
- **Cascade pipeline ≠ Event Engine** — cascade produces session state; Event Engine consumes hooks to dispatch work.
- **Develop against Supabase Local only.** `npx supabase start`. Never the Cloud DB.

**Load the `smartout-database-guide` skill before any SQL or schema work.**

---

## Mobile Parity — Hard Rule for This Campaign

D6 is where ADR-0133 "mobile executes" is load-bearing. Every feature in this campaign must:

1. **Data layer in `packages/`** (shared hooks, schemas, emit registry) — not `apps/web/`.
2. **Web UI in `apps/web/src/app/dashboard/operations/`** — composition / oversight only.
3. **Mobile UI in `apps/mobile/`** — execution / witness / confirm. Can ship as follow-up PR but architecture must support it from day one.

**Forbidden on mobile in this campaign:** drag-drop schedule editors, recurring-task authoring, authority-config screens.
**Required on mobile in this campaign:** hook execution, task completion with camera evidence (ADR-0136), biometric C4 sign-off, GPS clock-in, push-driven task cards.

**Mobile telemetry:** every mutation MUST resolve `workspace_id` (non-null, non-empty) + `actor_id` via `getProfileContext()` (`apps/mobile/src/lib/profile-context.ts`) BEFORE `emit()`. Empty-string fallback = forbidden (ADR-0134). Offline-queue payloads Zod-validated at enqueue.

---

## Telemetry — D6 Events Registry

Every D6 mutation emits. Registry lives in `packages/telemetry/src/registry.ts`. When adding a new mutation:

1. Add event to the registry (canonical `domain.verb_noun` name — e.g. `session.opened`, `task.completed`, `deviation.raised`).
2. Wire all four destinations: PostHog, Logger, `activity_trail`, `engine_event`.
3. Never create a parallel event stream. `emit()` is the only path.
4. No mutation without `emit()` in the `onSuccess` of the TanStack mutation or Server Action.

---

## UI & Styling

- **Design System:** Nordic Split. Load the `smartout-nordic-split` skill before any `.tsx`/`.css` edit in `apps/web/` or `apps/mobile/` that touches visual output.
- Hardcoded colors (`zinc-800`, `gray-*`) — forbidden. Use CSS variables (`bg-background`, `text-foreground`, `border-border`).
- Instrument Serif for `font-heading`; Geist Sans body; Geist Mono data.
- Lucide icons only. No emojis in UI.

---

## What NOT To Do (campaign-scoped additions)

Inherits everything in the development-branch project CLAUDE.md, plus:

- Never invent a new "daily state" table when `department_session` + `session_hook` + `session_task` already model it.
- Never bypass `engine_dispatch` to fire hook actions from the UI — hooks run through the Event Engine.
- Never gate session sign-off without `engine_authority_config` (C4). "Confident ≠ Authorized."
- Never build a D6 authoring UI on mobile (ADR-0133). If you find yourself reaching for a drag-drop, stop.
- Never duplicate helpdesk logic — if a task starts looking like a ticket with SLA, you're in the wrong campaign.
- Never route D6 notifications through voice channels by default (ADR-0078).
- Never treat the session timeline as read-only state in the DB — hooks mutate their own `status`/`completed_at` and emit events.

---

## Workflow in This Worktree

- **Direct commits to `campaign/daily-operation`** are fine for small in-campaign fixes/docs.
- **Sub-sorties** for larger features: `/start-feature <sub>` from inside this worktree creates `~/dev/smartout.ai-daily-operation-wt-N` on `feat/daily-operation-<sub>`.
- **Close a sub-sortie** with `/close-feature` — merges to `campaign/daily-operation` and syncs `origin/development` in.
- **Never** run `/close-feature` on `campaign/daily-operation` itself — campaigns don't close.
- **Keep fresh** with `/sync-campaign` when `development` moves ahead.
- Promotion to `development` is a manual PR/push when a milestone is ready.

### Feature closure gates (per sub-sortie)

Required before `close-feature.sh`:

1. Decision log updated for any new ADRs.
2. `docs/journeys/JOURNEY-<sub>.md` written (every flow: admin, manager, employee; happy + error paths).
3. `pnpm turbo typecheck` passes with 0 errors.
4. Handoff written (decisions + learnings + next steps).
5. Recommended: E2E test per journey in `apps/e2e/`, manual-test doc for UX checks.

---

## Documentation Protocol

1. This file wins for campaign scoping. Project CLAUDE.md (on development) wins for structural facts.
2. Module 4 spec wins for business logic.
3. Cascade spec wins for dimensional correctness.
4. If code contradicts any doc — **code wins**; update the doc in the same PR.
5. Every new doc in `docs/` gets YAML frontmatter; update `updated:` on every touch.
6. Never load `docs/archive/` — superseded.

---

## Changelog

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-04-20 | 1.0.0 | Campaign-scoped rewrite — narrows CLAUDE.md to daily-operation (D6) purpose. | Pontus + Claude |
