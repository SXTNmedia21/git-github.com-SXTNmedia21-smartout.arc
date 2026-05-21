---
title: "Audit Slice 08 — Journeys (ADR-0031, ADR-0038)"
status: done
created: 2026-05-20
updated: 2026-05-20
module: journeys
tags: [audit, journeys, adr-0031, adr-0038, frontmatter, missions]
auditor: claude-sonnet-4-6
---

# Slice 08 — Journey Docs, Implementation & Mission Registry

## Summary

| Dimension | Count | Severity |
|---|---|---|
| Frontmatter `module` field missing | 15 files | LOW |
| Frontmatter `tags` field missing | 11 files | LOW |
| Non-standard `status` values (excluding `verified`) | 10 files | LOW |
| `status: verified` — de-facto extension, unapproved | 304 files | MEDIUM |
| ADR-0031 schema — all 4 tables present in schema | PASS | — |
| ADR-0031 journey_status enum — 13 values correct | PASS | — |
| ADR-0038 wizard_session table present | PASS | — |
| ADR-0038 journey agent (6-phase, 3 tools) | PASS | — |
| ADR-0038 4 output generators (pure functions) | PASS | — |
| Missions registry consistent with types.ts | PASS | — |
| Baseline flag: `verified-with-deferred-gaps` on voice-polish file | CONFIRMED LOW | — |

**Overall: GREEN with 1 MEDIUM + 2 LOW clusters.**

---

## Findings

### F-08-01 — `status: verified` is an unapproved status extension (MEDIUM)

**Scope:** 304 of 501 JOURNEY-*.md files  
**Rule:** `CLAUDE.md §Mandatory YAML Frontmatter` specifies allowed values: `draft | in_progress | review | done | archived`  
**Reality:** `verified` appears 304 times and is the dominant status in the corpus. It is not in the allowed set and has no ADR or protocol registering it as an extension.

`docs/protocols/DOCUMENTATION.md` specifies a different set (`canonical | draft | superseded | archived`) for general docs. Neither schema includes `verified`.

The `journey` database table uses a completely separate 13-value enum (`idea | wizard | defined | ready_impl | building | review | ready_test | testing | ready_validation | implemented | active | inactive | broken`) that is correctly implemented in code and unrelated to the markdown frontmatter question.

**Impact:** `close-feature.sh` does not gate on frontmatter status values, so no merge blockage. However, the pattern represents schema drift — agents and tooling that parse frontmatter will encounter `verified` and have no canonical interpretation. The baseline audit (2026-05-20 run 01) flagged this slice's `verified-with-deferred-gaps` as MEDIUM; the root cause is the wider `verified` proliferation.

**Recommendation:** Register `verified` as a valid JOURNEY-file status extension via ADR or CLAUDE.md amendment, OR batch-rename to `done` (semantically equivalent for closed sorties). A single-line `sed` across 304 files is the mechanical fix.

---

### F-08-02 — 15 JOURNEY files missing `module` field; 11 missing `tags` (LOW)

**Files missing `module`:**
- `JOURNEY-hard-delete-operations-complete.md`
- `JOURNEY-helpdesk-primitives.md`
- `JOURNEY-mobile-kalender-task-wire.md`
- `JOURNEY-mobile-voice-runtime-wire-text-chat.md`
- `JOURNEY-mobile-voice-runtime-wire-tool-rpc.md`
- `JOURNEY-mobile-voice-runtime-wire-ux-polish.md`
- `JOURNEY-nordic-split-final-admin-alle-flater-konsistent.md`
- `JOURNEY-nordic-split-hub-admin-ser-konsistent-hub.md`
- `JOURNEY-nordic-split-org-dialogs-admin-ser-konsistent-org-tail.md`
- `JOURNEY-nordic-split-phase-1-admin-ser-konsistent-shell.md`
- `JOURNEY-nordic-split-phase-2-admin-ser-konsistent-organization.md`
- `JOURNEY-nordic-split-phase-3a-schedule-admin-ser-konsistent-schedule.md`
- `JOURNEY-nordic-split-reports-admin-ser-konsistent-reports.md`
- `JOURNEY-sortie-5a-voice-task-infra.md`
- `JOURNEY-task-capability-unify.md`

**Files missing `tags` (subset of above + `JOURNEY-helpdesk-primitives.md`):** 11 files total — all Nordic Split files + mobile voice runtime files + helpdesk-primitives.

**Pattern:** Two clusters — (1) Nordic Split phase series (`nordic-split-*`), (2) mobile voice runtime wire series. Both are recent campaign-era sorties (2026-05 timeframe) that appear to have used a lighter frontmatter template during rapid parallel dispatch.

**Impact:** Low. No gates broken. Journey Portal DB queries that filter by `module` will miss these 15 entries.

---

### F-08-03 — Additional non-standard `status` values (LOW)

