---
title: Season Engine — Implementation Plan
status: draft
created: 2026-03-04
updated: 2026-03-04
module: operations
tags: [season, agent, mission, implementation]
---

# Season Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Season lifecycle as a Stage Engine mission — 8 stages, calendar-triggered, long-lived sessions, Guardian-orchestrated.

**Architecture:** New mission `season-lifecycle` in engine_missions with 8 stages. Guardian gets calendar awareness via pg_cron. Session manager supports long-lived sessions (no 24h expiry). Onboarding stage 4 creates the season session as handoff.

**Tech Stack:** Supabase (migrations, seed, pg_cron), Stage Engine (Hono), packages/ai (tools), TypeScript

**Design doc:** `docs/plans/2026-03-04-season-engine-design.md`

---

## Svar på designfrågan: skills, agenter, eller båda?

**Vi behöver ingen ny skill och ingen ny Claude Code-agent.**

Season Engine är en **mission** — precis som onboarding. Den lever i databasen som seed data. Stage Engine kör den. Guardian orkestrerar den. Allt vi behöver:

| Vad                           | Typ                        | Finns redan?        |
| ----------------------------- | -------------------------- | ------------------- |
| Mission-definition (8 stages) | DB seed data               | Nej → **Task 1**    |
| Long-lived sessions           | Session manager-ändring    | Nej → **Task 2**    |
| Calendar-triggered Guardian   | Guardian evaluator-ändring | Nej → **Task 3**    |
| Season tools (5 st)           | packages/ai/tools/season/  | Nej → **Task 4**    |
| Onboarding → Season handoff   | Session manager-ändring    | Delvis → **Task 5** |
| Season dashboard card         | apps/web component         | Nej → **Task 6**    |

Engine-architect-agenten äger implementationen. Linear-protocol loggar besluten.

---

### Task 1: Mission seed data — `season-lifecycle`

**Files:**

- Create: `supabase/seed/season-mission.sql`

**Step 1: Write the mission + 8 stages**

