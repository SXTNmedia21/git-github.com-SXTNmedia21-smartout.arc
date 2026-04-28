---
title: "Journey Lifecycle — Authoring + Runtime State Machines"
id: ENGINE_SYSTEM_LIFECYCLE
version: "1.0"
status: draft
layer: architecture
created: 2026-04-28
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - lifecycle
  - state-machine
  - status
  - authoring
  - runtime
---

# Journey Lifecycle

> Two state machines, one journey. Authoring (skill) tracks 13 statuses. Runtime (DB enum) tracks 7. Both correct for their layer. This doc reconciles.

---

## 1. Authoring lifecycle (13 statuses)

Lives in the skill + frontmatter (`<slug>.idea.md` / `<slug>.spec.yaml` / `<slug>.refined.yaml`). NOT in the database — too granular for production state.

```
idea → wizard → defined → ready_impl → building → review
   → ready_test → testing → ready_validation
   → implemented → active ⇄ inactive
                       ↓
                    broken
```

| Status | Means | Set by | Exit gate |
|---|---|---|---|
| `idea` | Goal sentence captured. No structure yet. | `journey-protocol create` | Author approves intent |
| `wizard` | 8-phase conversation in progress | `journey-protocol spec` mid-flow | All required IR fields locked |
| `defined` | IR draft complete, schema-valid + semantic-valid | `journey-protocol spec` end | Author commits to refine |
| `ready_impl` | Refine done — triggers/events/capabilities bound | `journey-protocol refine` | Build authorization |
| `building` | Code being written | Developer | PR opened |
| `review` | PR open, code review in progress | Developer | Reviewer approves |
| `ready_test` | Code merged, ready for E2E | CI | Test scheduled |
| `testing` | E2E running (generated from FLOW.md) | CI | All assertions pass |
| `ready_validation` | E2E passed, awaiting author validation | CI | Author validates |
| `implemented` | Approved + folder materialized | `journey-protocol approve` | Author flips active |
| `active` | `mission.is_active=true`, runtime surfaces it | Author | — |
| `inactive` | Temporarily disabled, existing runs continue | Author | Re-activate or retire |
| `broken` | Production regression detected | Engine auto OR author | Re-enter `ready_test` |

### 1.1 Phases

| Phase | Statuses | Owner |
|---|---|---|
| Definition | `idea`, `wizard`, `defined` | Author + skill |
| Build | `ready_impl`, `building`, `review` | Developer |
| Test | `ready_test`, `testing`, `ready_validation` | QA + Author |
| Release | `implemented`, `active`, `inactive`, `broken` | Product |

### 1.2 Closure-stub vs protocol-package

`docs/journeys/JOURNEY-*.md` files (~25 of them) are **closure stubs** — written at `/close-feature` per CLAUDE.md §"Mandatory: Feature Closure". They live in authoring statuses `ready_validation` or `implemented` after the feature ships.

`docs/journeys/<slug>/` folders (this engine's output) are **protocol packages** — full materialized journey with all 13 files. Reach `implemented` only after `journey-protocol approve`.

Same source of truth for both, different materialization:

- A closure stub has `journey.md` (frontmatter + step body) and nothing else
- A protocol package has all 13 files

A closure stub can be promoted to a protocol package by running `journey-protocol refine` + `approve` on its `journey.md`. Reverse not supported (you can't demote a folder to a stub — it's an authoring downgrade).

---

## 2. IR lifecycle (DB enum)

Lives in `journey_ir.status` column. Narrower set, optimized for runtime queries.

```
draft → validated → published → active ⇄ inactive → retired
                                   ↓
                                broken (hot-discovered regression)
```

| Status | Means | Set by | Authoring equivalent |
|---|---|---|---|
| `draft` | Author writing | Engine on save | `defined` through `ready_validation` |
| `validated` | Schema + semantic + generator pre-flight passed | Engine auto | (transient — leads to `published`) |
| `published` | Generators produced 5 runtime artefacts; mission `is_active=false` | `journey-protocol approve` | `implemented` |
| `active` | Mission `is_active=true`; runtime surfaces this journey | Author | `active` |
| `inactive` | Disabled; existing runs continue | Author | `inactive` |
| `retired` | Replaced by newer version; no new runs | Author | (n/a — retire is final) |
| `broken` | Production regression | Engine auto OR Author | `broken` |

Reference enum source: `journey_version_status` (added per ADR-0172, migration `20260516000000–20260516000400`).

---

## 3. Run lifecycle (per-execution)

Independent of IR status. A single IR in `active` can have thousands of concurrent `running` runs.

```
       ┌──────────┐
       │  idle    │
       └────┬─────┘
            ▼
       ┌──────────┐                ┌──────────┐
   ┌───│ running  │◄──── RETRY ────│  stuck   │
   │   └─┬───┬────┘                └────┬─────┘
   │     │   │                          │
   │ STEP_DONE │ TIMEOUT                │ ABANDON
   │     ▼   ▼                          ▼
   │ ┌────────────┐                ┌──────────┐
   │ │ completed  │                │  idle    │
   │ └────────────┘                └──────────┘
   │
   │ FAIL
   ▼
┌──────────┐                  ┌──────────┐
│  failed  │──── RESET ──────►│  idle    │
└──────────┘                  └──────────┘

(also: running ⇄ paused on tab close / focus return)
```

| State | Entry | Exit |
|---|---|---|
| `idle` | New run OR explicit reset | → `running` (start), terminal |
| `running` | Step in flight | → `paused`, `stuck`, `completed`, `failed` |
| `paused` | Focus loss / tab close | → `running` (focus return), → `stuck` (timeout) |
| `stuck` | Step timeout fired | → `running` (RETRY), → `idle` (ABANDON) |
| `completed` | Success gate true | terminal |
| `failed` | Hard error | → `idle` (RESET) |

Stored in `journey_run.state`. Every transition emits a registry event (see `01-prd.md` §9).

### 3.1 Critical invariant

Closing an IR (`retired`) does NOT terminate live runs. They continue against their snapshotted IR. See `01-prd.md` §4.5 (snapshot policy).

Recurring runs (`mode: "recurring"`) emit `journey.cycle_completed` instead of transitioning to `completed`.

---

## 4. Three-machine summary

| Machine | Domain | Granularity | Persistence |
|---|---|---|---|
| Authoring (13 statuses) | skill + frontmatter | Author-visible | Markdown frontmatter |
| IR (7 enum) | DB query layer | Runtime-visible | `journey_ir.status` |
| Run (6 states) | per-execution | Per-user, per-session | `journey_run.state` |

When in doubt: authoring ≈ "where is the human in writing this?", IR ≈ "is this journey live in production?", run ≈ "what is this specific user doing right now?".

---

## 5. Cross-references

- `01-prd.md` §5 — IR + run lifecycles canonical
- `03-mental-model.md` §3 — 13-status authoring origin
- `05-protocol-pipeline.md` §2, §6 — skill ops mapped to status transitions
- `decisions/0172-journey-ir-status-enum.md` — enum migration
- `decisions/0177-fjernkontroll-state-machine.md` — run state machine + UI

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-04-28 | 1.0.0 | Initial. Reconciles 13-status authoring vs 7-enum IR vs 6-state run. |
