---
title: "Module 1 Documentation Update Design"
status: done
updated: 2026-03-03
created: 2026-03-03
module: onboarding
tags: [design, documentation, module-1, audit]
---

# Module 1 Documentation Update Design

## Problem

Module 1 (Onboarding) document describes both implemented and planned features, but contains factual errors against the codebase. Table names, providers, wizard steps, and data model details don't match the code.

## Approach

**Inline-marking** — keep current document structure, mark each section with implementation status, correct all factual errors, and add a Roadmap section for unimplemented features.

## Deliverables

### 1. Module Document Update (`SMARTOUT_MODULE_1_ONBOARDING.md`)

| Section                     | Action                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| §2 Workspace Creation       | Mark ✅, update wizard from 5 to 15 steps, add website crawl, add progressive save                            |
| §3 Invitation               | Mark ✅, rename `workspace_invite` → `invitation`, Resend → SendGrid                                          |
| §4-9                        | Mark ⏳ PLANNED, keep as spec                                                                                 |
| §10 Data Model              | Fix emergency contact from `profile` to `user_identity`, add `onboarding_session`, update `invitation` schema |
| §12 Implementation Sequence | Update with current completion status                                                                         |
| §16 Roadmap (NEW)           | Prioritized list of all unimplemented features                                                                |

### 2. Three ADRs

| ADR      | Decision                                                   |
| -------- | ---------------------------------------------------------- |
| ADR-0043 | Emergency contact on `user_identity` not `profile`         |
| ADR-0044 | Invitation table named `invitation` not `workspace_invite` |
| ADR-0045 | SendGrid for transactional email over Resend               |

### 3. Two Learnings

| Learning      | Insight                                        |
| ------------- | ---------------------------------------------- |
| Learning-0016 | Season type enum mismatch (frontend vs DB)     |
| Learning-0017 | Progressive save pattern with debounce + JSONB |

### 4. Log Updates

- Register all ADRs in `docs/decisions/0000-decision-log.md`
- Register all learnings in `docs/learnings/0000-learning-log.md`
