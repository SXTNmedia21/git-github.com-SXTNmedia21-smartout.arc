---
title: "Journey — ui-shell-r1-fixup"
status: verified
feature: r1-fixup
updated: 2026-05-17
created: 2026-05-17
module: ui-shell
tags: [journey, council-followup, r1-fixup, migration, telemetry, wcag, i18n]
---

# Journey — ui-shell-r1-fixup

> R1 council fixup. Closes 3 hard blockers (B1+B2 ×2) + 4 required-before-promote (J3+J4+J5) from 2026-05-17 council on campaign/ui-shell shippability.

## Journey 1: HOP A migration apply succeeds (B1 — migration discipline restored)

**Precondition:** Pontus runs `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` after F1 merges to campaign/ui-shell.

1. Operator invokes promote-preview.sh from `~/dev/smartout.ai` on `development`.
2. Gate 1 (sync) → System verifies `campaign/ui-shell` is FF-ahead of `development` → passes.
3. Gate 2 (CI) → System runs `.github/scripts/migration-lint.sh` on the 7 campaign-new migrations.
4. Check 1 (timestamp > BASE_TIP) → All 7 migrations have timestamps > dev tip `20260616130000` → PASS.
5. Check 2 (`CREATE TABLE IF NOT EXISTS` forbidden) → `_shift_lifecycle_pipeline_v2.sql` no longer contains the forbidden pattern (sortie removed it) → PASS.
6. Check 3 (duplicate timestamps within new-files set) → No two migrations share a timestamp after retimestamp → PASS.
7. Gate 4 (Branch DB apply) → Supabase applies migrations in lexical order → `schema_migrations.version` PK takes no duplicate → all 7 migrations land cleanly → PASS.
8. Operator sees green CI status across all 14 required checks → proceeds to HOP B.

**Postcondition:** campaign/ui-shell migrations applied to preview branch DB without `schema_migrations_pkey` violation. HOP A unblocked.

**Error paths:**
- If retimestamp creates a collision with a sibling-campaign migration (rare but possible): grep `git log --all --name-only | grep -E '20260617110[12]00'` before HOP A; if collision detected, bump by 1 hour.
- If a developer's local DB has the pre-retimestamp draft of `_shift_lifecycle_pipeline_v2.sql` applied: `supabase db reset` recovers; document recovery in HANDOFF.

## Journey 2: Admin views deviation, telemetry pipeline records the view (B2a — deviation_viewed wired)

**Precondition:** Admin/manager opens a deviation detail drawer from `/dashboard/hms/deviations` list.

1. User clicks deviation row → System opens `DeviationDetailDrawer`.
2. Drawer mounts → System resolves `useProfileContext()` → returns non-empty `workspace_id` + `actor_id` (L-0177 fail-fast: throws if either is empty).
3. `useEffect` with `useRef`-guard fires once → System calls `emit({ event: 'deviation.viewed', workspace_id, actor_id, properties: { deviation_id } })`.
4. emit() routes to PostHog (analytics) + Logger (stdout) + activity_trail (audit) + engine_event (workflow automation) per ADR-0134.
5. Drawer body renders deviation content → User sees deviation detail.
6. Admin queries activity_trail for the workspace → System returns `deviation.viewed` row with non-empty actor + workspace.

**Postcondition:** Telemetry registry entry `deviation_viewed` now has matching emit() call-site. Phantom contract closed.

**Error paths:**
- If `workspace_id` resolves empty → `getProfileContext()` throws → emit never runs (correct fail-fast). No corrupt activity_trail row.
- If drawer remounts (race): `useRef` guard prevents duplicate emit per mount-cycle.

## Journey 3: Employee reads handbook chapter, telemetry records the open (B2b — handbook_chapter_opened wired)

**Precondition:** Employee navigates to `/dashboard/handbook` and selects a chapter.

1. User clicks chapter in handbook TOC → System routes to `ChapterReader` component with `chapter_key` param.
2. Component mounts → System resolves `useProfileContext()` → returns non-empty workspace_id + actor_id (L-0177).
3. `useEffect` keyed by `chapter_key` fires → System emits `handbook.chapter_opened` with `{ chapter_key }` in properties.
4. emit() routes to all four destinations per ADR-0134.
5. Chapter body renders → User sees handbook content.

