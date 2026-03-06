---
title: "Journey — Season Engine Complete"
status: done
updated: 2026-04-10
created: 2026-04-10
module: operations
tags: [journey, season, engine, guardian, ai-tools]
---

# Journey — Season Engine Complete

> Full season lifecycle: from idea to post-season reflection, guided by Botsson AI and calendar-driven Guardian.

## Journey: Owner Plans a New Season (Voice/Chat with Botsson)

**Precondition:** Workspace exists with at least one department. Owner/admin has completed onboarding.

1. Owner completes onboarding mission -> Stage-manager detects completion -> System auto-creates season-lifecycle session for the workspace
2. Botsson opens with: "Hva slags sesong er det dere planlegger?" -> Owner provides name, type, dates -> Botsson calls `create_season(type, name, startDate, endDate)` -> Season record created in DB with status=draft
3. Botsson advances to revenue stage -> Asks about revenue targets -> Owner sets total revenue + labor percentage -> Botsson calls `set_revenue(totalRevenue, laborPercentage)` -> Season budget calculated and saved
4. Botsson advances to concept stage -> Asks about menus, events, opening hours -> Owner describes season concept -> Key facts saved to engine memory
5. Botsson advances to staffing stage -> Shows budget-to-headcount math -> Owner confirms department staffing needs -> Gaps identified (e.g., "2 kokker mangler")
6. Botsson advances to prepare stage -> Asks about day/hour busy patterns -> Owner sets day factors (Mon=0.5, Sat=2.0) and hour factors -> Botsson calls `learn_factors()` to save operational weights
7. Botsson advances to ready stage -> Calls `get_readiness()` -> Shows readiness checklist (budget, concept, staffing, operations) -> Owner confirms all green -> Season activated
8. Season enters running stage -> Botsson checks in weekly with performance vs. target -> "Dere ligger 12% over mal denne uken"

**Postcondition:** Season exists with budget, concept, staffing plan, and day/hour factors. Status = active. Engine session tracks current stage.

**Error paths:**

- Owner abandons mid-conversation -> Session persists (long-lived) -> Owner can resume anytime
- Missing data at readiness check -> Botsson flags gaps: "Vi mangler fortsatt X" -> Owner can fix or defer
- No engine session for active season -> useActiveSeason infers "running" stage as fallback

---

## Journey: Calendar Guardian Auto-Advances Season Stages

**Precondition:** Active season-lifecycle engine session exists. Season has start_date and end_date in DB.

1. Guardian evaluates every 60 seconds -> Queries all active season-lifecycle sessions
2. For each session, queries season table for authoritative dates
3. Applies calendar rules:
   - seed -> revenue: when season start is <= 8 weeks away
   - prepare -> ready: when season start is <= 1 week away
   - ready -> running: when season start_date has passed
   - running -> reflect: when 3+ days after season end_date
4. On match -> Emits `guardian.calendar_advance` event -> Calls `advanceStage()` -> Session moves to next stage
5. One advance per session per evaluation cycle (prevents double-jumps)

**Postcondition:** Session stage matches calendar reality. Guardian events logged for audit.

**Error paths:**

- Season has no start_date or end_date -> Guardian skips session (null check)
- No workspace_id on session -> Guardian skips (guard clause)
- DB query fails -> Error logged, other sessions still evaluated

---

## Journey: Admin Views Season Progress on Dashboard

**Precondition:** Admin is logged in to dashboard. At least one season exists (draft or active).

1. Admin navigates to dashboard -> StrategicView renders
2. `useActiveSeason` hook fires -> Queries season table for most recent draft/active season -> Queries engine_sessions for season-lifecycle mission progress
3. SeasonCard renders with:
   - Season name + type icon (auto-detected: summer=sun, winter=snowflake, etc.)
   - Phase badge (OPPDAGELSE / FORBEREDELSE / DRIFT / REFLEKSJON) with semantic colors
   - 8 stage-progression dots (completed=filled, current=pulsing, future=muted)
   - Countdown to season start ("3 uker igjen" / "Pagar na" / "Avsluttet")
   - Next action label ("Sett inntektsmal", "Planlegg bemanning", etc.)
4. Card updates on 60-second staleTime (TanStack Query)

**Postcondition:** Admin sees at-a-glance season lifecycle status.

**Error paths:**

- No season exists -> SeasonCard shows "Ingen aktiv sesong" with CircleDashed icon
- No workspace context -> useWorkspaceOptional returns null -> Query disabled, no crash

---

## Journey: Owner Completes Post-Season Reflection

**Precondition:** Season end_date has passed by 3+ days. Guardian has advanced session to "reflect" stage.

1. Botsson initiates: "Sesongen er over! La oss se pa hvordan det gikk."
2. Botsson calls `learn_factors()` -> Compares planned vs. actual day/hour patterns -> Shows variance: "Fredager var 15% travlere enn planlagt"
3. Owner discusses what worked and what didn't
4. Botsson captures specific learnings: "Notert: fredager trenger +1 servitor"
5. Botsson calls `save_playbook(notes)` -> Archives season data as reusable template
6. Botsson offers: "Klar for a begynne planlegging av neste sesong?"
7. If yes -> New season-lifecycle session created -> Back to seed stage

**Postcondition:** Season learnings documented. Playbook saved for next season. Optional: new season planning started.

**Error paths:**

- Owner doesn't want to reflect -> Session stays in reflect stage, no forced completion
- learn_factors() returns no data -> Botsson pivots to qualitative questions instead
