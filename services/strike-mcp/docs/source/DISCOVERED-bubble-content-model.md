---
title: Bubble Content Model — Discovered from Genesis bubble-mcp + Pontus's mental model
status: in_progress
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [tier2, bubble, content-model, handbook, training, activity, quiz, discovery]
source: /mnt/c/Users/sxtnl/Dev/Genesis/mcp-servers/bubble-mcp/
verified: 2026-04-17 via live Bubble meta endpoint (scripts/check_tier2_meta.ts)
---

## Verification update (2026-04-17, live Bubble meta)

Queried `https://smartout.io/version-test/api/1.1/meta` against all 106 types.
Three corrections to the original Genesis-sourced inventory:

1. **`🎖️ badge` does NOT exist as a Bubble type.** The DISCOVERED table below
   inferred it from `training.uid_earned_🎖️_badge` array references — but that
   field is a plain UID-string array, not a foreign key to a dedicated entity.
   Badges are text/enum inside `🎎training` and `🎖️handbook.log`, not a separate
   table. **Remove from Tier 2 discovery list.**
2. **`handbook.stage` is a NEW sub-record** (12 fields, no workspace link) —
   missed in the Genesis scan. Sub-record of `handbook`. Add to Tier 2 list.
3. **`question.option` is a NEW sub-record** (21 fields, no workspace link) —
   missed in the Genesis scan. Sub-record of `question`. Add to Tier 2 list.

**Sub-record workspace inheritance:** `handbook.challenge`, `handbook.stage`,
and `question.option` have NO `custom.workspace` field in meta. They inherit
tenancy via parent FK. Discovery can run without workspace constraint
(cross-workspace sample) to observe field shapes — final per-workspace fetch
will traverse via parent.

**Verified ENTITY_REGISTRY inputs (2026-04-17 meta):**

| strike-mcp name | bubbleType | workspaceFieldKey | Total fields |
|---|---|---|---|
| `activity` | `activity` | `workspace` | 55 |
| `handbook_challenges` | `handbook.challenge` | null (sub-record) | 21 |
| `handbook_stages` | `handbook.stage` | null (sub-record) | 12 |
| `questions` | `question` | `workspace` | 30 |
| `question_options` | `question.option` | null (sub-record) | 21 |
| `handbook_logs` | `🎖️handbook.log` | `🏰 workspace` | 39 |

---

# Bubble Content Model — Tier 2 Source-of-Truth

> Discovered 2026-04-17 by scanning `/mnt/c/Users/sxtnl/Dev/Genesis/mcp-servers/bubble-mcp/`
> + cross-referencing Pontus's mental model:
> "aktiviteter kan være manualer eller håndboken — håndboken har aktiviteter og kvistet — kvistet er de kvalitetene"

---

## TL;DR — The 8-entity content stack (verified 2026-04-17)

Bubble's content model has **8 distinct entities** for the "håndbok / training /
quiz" domain (not 7 as originally claimed — `handbook.stage` and `question.option`
were missed in Genesis scan; `🎖️ badge` was falsely inferred and does not exist).
Tier 1 captured 2 of them (handbook container + training aggregate). Remaining 6
need discovery.

| Bubble entity | What it is | Tier 1 discovered? | Live meta field count |
|---|---|---|---|
| `handbook` | Top-level container (a "håndbok") | ✅ Yes (26 rows) | 56 |
| `activity` | Content unit inside a handbook (manual OR quiz) | ❌ **MISSING** | 55 |
| `handbook.challenge` | Challenges within a handbook (sub-record) | ❌ **MISSING** | 21 |
| `handbook.stage` | Stages within a handbook (sub-record, NEW) | ❌ **MISSING** | 12 |
| `question` | Quiz question definition | ❌ **MISSING** | 30 |
| `question.option` | Answer option for a question (sub-record, NEW) | ❌ **MISSING** | 21 |
| `🎖️handbook.log` | Per-employee log (badges earned, quiz results) | ❌ **MISSING** | 39 |
| `🎎training` | Per-employee aggregate counters (elo, completed, status) | ✅ Yes (706 rows) | 39 |
| ~~`🎖️ badge`~~ | ~~Badge definitions~~ | — | **NOT A REAL TYPE — inferred in error from training.uid_earned_🎖️_badge (UID strings, not FK)** |