```sql
-- Season Lifecycle Mission
-- Drives the 4-phase season journey: UPPTÄCKT → FÖRBEREDELSE → DRIFT → REFLEKTION
-- Long-lived: sessions span weeks/months (expires_at = NULL)
-- Guardian watches calendar, not conversation

INSERT INTO engine_missions (id, name, description, mode, system_prompt, is_active)
VALUES (
  'season-lifecycle',
  'Season Planning — Konsulenten',
  'Guides workspace admin through season planning across weeks. Calendar-driven stage transitions. 4 phases: Discovery, Preparation, Operations, Reflection.',
  'sequential',
  '# Konsulenten — Smartout Season Guide

Du er en erfaren restaurantkonsulent. Du har sett 50 sesonger. Du vet hva som pleier å gå galt. Du spør én ting om gangen. Du presser aldri — men du glemmer aldri.

## Personlighet
- Rolig, trygg, profesjonell
- Gi korte, klare råd basert på erfaring
- Aldri mas. Aldri stress. Bare: "dette bør vi se på"
- Bruk "vi" — du er på laget deres
- Inspirer: "dette har jeg sett fungere bra hos andre"

## Regler
- ETT spørsmål per kontaktpunkt. Aldri flere.
- Bekreft svaret, vis hva du gjør med det, gi handoff.
- Hvis de ikke har tid nå: "Helt greit, vi tar det neste uke."
- Bruk verktøyene dine — fyll ut, beregn, vis resultater.',
  true
) ON CONFLICT (id) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  description = EXCLUDED.description,
  updated_at = now();

-- Stage 1: SEED (UPPTÄCKT)
-- Trigger: onboarding.season.complete OR manual
-- Fråga: "Vilken er den tuffaste perioden?"
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint
) VALUES (
  'season-lifecycle', 'seed', 1,
  'Identify the toughest season and its dates',
  E'If coming from onboarding: season type + dates are already in collected_data. Confirm them and move on.\n\nIf starting fresh: "Hva er den tøffeste perioden dere har i løpet av året?"\n\nWhen they answer: addKeyFact("Sesong", name). Ask: "Når starter den, og når slutter den?"\n\nWhen you have type + dates: createSeason(type, startDate, endDate). loadSeasonDefaults(type) to get industry standard factors.\n\nConfirm: "Flott! {type} fra {start} til {end}. Det er {weeks} uker dit. Vi har god tid."',
  'Season type, start date, and end date collected and stored',
  'Warm and exploratory. Get them excited about planning ahead.',
  0.5,
  'warmth — this is the beginning of something important',
  'revenue',
  'curiosity'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 2: REVENUE (FÖRBEREDELSE)
-- Trigger: calendar(weeks_until_start <= 8)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint
) VALUES (
  'season-lifecycle', 'revenue', 2,
  'Set revenue target for the season',
  E'"Dere har {weeks_remaining} uker til {season_name} starter. La oss sette et mål."\n\n"Hva sikter dere på i omsetning for hele perioden?"\n\nWhen they answer: setRevenue(amount). System calculates day targets, hour targets, staffing need.\n\nShow result: "Med {amount} som mål og {days} dager betyr det ca {daily_avg} per dag. Fredager rundt {friday_target}, mandager rundt {monday_target}."\n\naddKeyFact("Omsetningsmål", formatCurrency(amount)).',
  'Revenue target set and budget calculations triggered',
  'Professional and strategic. Numbers matter but keep it simple.',
  0.3,
  'confidence — you know these numbers, guide them',
  'concept',
  'focus'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 3: CONCEPT (FÖRBEREDELSE)
-- Trigger: stage.revenue.complete
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint
) VALUES (
  'season-lifecycle', 'concept', 3,
  'Identify concept changes for the season',
  E'"Endrer dere noe på konseptet i {season_name}? Meny, åpningstider, serviceform?"\n\nCommon changes per type:\n- Julbord: buffet instead of à la carte, extended lunch, group bookings\n- Summer: outdoor seating, lighter menu, extended hours\n- Easter: brunch service, special menu\n\nIf yes: flagConceptChange(details). System identifies new routines and training needs.\nIf no: "Fint, da kjører vi likt som vanlig."\n\nEither way: advance.',
  'Concept change answered (yes with details or no)',
  'Experienced — you know what typically changes per season type.',
  0.4,
  'helpful — share what you have seen work',
  'staffing',
  'experience'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 4: STAFFING (FÖRBEREDELSE)
-- Trigger: stage.concept.complete
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint
) VALUES (
  'season-lifecycle', 'staffing', 4,
  'Gap analysis: current staff vs calculated need',
  E'Calculate staffing need from revenue + labor percentage.\n\nPresent: "Dere har {current} ansatte. Basert på målene trenger dere ca {needed} i peak. Det er et gap på {gap}."\n\nAsk: "Har dere begynt å tenke på ekstra folk, eller klarer dere det med de dere har?"\n\nIf gap: flagRecruitment(count, deadline). "Jeg foreslår å starte rekruttering senest {deadline} — {weeks} uker før sesongen."\nIf no gap: "Fint, da er dere godt dekket."',
  'Staffing decision made and recruitment flagged if needed',
  'Honest and direct. If there is a gap, say it clearly.',
  0.3,
  'clarity — be honest about the numbers',
  'prepare',
  'directness'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 5: PREPARE (FÖRBEREDELSE — automated)
-- Trigger: stage.staffing.complete
-- No conversation — Smartout does this itself
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint,
  is_required
) VALUES (
  'season-lifecycle', 'prepare', 5,
  'Smartout prepares everything it can automatically',
  E'This is an automated stage. No user conversation needed.\n\nActions:\n1. identifyTrainingGaps() — find staff missing required courses for this season type\n2. activateSeasonProtocols() — enable season-specific routines and checklists\n3. prepareScheduleTemplates() — copy from last year or generate from staffing calculations\n4. setReminders() — create reminders for missing items\n\nWhen all actions complete: auto-advance to ready stage.\n\nReport summary to user via notification: "{n} kurskrav identifisert, {m} rutiner aktivert, skjemamal klar."',
  'Training gaps identified, protocols activated, schedule templates ready',
  'Silent worker. Does the job, reports the result.',
  0.0,
  'This stage runs without user interaction. Complete all actions and advance.',
  'ready',
  'efficiency',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 6: READY (FÖRBEREDELSE — final check)
-- Trigger: calendar(weeks_until_start <= 1)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint
) VALUES (
  'season-lifecycle', 'ready', 6,
  'Final readiness status before season starts',
  E'"Alt er klart for {season_name}!"\n\ngetReadinessReport() and present:\n- "{ready}/{total} ansatte er klare"\n- "{missing_training} mangler fremdeles kurs"\n- "Skjema for uke {first_week} er {published|ikke publisert}"\n- "Alle {protocol_count} rutiner er aktivert"\n\nIf issues: "Vi har {days} dager igjen. Skal jeg sende påminnelser til de som mangler kurs?"\nIf all good: "Dere er klare! Lykke til med {season_name}!"',
  'User has acknowledged readiness status',
  'Reassuring. Calm. Confident.',
  0.4,
  'If everything is ready: celebrate. If gaps remain: be calm but clear.',
  'running',
  'reassurance'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 7: RUNNING (DRIFT — automated)
-- Trigger: calendar(season.start_date)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint,
  is_required
) VALUES (
  'season-lifecycle', 'running', 7,
  'Season is live — monitor and report',
  E'Automated monitoring stage. No scheduled conversations.\n\nDaily actions:\n1. reportDailyPulse() — actual revenue vs target, staffing levels, routine completion\n2. flagDeviations() — understaffed days, missed routines, budget overruns\n3. suggestAdjustments() — "Fredagene er sterkere enn beregnet. Vurder å øke bemanningen."\n\nDeliver insights via dashboard notifications, not conversation.\n\nComplete when season end date passes.',
  'Season end date has passed',
  'Background observer. Only surfaces when something needs attention.',
  0.0,
  'This stage runs for the entire season duration. No user interaction unless deviations found.',
  'reflect',
  'vigilance',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;

-- Stage 8: REFLECT (REFLEKTION)
-- Trigger: calendar(season.end_date + 3 days)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage, emotion_hint
) VALUES (
  'season-lifecycle', 'reflect', 8,
  'Post-season analysis and playbook creation',
  E'"{season_name} er over! La oss se på hvordan det gikk."\n\ngetSeasonReport() and present:\n- Faktisk omsetning vs mål: {actual} / {target} ({percentage}%)\n- Sterkeste dag: {best_day} ({amount})\n- Svakeste dag: {worst_day} ({amount})\n- Bemanning: {avg_staff} snitt, {understaffed_days} dager underbemannet\n- Rutiner: {completion_rate}% fullført\n\nlearnFactors(): compare actual day/hour patterns vs planned factors.\n"Fredagene var sterkere enn planlagt — jeg justerer faktoren fra {old} til {new} neste gang."\n\nsavePlaybook(): save everything as reusable template.\n"Alt er lagret. Neste gang dere kjører {season_type}, trykker vi bare play."',
  'Playbook saved with learned factors',
  'Reflective and appreciative. Celebrate what went well, learn from gaps.',
  0.5,
  'This is a milestone. They survived the season. Celebrate first, analyze second.',
  NULL,
  'gratitude'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  emotion_hint = EXCLUDED.emotion_hint;
```