**Postcondition:** `handbook_chapter_opened` registry entry has matching emit() call-site. Per-chapter analytics now flows to PostHog.

**Error paths:**
- Same L-0177 fail-fast as Journey 2.
- Chapter-switch within same component instance: `useEffect` re-fires on `chapter_key` change → distinct emit per chapter.

## Journey 4: Tier 1 /help surface handles error gracefully + has tool registration scaffold (J3)

**Precondition:** Employee/admin navigates to `/dashboard/help`.

1. User clicks Help in sidebar → System routes to `/dashboard/help`.
2. Page server-renders → User sees help content.
3. (Failure path) An unhandled error occurs in a child component → Next.js error boundary fires → System renders `apps/web/src/app/dashboard/help/error.tsx`.
4. Error boundary shows "Noe gikk galt — vi jobber med å fikse det" in Norwegian + "Last siden på nytt" retry button + sentry-correlation-id.
5. User clicks retry → Error boundary re-renders → page loads.

**Plus:** `_tools/` directory present with skeleton `help-tools-bridge.tsx` registering minimal harness tools (per ADR-0357 NEVER-skippable axes; even empty bridge counts as registration).

**Postcondition:** /help Tier 1 baseline restored. Page-Polish audit STRICT-FAIL closed.

**Error paths:**
- error.tsx itself errors → Next.js falls back to global-error.tsx (out of scope for F1; verified to exist already).

## Journey 5: Keyboard-only user navigates procedure detail tabs (J4 — WCAG 4.1.2 + 2.4.11 fixed)

**Precondition:** Trainer/admin viewing a protocol detail page that mounts `ProcedureDetailTabs` (Oversikt / Steg / Quiz / Bekreftelse).

1. User presses Tab → System focuses first tab → User sees visible focus ring (Nordic Split ring tokens — ADR-0357 v2 carve-out).
2. Screen reader announces "tab 1 of 4 selected — Oversikt" (System exposes `role="tab"` + `aria-selected="true"` + `aria-controls="panel-oversikt"`).
3. User presses Arrow Right → System moves focus to "Steg" tab → reader announces "tab 2 of 4 — Steg".
4. User presses Enter → System updates `aria-selected` on new tab + flips panel visibility → reader announces "Steg panel".
5. Procedure body renders with all i18n labels (no hardcoded Norwegian) — see Journey 6.

**Postcondition:** WCAG 4.1.2 (Name, Role, Value) compliant. WCAG 2.4.11 (Focus Appearance) compliant. 7th L-0147 precedent closed forward.

**Plus (same journey, separate component):** keyboard-only user navigates `DayTimelineStrip`.

6. User presses Tab through time-slot add buttons (line 534) → System shows focus ring on each → keyboard nav not blocked.
7. User presses Tab through event markers (line 618) → System shows focus ring decoupled from selection state.

**Error paths:**
- Screen reader announces panel mismatch → unlikely; aria-controls binds explicitly to panel IDs.

## Journey 6: Norwegian/English user sees correct labels in ProcedureDetailTabs (J5 — i18n migration)

**Precondition:** Trainer opens a procedure detail page. Workspace locale = `nb` or `en`.

1. User selects workspace with `locale=nb` → System renders tab labels: "Oversikt", "Steg", "Quiz", "Bekreftelse" from `messages/nb/dashboard.json` keys `hms.procedureDetailTabs.{overview,steps,quiz,confirmation}`.
2. User selects English locale → System renders: "Overview", "Steps", "Quiz", "Confirmation" from `messages/en/dashboard.json`.
3. Step requires confirmation → System shows i18n-keyed "Påkrevd" badge (typo `"Pakrevd"` fixed in nb file).
4. Error/placeholder copy renders from i18n keys, not hardcoded literals.

**Postcondition:** Zero hardcoded Norwegian in `ProcedureDetailTabs.tsx`. CLAUDE.md mandate respected. `"Påkrevd"` typo corrected.

**Error paths:**
- Missing translation key → i18n library shows key path (e.g. `hms.procedureDetailTabs.overview`) instead of label → caught by unit test on key presence + by CI i18n-validate (if present).