**Critical insight:** The `🎎training` entity (706 rows) we attested in Tier 1
is a PER-EMPLOYEE PROGRESS RECORD, not the content itself. The actual training
content lives in `activity` records inside `handbook` containers. We've been
calling Tier 1 "complete" but the content layer is genuinely missing.

---

## The model — Pontus's words mapped to Bubble entities

> "vi har aktiviteter, kan være manualer eller håndboken"

→ Bubble entity: **`activity`** with field `_quizType` (option set `__quiztype`).
The `_quizType` value determines whether an activity is a manual (text/procedure)
or a quiz (interactive). One `activity` row per unit of content.

> "håndboken som har aktiviteter og kvistet"

→ Bubble entity: **`handbook`**. A handbook contains many activities. The
"kvister" = activities of `_quizType` = quiz. Same activity entity, different
type discriminator.

> "kvistet er de kvalitetene"

→ Quiz-type activities = quality / competence checks. In v3 governance
hierarchy, these correspond to `knowledge_test` (per CLAUDE.md):
`policy → protocol → { ... knowledge_test ... }`.

---

## Live discovery results (2026-04-17 against Wrightegaarden)

Discovery ran for all 6 Tier 2 entities. Sample results:

| Entity | Sample / Total | Field count | Notes |
|---|---|---|---|
| `activities` | 100 / **935** | 32 | Bulk of content. ws-filtered correctly. |
| `handbook_challenges` | 90 / 90 | 17 | Global (sub-record). 90 across all workspaces. |
| `handbook_stages` | 21 / 21 | 8 | Global (sub-record). 21 across all workspaces. |
| `questions` | **0 / 0** | 0 | ⚠️ Wrightegaarden has ZERO questions. **264 exist globally** across other workspaces. |
| `question_options` | 100 / **1409** | 15 | Global (sub-record). 1409 across all workspaces. |
| `handbook_logs` | 30 / 30 | 20 | Tiny. Wrightegaarden has only 30 completion records. |

### Surprise findings (changes the migration plan)

**1. Cross-workspace content sharing exists in Bubble.** Both questions and
activities have:
- A `Global` boolean field (`Global: True/False`)
- Activities additionally have `add to workspace: [<workspaceId>...]` —
  an ARRAY of workspace IDs the activity is published to.

This means content is NOT strictly workspace-scoped in Bubble. v3's model
is workspace-isolated. **Council Q5: How do we migrate Global / shared content?**

**2. Wrightegaarden has 0 questions but 264 exist globally.** The sample
question is in a different workspace. Yet Wrightegaarden has 935 activities.
This suggests Wrightegaarden's quiz-type activities reference questions from
*other* workspaces via the `parantQuiz` link. **Council Q6: Migrate referenced
global questions, or skip quiz content entirely?**

**3. Activities have TWO discriminator fields, not one.**
- `_activityType` (observed value: `procedures`)
- `_dataType` (observed value: `📘 Manual`)

The DISCOVERED doc above hypothesized `_quizType` — that field exists per the
option-set extraction, but live data shows `_activityType` + `_dataType` are
the actual routing fields. **Council Q7: Which field determines v3 target?
Build truth table from live samples first.**

**4. Activities are hierarchical (tree, not flat).**
- `children: [<activityId>...]` — array of child activity IDs
- `🚀 Parant: <activityId>` — parent reference

The Bubble model is a tree of activities under a handbook. v3's
`policy → protocol → {procedure, ...}` is 2-level. **Council Q8: Flatten the
tree or model nested activities as nested protocols?**

**5. Activities have multilingual fields.**
- `🏳️‍🌈 List of title: ['§en_us§Welcome to Wrightegaarden', '§no_no§Velkommen til Wrightegaarden', ...]`
- `🏳️‍🌈 description: [' §en_us§Dear Employee!...', ' §no_no§Kjære ansatt!...']`

Format is `§<locale>§<text>` concatenated in arrays. v3 governance tables
have no multilingual columns. **Council Q9: Lossy migration (pick one
language) or extend v3 schema with translation columns?**

**6. Activities reference a separate `📚 Content` entity.** Field
`📚 Content 🚫: <contentId>` points to the `content` type (which exists in
meta with 0 fields documented but has live records). The `🚫` marker per
Iron Rule 2 means "marked for deletion in Bubble UI" but the field is still
populated. **Council Q10: Migrate the content entity too? Or treat as
orphaned reference?**