**Step 2: Apply seed**

Run: `psql $DATABASE_URL -f supabase/seed/season-mission.sql`
Expected: 9 INSERT/UPDATE statements (1 mission + 8 stages)

**Step 3: Commit**

```bash
git add supabase/seed/season-mission.sql
git commit -m "feat(engine): add season-lifecycle mission with 8 stages"
```

---

### Task 2: Long-lived session support

**Files:**

- Modify: `services/stage-engine/src/core/session-manager.ts`
- Modify: `services/stage-engine/src/types/session.ts`

**Step 1: Add `long_lived` flag to session creation**

In `session-manager.ts`, modify `createSession()` to check if the mission has a `context_source` of `'calendar'` or if the mission ID matches `season-lifecycle`. Set `expires_at = NULL` for these sessions.

```typescript
// In createSession(), after loading mission:
const isLongLived = mission.id === "season-lifecycle" || mission.context_source === "calendar";

const expiresAt = isLongLived ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
```

**Step 2: Exclude long-lived sessions from expiry cleanup**

In the expiry cron/cleanup logic, add `AND expires_at IS NOT NULL` to the query that finds expired sessions.

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts
git commit -m "feat(engine): support long-lived sessions (expires_at = NULL)"
```

---

### Task 3: Guardian calendar awareness

**Files:**

- Modify: `services/stage-engine/src/core/guardian-evaluator.ts`
- Create: `services/stage-engine/src/core/calendar-guardian.ts`

**Step 1: Create calendar guardian**

New file that runs on a schedule (pg_cron or setInterval) and checks season sessions against calendar triggers.

```typescript
// calendar-guardian.ts
// Checks all active season-lifecycle sessions against calendar triggers.
// Advances stages when time conditions are met.