Beyond `verified` (304) and `verified-with-deferred-gaps` (1), the following non-standard values appear:

| Value | Count | Example file |
|---|---|---|
| `accepted` | 5 | `JOURNEY-day-line-create.md` |
| `deferred` | 2 | (voice + cascade files) |
| `ready_for_merge` | 1 | `JOURNEY-agent-harness.md` |
| `ready-for-merge` | 1 | `JOURNEY-cascade-gate-write.md` |

`accepted` semantically belongs to ADRs, not journey docs. `ready_for_merge` / `ready-for-merge` is a two-spelling variant of a non-standard merge-state marker (should be `review` or `done`). `deferred` has no canonical meaning in the allowed set.

Total non-standard (excluding `verified`): 10 files.

---

## Per-ADR Rollup

### ADR-0031 — Journey Portal System

| Requirement | Status |
|---|---|
| `journey` table in schema | PASS — confirmed in `database.types.ts` |
| `journey_step` table in schema | PASS |
| `journey_event` table in schema | PASS |
| `journey_test_run` table in schema | PASS |
| 13-status lifecycle enum | PASS — `journey_status` enum has exactly 13 values matching spec |
| RLS: godmode + workspace read | Not independently verified (out of scope for doc slice) |
| Platform-admin UI at `/platform-admin/journeys` | PASS — route + components exist |
| Journey Portal seeded from JOURNEY_REGISTRY.md | Not verified — no JOURNEY_REGISTRY.md found in scope |

**ADR-0031: COMPLIANT** on schema and portal routing. Registry seed file not located (may live outside scope paths).

---

### ADR-0038 — Journey Agent & Output Generators

| Requirement | Status |
|---|---|
| `wizard_session` table in schema | PASS — `wizard_session` present with `wizard_session_status` enum |
| API route `POST /api/journey-agent` | PASS — `apps/web/src/app/api/journey-agent/route.ts` exists |
| Agent in `packages/ai/src/agents/journey.ts` | PASS |
| 6-phase wizard (discovery → classification → steps → testing → documentation → review) | PASS — system prompt matches spec exactly |
| 3 agent tools: `lookup_journeys`, `check_duplicates`, `save_draft` | PASS — all three referenced in agent system prompt and used in tool calls |
| 4 output generators (pure functions, no AI dependency) | PASS — `journey-e2e.ts`, `journey-doc.ts`, `journey-linear.ts`, `journey-botsson.ts` all present as pure `(journey, steps) → string` functions |
| Output tabs at journey detail page | PASS — `/platform-admin/journeys/[id]` with detail-client component |
| `wizard_session.messages` JSONB persistence | PASS — confirmed from route.ts implementation |

**ADR-0038: FULLY COMPLIANT.**

---

### Missions Registry (packages/ai/src/missions/registry.ts)

ADR-0038 does not specify missions; this is supplementary verification of the missions package referenced by the same surface.

Registry defines 7 missions: `onboarding-interview`, `landing-demo`, `lise-interview`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`. The `MissionIdSchema` Zod enum in `types.ts` is consistent with the registry keys. No orphaned missions or missing enum entries detected.

---

## Verified Intentional

- **`status: verified`** is likely an intentional team convention for "E2E-verified and merged" that was never codified. Given 304 occurrences it is a de-facto standard. Treatment: LOW not CRITICAL because it causes no runtime failure, only schema drift.
- **`JOURNEY-mobile-voice-runtime-wire-ux-polish.md` `status: verified-with-deferred-gaps`** — the baseline (run 01) flagged this as MEDIUM. On inspection the file uses a purpose-built compound status with structured `deferred:` block. It represents documented intentional incompleteness (mid-session BFF 403 propagation deferred to follow-up sortie per P6 commit dd62300e2). Confirmed LOW — not a compliance failure, only a non-standard status token.
- **`status: accepted`** in 5 journey files — almost certainly copy-pasted from ADR templates during rapid sortie creation. Semantically these are closed/merged journeys. Mechanical fix: rename to `done`.

---

## In-Progress / Out-of-Scope

- **E2E coverage vs journey docs cross-ref** — 238 spec files exist across `apps/e2e/`. Full 1:1 mapping audit (501 JOURNEY docs vs E2E coverage) exceeds slice scope. Spot-check shows contract-employee (5 specs), komm-nyheter (7 specs), and engine-world (3 specs) all have matching JOURNEY files. No obvious orphan E2E directories detected.
- **ADR-0031 Phase 3 (Linear sync, auto-test runs)** — not yet implemented per ADR phase plan. Marked "planned" in ADR. No finding raised.
- **`journey` DB table `workspace_id`** — ADR-0031 says workspace-scoped but schema shows `workspace_id: string` (non-nullable on Insert). Not independently verified against RLS policy (out of DB slice scope).