**7. AI-generated content marker.** `AI created?: True` flag plus
`✨AI Log` reference. Indicates significant AI-generated content in
Wrightegaarden. **Council Q11: Preserve provenance or strip?**

### Updated council question set

The original 4 Q's plus 7 new ones — **11 total** for Tier 2 council:

1. Does `handbook` map to v3 `protocol` or v3 `policy`?
2. Does `handbook.challenge` map to v3 `confirmation` or `control_list`?
3. Do we need a new v3 table for per-employee progress summary?
4. What about `🗞️posts🚫`?
5. **NEW** How do we migrate Global / cross-workspace shared content?
6. **NEW** Wrightegaarden has 0 questions of its own — migrate referenced
   global questions, or skip quiz content?
7. **NEW** Which field discriminates activity target (`_activityType` vs
   `_dataType`)? Need truth table.
8. **NEW** Flatten activity tree or model nested protocols?
9. **NEW** Multilingual: lossy migration or extend v3 schema?
10. **NEW** Migrate the `content` entity (referenced by activities)?
11. **NEW** Preserve AI-generated content provenance flags?

---

## Bubble entity fields — what we know so far

### `handbook` (top container)

Confirmed fields from `extracted-option-sets-and-locations.md`:

| Bubble field | Type | Bubble field key in API | v3 candidate |
|---|---|---|---|
| `_status` | enum (`___coursestatus`) | `_status_option____coursestatus` | status enum on protocol or runbook |
| `_handbookType` | enum (`___badgetype_ai`) | `___badgetype_ai_option____badgetype_ai` | category / type field |
| `_colorPallet` | enum (`___color_pallet`) | `_colorpallet_option_____colorpallet` | color text |

Already-attested mapping in `mappings/handbooks.json` (from Tier 1) targets
`public.runbook` — needs revisit now that we know it's actually the **container**
for activities, not the content unit itself.

### `activity` (content unit)

Confirmed fields:

| Bubble field | Type | v3 candidate |
|---|---|---|
| `_quizType` | enum (`__quiztype`) | discriminator: routes to `procedure` (manual) vs `knowledge_test` (quiz) |

**MORE FIELDS UNKNOWN** — must be discovered via Bubble Data API live fetch
(strike-mcp `run_discovery.ts` for entity `activity`).

### `handbook.challenge` (challenges within handbook)

| Bubble field | Type | v3 candidate |
|---|---|---|
| `_handbookType` | enum (`___badgetype_ai`) | category |

### `question` (quiz question)

| Bubble field | Type | v3 candidate |
|---|---|---|
| `_questionType` | enum (`__questiontype`) | knowledge_test_question.type |

### `🎖️handbook.log` (per-employee log)

| Bubble field | Type | v3 candidate |
|---|---|---|
| `_handbookType` | enum (`___badgetype_ai`) | category |
| `_resultStatus` | enum (`__resultstatus`) | knowledge_test_attempt.result |

### `🎎training` (per-employee aggregate — already attested in Tier 1)

Confirmed fields from bubble-mcp `server.js:513-530`:

| Bubble field | v3 candidate |
|---|---|
| `_id`, `_status` | profile_competence_summary.id / status |
| `elo` (number) | gamification.elo (out of v3 scope?) |
| `progression` (number) | profile_competence_summary.progress_pct |
| `totalskillpoint` (number) | gamification.skill_points |
| `complete_courseuid_list` (array of UIDs) | derived counter |
| `complete_quizuid_list` (array of UIDs) | derived counter |
| `uid_earned_🎖️_badge` (array of UIDs) | profile_badge[] |

**Tier 1 attestation status:** training is currently mapped as a generic
per-employee record but NOT verified against this real shape. Since it's
per-employee aggregate (not content), the v3 target may need to be a NEW table:
`public.profile_competence_summary` or similar — currently maps to nothing
specific in v3.

### `🎖️ badge` (badge definitions)

Inferred from training.uid_earned_🎖️_badge array references. Definition entity.

---

## Mapping to v3 governance hierarchy

Per `CLAUDE.md` smartout.ai-wt-2:
> Governance (content layer): policy → protocol → {procedure, routine,
> runbook, control_list, knowledge_test, confirmation}