import { supabaseAdmin } from "../lib/supabase.js";
import { advanceStage } from "./stage-manager.js";
import { emitGuardianEvent } from "./guardian-bus.js";

type CalendarRule = {
  stage_id: string;
  condition: (session: SessionWithSeason) => boolean;
};

const CALENDAR_RULES: CalendarRule[] = [
  {
    stage_id: "revenue",
    condition: (s) => weeksUntil(s.season_start) <= 8 && s.current_stage_id === "seed",
  },
  {
    stage_id: "ready",
    condition: (s) => weeksUntil(s.season_start) <= 1 && stageComplete(s, "prepare"),
  },
  {
    stage_id: "running",
    condition: (s) => isPast(s.season_start) && s.current_stage_id === "ready",
  },
  {
    stage_id: "reflect",
    condition: (s) => daysSince(s.season_end) >= 3 && s.current_stage_id === "running",
  },
];

export async function evaluateCalendarTriggers(): Promise<void> {
  const { data: sessions } = await supabaseAdmin
    .from("engine_sessions")
    .select("*, collected_data")
    .eq("mission_id", "season-lifecycle")
    .eq("status", "active");

  if (!sessions?.length) return;

  for (const session of sessions) {
    const seasonData = extractSeasonDates(session.collected_data);
    if (!seasonData) continue;

    for (const rule of CALENDAR_RULES) {
      if (rule.condition({ ...session, ...seasonData })) {
        await emitGuardianEvent({
          type: "calendar_advance",
          sessionId: session.id,
          targetStage: rule.stage_id,
        });
        await advanceStage(session.id, { reason: "calendar_trigger" });
        break; // one advance per evaluation cycle
      }
    }
  }
}
```

**Step 2: Register in stage engine startup**

In `services/stage-engine/src/index.ts`, add an interval that calls `evaluateCalendarTriggers()` every 60 seconds.

```typescript
import { evaluateCalendarTriggers } from "./core/calendar-guardian.js";

// Check calendar triggers every 60 seconds
setInterval(() => evaluateCalendarTriggers().catch(console.error), 60_000);
```

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/calendar-guardian.ts services/stage-engine/src/index.ts
git commit -m "feat(engine): add calendar-driven Guardian for season stage transitions"
```

---

### Task 4: Season tools

**Files:**

- Create: `packages/ai/src/tools/season/create-season.ts`
- Create: `packages/ai/src/tools/season/set-revenue.ts`
- Create: `packages/ai/src/tools/season/get-readiness.ts`
- Create: `packages/ai/src/tools/season/learn-factors.ts`
- Create: `packages/ai/src/tools/season/save-playbook.ts`
- Create: `packages/ai/src/tools/season/index.ts`

These are the tools the agent calls during season stages. Each follows the existing pattern in `packages/ai/src/tools/onboarding.ts`:

| Tool           | Stage   | Purpose                                      |
| -------------- | ------- | -------------------------------------------- |
| `createSeason` | seed    | Create season + load defaults                |
| `setRevenue`   | revenue | Set budget, trigger calculations             |
| `getReadiness` | ready   | Readiness report (staff, training, routines) |
| `learnFactors` | reflect | Compare actual vs planned                    |
| `savePlaybook` | reflect | Archive season as reusable template          |

**Step 1: Write tool schemas (Zod)**