Proposed Bubble → v3 mapping (DRAFT — needs council review):

```
Bubble                          →  v3
─────────────────────────────────────────────────────────────────
handbook                        →  protocol (a named training set)
  └── activity (_quizType=null)  →    procedure / runbook (instructional content)
  └── activity (_quizType=quiz)  →    knowledge_test (assessment)
  └── handbook.challenge         →    confirmation? (a sign-off item)
  └── question (under quiz)      →    knowledge_test_question (rich-text Q+A)
🎖️handbook.log (per-employee)   →  profile_competence_completion (audit log)
🎎training (per-employee summary)→  derived view, NOT a new table
                                     OR public.profile_competence_summary if needed
🎖️ badge (definitions)          →  out of Tier 2 scope (gamification, K1b?)
```

Open questions for council:
1. Does `handbook` map to v3 `protocol` or v3 `policy`? (Probably protocol —
   policy is the rules layer, protocol is the named-content layer.)
2. Does `handbook.challenge` map to v3 `confirmation` or to `control_list`?
3. Do we need a new v3 table for the per-employee progress summary, or
   derive from completion log?
4. What about `🗞️posts🚫` (uses same `___coursestatus` enum as handbook)?

---

## Discovery checklist for Tier 2 (revised 2026-04-17)

Strike-mcp `scripts/run_discovery.ts` must be run for these 6 NEW entities
(after adding them to `src/entities.ts` registry):

- [ ] `activity` — ws-linked, constraint `workspace`
- [ ] `handbook_challenges` — sub-record, no ws constraint
- [ ] `handbook_stages` — sub-record, no ws constraint (NEW, missed in Genesis scan)
- [ ] `questions` — ws-linked, constraint `workspace`
- [ ] `question_options` — sub-record, no ws constraint (NEW, missed in Genesis scan)
- [ ] `handbook_logs` — ws-linked, constraint `🏰 workspace`
- ~~`🎖️ badge`~~ — REMOVED from list (not a real Bubble type; badges are UID
  strings inside training, verified via live meta)

After discovery completes, council review on 4 open mapping questions (below).

---

## Existing Bubble MCP — what it provides

`/mnt/c/Users/sxtnl/Dev/Genesis/mcp-servers/bubble-mcp/` has 25 tools focused
on payroll/shift/timesheet validation. ONE training-related tool:

- `get_employee_training` — fetches one `🎎training` row by employee_id, returns
  `{ elo, progression, totalSkillPoints, completedCourses, completedQuizzes,
     earnedBadges, status }`. Aggregate-only; doesn't query handbook/activity content.

**No handbook or activity tools exist in the current MCP.** Strike-mcp is the
right place to do content migration.

---

## Source files referenced

- `/mnt/c/Users/sxtnl/Dev/Smartout/Smartout core structures.jsonc` — v3 core
  schema (10 datatypes; protocol/procedure NOT here, only policy)
- `/mnt/c/Users/sxtnl/Dev/Smartout/docs/Smartout architecture overview.md` —
  module layer overview
- `/mnt/c/Users/sxtnl/Dev/Genesis/mcp-servers/bubble-mcp/docs/extracted-option-sets-and-locations.md` —
  Bubble option-set definitions per entity (PRIMARY SOURCE for this discovery)
- `/mnt/c/Users/sxtnl/Dev/Genesis/mcp-servers/bubble-mcp/deploy/server.js:513-530` —
  `get_employee_training` field shape

---

## Next steps for next session

1. Read this file
2. Run discovery for the 5 missing Bubble entities (`activity`, `handbook.challenge`,
   `question`, `🎖️handbook.log`, `🎖️ badge`)
3. Probe live API for actual field names + values (Tier 1 taught us discovery
   sidecar can diverge from live API — verify everything)
4. Run council on the v3 mapping decisions (Q1-Q4 above)
5. Patch + attest the new Tier 2 entities
6. Re-attest `handbooks` and `training` mappings now that we understand they
   are container + summary respectively, not content

---

*Discovery captured 2026-04-17 by migration agent (Claude Opus) from
`/mnt/c/Users/sxtnl/Dev/` after Pontus pointed to Genesis bubble-mcp as
source-of-truth for the existing content model.*