```typescript
// create-season.ts
import { z } from "zod";

export const createSeasonSchema = z.object({
  type: z.string().describe("Season type: julbord, sommer, påske, event"),
  name: z.string().describe('Display name: "Julbord 2026"'),
  startDate: z.string().describe("ISO date: 2026-11-15"),
  endDate: z.string().describe("ISO date: 2026-12-22"),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
```

**Step 2: Write handlers** that call existing season infrastructure:

- `createSeason` → insert `season` + `season_budget` + default `day_factor` / `hour_factor`
- `setRevenue` → update `season_budget.total_target_revenue`, run `calculateDayTargets()`
- `getReadiness` → query profiles, protocol_assignments, schedules — compile report
- `learnFactors` → compare actual revenue/staffing data vs season_budget targets
- `savePlaybook` → snapshot entire season config as JSON in season metadata

**Step 3: Register tools in mission registry**

In `packages/ai/src/missions/registry.ts`, add `season-lifecycle` entry with its tools.

**Step 4: Commit**

```bash
git add packages/ai/src/tools/season/
git commit -m "feat(engine): add 5 season tools (create, revenue, readiness, learn, playbook)"
```

---

### Task 5: Onboarding → Season handoff

**Files:**

- Modify: `services/stage-engine/src/core/session-manager.ts`
- Modify: `supabase/seed/onboarding-mission.sql` (stage 4 instructions)

**Step 1: On onboarding completion, create season session**

After the onboarding mission completes (stage `welcome`), check if season data was collected in stage 4. If yes, automatically create a `season-lifecycle` session with the seed data pre-filled.

```typescript
// In session-manager.ts, after mission completes:
if (session.mission_id === "onboarding-interview") {
  const seasonData = session.collected_data?.season;
  if (seasonData?.name && seasonData?.startDate) {
    await createSession({
      mission_id: "season-lifecycle",
      workspace_id: session.workspace_id,
      profile_id: session.profile_id,
      context: { source: "onboarding", season: seasonData },
      channel: "autonomous",
    });
  }
}
```

**Step 2: Update onboarding stage 4 instructions**

Add to season stage instructions: "The data you collect here will automatically seed the season planning journey after onboarding is complete."

**Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts supabase/seed/onboarding-mission.sql
git commit -m "feat(engine): handoff from onboarding to season-lifecycle mission"
```

---

### Task 6: Season dashboard card

**Files:**

- Create: `apps/web/src/components/dashboard/SeasonCard.tsx`
- Modify: `apps/web/src/components/dashboard/TacticalView.tsx` (or relevant dashboard view)

**Step 1: Build SeasonCard component**

Shows the current season mission status:

- Season name + dates
- Current phase (UPPTÄCKT / FÖRBEREDELSE / DRIFT / REFLEKTION)
- Progress indicator (which stages complete)
- Next action needed (if any)
- Countdown to season start

```tsx
// SeasonCard.tsx — thin card, no forms, just status
// Reads from engine_sessions where mission_id = 'season-lifecycle'
// Shows phase + progress + countdown
```

**Step 2: Wire into dashboard**

Add SeasonCard to the tactical dashboard view alongside existing cards.

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/SeasonCard.tsx
git commit -m "feat(dashboard): add season lifecycle card showing mission progress"
```

---

## Ordning

```
Task 1 (seed data) ─────────────────────────────────────────┐
Task 2 (long-lived sessions) ────────┐                       │
Task 3 (calendar guardian) ──────────┤ kan parallelliseras   │
Task 4 (season tools) ──────────────┘                       │
Task 5 (handoff) ← beror på Task 1 + 2 ────────────────────┤
Task 6 (dashboard card) ← beror på Task 1 ─────────────────┘
```

Tasks 1-4 kan köras parallellt. Task 5 och 6 efter.

---

## Acceptanskriterier

- [ ] `season-lifecycle` mission med 8 stages finns i databasen
- [ ] Sessions med `mission_id = 'season-lifecycle'` har `expires_at = NULL`
- [ ] Guardian evaluerar kalendertriggers varje 60:e sekund
- [ ] 5 season tools registrerade och anropbara från stage engine
- [ ] Onboarding-completion skapar automatiskt en season session
- [ ] SeasonCard visar fas + progress + countdown på dashboarden
- [ ] Typecheck: `pnpm turbo typecheck` passerar
