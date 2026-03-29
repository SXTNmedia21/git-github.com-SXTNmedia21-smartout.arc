---
title: "Documentation Audit & Reorganization Plan"
status: done
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [docs, audit, reorganization, archive, cascade]
---

# Documentation Audit & Reorganization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean the docs folder so it is 100% aligned with the Cascade Core Foundation architecture and current system state. Archive stale docs, create a `docs/needs-rewrite/` staging area for merge candidates, fix broken files, and resolve naming inconsistencies.

**Architecture:** Four-phase approach: (1) create target directories, (2) archive stale files, (3) stage merge candidates with rewrite instructions, (4) fix broken/inconsistent files in place. No content rewriting in this plan — only moves, metadata fixes, and rewrite instructions.

**Audit basis:** Four parallel audit agents scanned all 400+ docs files on 2026-03-22. Findings consolidated below.

---

## Audit Summary

| Category                        | Total Files     | Current  | Stale/Archive | Merge Candidate | Fix In Place |
| ------------------------------- | --------------- | -------- | ------------- | --------------- | ------------ |
| Root-level                      | 19              | 12       | 5             | 1               | 1            |
| architecture/                   | 26              | 21       | 5             | 0               | 0            |
| cross-cutting/                  | 11              | 11       | 0             | 0               | 0            |
| reference/                      | 20              | 20       | 0             | 0               | 0            |
| modules/                        | 25              | 22       | 1             | 1               | 1            |
| engines/system-inteligence/     | 12              | 2        | 8             | 2               | 0            |
| engines/industri-inteligence/   | 28              | 27       | 1             | 0               | 0            |
| engines/artificial-inteligence/ | 1               | 1        | 0             | 0               | 0            |
| agents/                         | 14              | 8        | 4             | 2               | 0            |
| handoffs/                       | 4               | 2        | 2             | 0               | 0            |
| narratives/                     | 8               | 8        | 0             | 0               | 0            |
| prompts/                        | 2               | 0        | 2             | 0               | 0            |
| research/                       | 7               | 7        | 0             | 0               | 0            |
| reports/                        | 1               | 1        | 0             | 0               | 0            |
| specs/                          | 3               | 1        | 2             | 0               | 0            |
| superpowers/                    | 14              | 14       | 0             | 0               | 0            |
| designprofiler/                 | 3               | 1        | 1             | 1               | 0            |
| emails/                         | 3               | 0        | 3             | 0               | 0            |
| training/                       | 2               | 0        | 2             | 0               | 0            |
| Roadmaps/ + roadmaps/           | 12              | 11       | 0             | 1               | 0            |
| User Manual/                    | 15              | 14       | 0             | 1               | 0            |
| **TOTAL**                       | **~230 unique** | **~183** | **~36**       | **~9**          | **~2**       |

---

## Phase 1: Create Target Directories

### Task 1: Create archive and needs-rewrite directories

**Files:**

- Create: `docs/archive/system-inteligence/` (for superseded engine docs)
- Create: `docs/needs-rewrite/` (staging area for merge candidates)

- [ ] **Step 1: Create directories**

```bash
mkdir -p docs/archive/system-inteligence
mkdir -p docs/needs-rewrite
```

- [ ] **Step 2: Create needs-rewrite README**

Create `docs/needs-rewrite/README.md` with:

```markdown
---
title: "Documents Pending Rewrite"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [docs, rewrite, merge]
---

# Documents Pending Rewrite

Files in this folder contain useful content that needs to be merged into other documents
or rewritten to align with the Cascade Core Foundation architecture.

Each file has a companion `REWRITE-INSTRUCTIONS-<filename>.md` explaining:

- What content is still valuable
- Where it should be merged
- What is outdated and should be dropped

Do NOT implement from these files directly. They are staging artifacts.
```

- [ ] **Step 3: Commit**

```bash
git add docs/archive/system-inteligence/.gitkeep docs/needs-rewrite/
git commit -m "docs: create archive/system-inteligence and needs-rewrite directories"
```

---

## Phase 2: Archive Stale Files

### Task 2: Archive stale root-level files

**Reason:** Research briefs superseded by results, working docs rolled into cascade spec, ephemeral data.

- [ ] **Step 1: Move files**

```bash
mv docs/DEEP_RESEARCH_FIVE_QUESTIONS.md docs/archive/
mv docs/MECHANICS_MAP_CASCADE_FOUNDATION.md docs/archive/
mv docs/RESEARCH_REACTIVE_OPERATIONS_ENGINE.md docs/archive/
mv docs/SMARTOUT_SYSTEMGUIDE_GAP_ANALYSIS.md docs/archive/
mv docs/joine-codes.md docs/archive/
```

- [ ] **Step 2: Commit**

```bash
git add -A docs/archive/ docs/DEEP_RESEARCH_FIVE_QUESTIONS.md docs/MECHANICS_MAP_CASCADE_FOUNDATION.md docs/RESEARCH_REACTIVE_OPERATIONS_ENGINE.md docs/SMARTOUT_SYSTEMGUIDE_GAP_ANALYSIS.md docs/joine-codes.md
git commit -m "docs: archive 5 stale root-level files (research briefs, working docs, ephemeral data)"
```

### Task 3: Archive stale architecture files

**Reason:** Superseded by Cascade or ADRs, or outdated phase-based planning.

- [ ] **Step 1: Move files**

```bash
mv docs/architecture/SMARTOUT_docs_NEXTRA_architecture.md docs/archive/
mv docs/architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md docs/archive/
```

- [ ] **Step 2: Commit**

```bash
git add -A docs/archive/ docs/architecture/SMARTOUT_docs_NEXTRA_architecture.md docs/architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md
git commit -m "docs: archive 2 architecture files (Nextra superseded by ADR-0030, org roadmap superseded by cascade)"
```

### Task 4: Archive superseded system-inteligence engine files

**Reason:** These define Phase A engine patterns now superseded by Cascade Core Foundation (Phase B). The cascade spec's framework model, control planes, and proposal pipeline replace these.

- [ ] **Step 1: Move files**

```bash
mv docs/engines/system-inteligence/03-notification-intelligence.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/04-state-machine-governance.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/05-verification-safety-and-learning.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/06-autonomous-sensory-runtime.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/08-event-envelope-spec.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/09-gold-package-admin-onboarding.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/10-implementation-and-gap-plan.md docs/archive/system-inteligence/
mv docs/engines/system-inteligence/AUDIT-frontend-data-connections.md docs/archive/system-inteligence/
```

- [ ] **Step 2: Commit**

```bash
git add -A docs/archive/system-inteligence/ docs/engines/system-inteligence/
git commit -m "docs: archive 8 system-inteligence files superseded by Cascade Core Foundation"
```

### Task 5: Archive historical and ephemeral files

**Reason:** Emails, training transcripts, stale handoffs, stale prompts — historical artifacts.

- [ ] **Step 1: Move files**

```bash
mv docs/emails/ docs/archive/emails/
mv docs/training/ docs/archive/training/
mv docs/handoffs/2026-03-02-schedule-infinite-loop.md docs/archive/
mv docs/handoffs/voice-problem-handoff.md docs/archive/
mv docs/prompts/WEBPAGE_DESIGNE.md docs/archive/
mv docs/designprofiler/frontend-designer-agent-spec.md docs/archive/
mv docs/engines/industri-inteligence/hospitalety/HAIKU-AUDIT-INSTRUCTION.md docs/archive/
```

- [ ] **Step 2: Commit**

```bash
git add -A docs/archive/ docs/emails/ docs/training/ docs/handoffs/ docs/prompts/ docs/designprofiler/ docs/engines/industri-inteligence/hospitalety/HAIKU-AUDIT-INSTRUCTION.md
git commit -m "docs: archive emails, training, stale handoffs, stale prompts, deprecated agent specs"
```

### Task 6: Archive stale specs and agent files

**Reason:** Placeholder specs without dates/content, stale mobile design working docs.

- [ ] **Step 1: Move files**

```bash
mv docs/specs/payroll-wizard-architecture.md docs/archive/
mv docs/specs/team-csv-mapping-architecture.md docs/archive/
mv docs/mobile-design/component-ledger.md docs/archive/ 2>/dev/null || true
mv docs/mobile-design/decisions.md docs/archive/ 2>/dev/null || true
mv docs/mobile-design/hypotheses.md docs/archive/ 2>/dev/null || true
mv docs/agents/mobile-design/component-ledger.md docs/archive/ 2>/dev/null || true
mv docs/agents/mobile-design/decisions.md docs/archive/ 2>/dev/null || true
mv docs/agents/mobile-design/hypotheses.md docs/archive/ 2>/dev/null || true
mv docs/designprofiler/hypotheses.md docs/archive/ 2>/dev/null || true
```

- [ ] **Step 2: Commit**

```bash
git add -A docs/archive/ docs/specs/ docs/agents/mobile-design/ docs/designprofiler/
git commit -m "docs: archive placeholder specs, stale mobile design working docs, stale hypotheses"
```

---

## Phase 3: Stage Merge Candidates

### Task 7: Stage system-inteligence merge candidates

**Reason:** These files contain useful content that partially overlaps with the Cascade spec. They need rewriting to either reference cascade or extract the still-relevant parts.

- [ ] **Step 1: Move files to needs-rewrite**

```bash
mv docs/engines/system-inteligence/00-core-state-engine.md docs/needs-rewrite/
mv docs/engines/system-inteligence/01-system-architecture-contracts.md docs/needs-rewrite/
mv docs/engines/system-inteligence/02-agent-framework-runtime.md docs/needs-rewrite/
```

- [ ] **Step 2: Create rewrite instructions**

Create `docs/needs-rewrite/REWRITE-INSTRUCTIONS-system-inteligence.md`:

```markdown
---
title: "Rewrite Instructions — System Intelligence Engine Files"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [rewrite, cascade, system-inteligence]
---

# Rewrite Instructions — System Intelligence Engine Files

## Files

- `00-core-state-engine.md` — State domain model
- `01-system-architecture-contracts.md` — Runtime contracts
- `02-agent-framework-runtime.md` — Agent authority/capability model

## What happened

These files defined Phase A engine patterns. The Cascade Core Foundation spec
(`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
now defines the canonical architecture:

- State model → Cascade dimensions D1-D6 + control planes C1-C4
- Runtime contracts → Cascade Phase B proposal/enforcement pipeline
- Agent runtime → Cascade C2 (Interaction Plane) + existing agent-framework.md

## What to extract (still valuable)

- `00-core-state-engine.md`: State domain taxonomy (if not fully covered by cascade dimensions)
- `01-system-architecture-contracts.md`: Any runtime contracts not covered by cascade Phase B/D
- `02-agent-framework-runtime.md`: Agent authority model details not in `architecture/agent-framework.md`

## Target documents

- Cascade spec Section 2 (Architecture) — if state model gaps found
- `architecture/agent-framework.md` — for agent runtime details
- Cascade spec Phase D — for adapter/runtime contracts

## What to drop

- Any state model, governance, or propagation patterns now defined by cascade
- Phase A sequencing and wave planning
- Duplicate architecture contracts
```

- [ ] **Step 3: Commit**

```bash
git add docs/needs-rewrite/ docs/engines/system-inteligence/
git commit -m "docs: stage 3 system-inteligence files for rewrite with cascade alignment instructions"
```

### Task 8: Stage architecture merge candidates

**Reason:** These contain useful foundational content but their phased implementation plans are superseded by cascade.

- [ ] **Step 1: Move files to needs-rewrite**

```bash
mv docs/architecture/SMARTOUT_IMPLEMENTATION_GUIDE.md docs/needs-rewrite/
mv docs/architecture/SMARTOUT_UI_ARCHITECTURE.md docs/needs-rewrite/
mv docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md docs/needs-rewrite/
```

- [ ] **Step 2: Create rewrite instructions**

Create `docs/needs-rewrite/REWRITE-INSTRUCTIONS-architecture.md`:

```markdown
---
title: "Rewrite Instructions — Architecture Files"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [rewrite, cascade, architecture]
---

# Rewrite Instructions — Architecture Files

## SMARTOUT_IMPLEMENTATION_GUIDE.md

- **Extract:** Phase 0 Foundation description (still valid as permanent reference)
- **Drop:** Phases 1-11 build order (superseded by cascade Phase A-D)
- **Target:** Create a new `architecture/SMARTOUT_IMPLEMENTATION_FOUNDATIONS.md` with Phase 0 content
- **Or:** Simply archive if BUILD_ORDER.md covers the same ground

## SMARTOUT_UI_ARCHITECTURE.md

- **Extract:** Four-persona journey maps and UX principles (still useful)
- **Drop:** Module-phased screen inventory (superseded by cascade + current routes)
- **Target:** Create updated screen inventory aligned with current ROUTES.md
- **Or:** Merge persona definitions into SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md

## SMARTOUT_ADMIN_KEY_MANAGEMENT.md

- **Extract:** Admin UI routes and dashboard layout for key management
- **Drop:** Old key model references if they predate ADR-0028
- **Target:** Merge into SMARTOUT_SECRET_API_INFRASTRUCTURE.md as "Admin UI" section
```

- [ ] **Step 3: Commit**

```bash
git add docs/needs-rewrite/ docs/architecture/
git commit -m "docs: stage 3 architecture files for rewrite (implementation guide, UI arch, admin keys)"
```

### Task 9: Stage module and root merge candidates

- [ ] **Step 1: Move/flag files**

```bash
mv docs/SMARTOUT_PLATTFORMEN.md docs/needs-rewrite/
mv docs/WORKLOG.md docs/worklogs/WORKLOG-schedule-ui-root.md
mv docs/roadmaps/admin-onboarding.md docs/needs-rewrite/
```

- [ ] **Step 2: Create rewrite instructions**

Create `docs/needs-rewrite/REWRITE-INSTRUCTIONS-misc.md`:

```markdown
---
title: "Rewrite Instructions — Miscellaneous Files"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [rewrite, consolidation]
---

# Rewrite Instructions — Miscellaneous Files

## SMARTOUT_PLATTFORMEN.md

- **Reason:** Duplicate of SMARTOUT_SYSTEM_OVERVIEW.md (both Swedish system overviews)
- **Action:** Merge any unique content into SMARTOUT_SYSTEM_OVERVIEW.md, then delete

## admin-onboarding.md (from roadmaps/)

- **Reason:** Duplicate of Roadmaps/Admin onboarding/ folder structure
- **Action:** Merge any unique content into Roadmaps/Admin onboarding/Roadmap.md, then delete

## MODULE_3_SCHEDULING.md (NOT moved, flag only)

- **Reason:** Contains cascade dimension references but execution spec unchanged
- **Action:** Add "Cascade Context" subsection referencing cascade spec Phase B/C
- **Do NOT rewrite the module** — add cross-references only

## MODULE_8_PAYROLL.md (NOT moved, flag only)

- **Reason:** AI Council findings integrated but needs cascade framework alignment
- **Action:** Add cross-reference to cascade spec Section 5 (framework seed data)
- **Do NOT rewrite the module** — add cross-references only
```

- [ ] **Step 3: Commit**

```bash
git add docs/needs-rewrite/ docs/SMARTOUT_PLATTFORMEN.md docs/WORKLOG.md docs/worklogs/ docs/roadmaps/
git commit -m "docs: stage misc merge candidates, move root WORKLOG to worklogs/"
```

---

## Phase 4: Fix Broken/Inconsistent Files

### Task 10: Fix MODULE_15 broken YAML frontmatter

**Reason:** CRITICAL — malformed YAML frontmatter prevents doc parsing.

- [ ] **Step 1: Read and identify the broken line**

Read `docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md` lines 1-15.

- [ ] **Step 2: Fix the YAML frontmatter**

Remove the escaped `\*\*---` at line 10 and ensure valid YAML.

- [ ] **Step 3: Verify YAML parses correctly**

- [ ] **Step 4: Commit**

```bash
git add docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md
git commit -m "fix(docs): repair broken YAML frontmatter in MODULE_15_SEASON_PLANNING"
```

### Task 11: Fix MODULE_7 placeholder status

**Reason:** Module 7 (Absence & Leave) is a draft with TODO placeholders. It blocks planning because it looks like a spec but contains nothing actionable.

- [ ] **Step 1: Update frontmatter status to `placeholder`**

Change `status: draft` to `status: placeholder` and add a note:

```yaml
note: "This module has no implementation. Specification needed before development."
```

- [ ] **Step 2: Commit**

```bash
git add docs/modules/SMARTOUT_MODULE_7_ABSENCE.md
git commit -m "docs: mark MODULE_7_ABSENCE as placeholder — no implementation exists"
```

### Task 12: Update system-inteligence README with supersession notice

**Reason:** The remaining files in engines/system-inteligence/ need context about what's been archived and why.

- [ ] **Step 1: Add supersession notice to README.md**

Add to the top of `docs/engines/system-inteligence/README.md`:

```markdown
> **Supersession Notice (2026-03-22):** Most files in this directory have been
> archived to `docs/archive/system-inteligence/`. The Cascade Core Foundation
> spec (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
> now defines the canonical architecture for state management, governance,
> and proposal/enforcement. Remaining files (README, 07-journey-package-compiler)
> are still active. Files in `docs/needs-rewrite/` contain content pending
> consolidation into the cascade spec.
```

- [ ] **Step 2: Commit**

```bash
git add docs/engines/system-inteligence/README.md
git commit -m "docs: add supersession notice to system-inteligence README"
```

### Task 13: Fix Roadmaps naming inconsistency

**Reason:** Two directories (`Roadmaps/` capital R and `roadmaps/` lowercase) create confusion.

- [ ] **Step 1: Check if git case-sensitivity will cause issues**

```bash
git config core.ignorecase
```

- [ ] **Step 2: Rename if safe, or flag for manual resolution**

If on case-insensitive filesystem (WSL2 with Windows mounts), this requires:

```bash
git mv "docs/Roadmaps" docs/roadmaps-temp
git mv docs/roadmaps-temp docs/feature-roadmaps
```

Or alternatively, keep both but add a README noting the convention:

- `docs/roadmaps/` — project-level and API roadmaps
- `docs/Roadmaps/` — feature-specific journey/mission/roadmap packages

**Decision needed from user:** Merge into one folder or keep split with clear naming?

- [ ] **Step 3: Commit if changes made**

---

## Phase 5: Update INDEX.md

### Task 14: Update docs/INDEX.md

**Reason:** INDEX.md is the master navigation. It must reflect all moves.

- [ ] **Step 1: Read current INDEX.md**
- [ ] **Step 2: Remove references to archived files**
- [ ] **Step 3: Add needs-rewrite/ section**
- [ ] **Step 4: Update any broken cross-references**
- [ ] **Step 5: Commit**

```bash
git add docs/INDEX.md
git commit -m "docs: update INDEX.md to reflect audit moves and needs-rewrite staging"
```

---

## Phase 6: Verification

### Task 15: Verify no broken references

- [ ] **Step 1: Grep for references to archived files**

```bash
grep -r "DEEP_RESEARCH_FIVE_QUESTIONS\|MECHANICS_MAP_CASCADE\|joine-codes\|SMARTOUT_PLATTFORMEN\|docs_NEXTRA\|ORG_STRUCTURE_ROADMAP" docs/ --include="*.md" -l
```

Fix any remaining references to point to archive or replacement docs.

- [ ] **Step 2: Verify all YAML frontmatter parses**

```bash
find docs/ -name "*.md" -not -path "*/archive/*" -not -path "*/node_modules/*" | head -20 | xargs -I{} head -10 {}
```

Spot-check that no frontmatter is broken.

- [ ] **Step 3: Verify directory structure is clean**

```bash
find docs/ -type d | sort
```

Confirm: no empty directories left behind after moves.

- [ ] **Step 4: Final commit if fixes needed**

---

## Summary of All Moves

### To `docs/archive/` (delete from active docs)

| File                                                                  | Reason                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `DEEP_RESEARCH_FIVE_QUESTIONS.md`                                     | Research brief superseded by cascade-spreadsheet-overview |
| `MECHANICS_MAP_CASCADE_FOUNDATION.md`                                 | Working doc rolled into cascade spec                      |
| `RESEARCH_REACTIVE_OPERATIONS_ENGINE.md`                              | Research brief, results doc kept                          |
| `SMARTOUT_SYSTEMGUIDE_GAP_ANALYSIS.md`                                | Pre-cascade audit, gaps likely resolved                   |
| `joine-codes.md`                                                      | Ephemeral data, not documentation                         |
| `architecture/SMARTOUT_docs_NEXTRA_architecture.md`                   | Superseded by ADR-0030                                    |
| `architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md`                      | Superseded by cascade phasing                             |
| `engines/system-inteligence/03-notification-intelligence.md`          | Superseded by Cascade C2                                  |
| `engines/system-inteligence/04-state-machine-governance.md`           | Superseded by Cascade C4                                  |
| `engines/system-inteligence/05-verification-safety-and-learning.md`   | Superseded by cascade audit model                         |
| `engines/system-inteligence/06-autonomous-sensory-runtime.md`         | Unclear if used, superseded                               |
| `engines/system-inteligence/08-event-envelope-spec.md`                | Superseded by cascade event model                         |
| `engines/system-inteligence/09-gold-package-admin-onboarding.md`      | Superseded by cascade bootstrap                           |
| `engines/system-inteligence/10-implementation-and-gap-plan.md`        | Superseded by cascade plan                                |
| `engines/system-inteligence/AUDIT-frontend-data-connections.md`       | Audit artifact                                            |
| `engines/industri-inteligence/hospitalety/HAIKU-AUDIT-INSTRUCTION.md` | Audit artifact                                            |
| `emails/*` (3 files)                                                  | Historical communications                                 |
| `training/*` (2 files)                                                | Historical training transcripts                           |
| `handoffs/2026-03-02-schedule-infinite-loop.md`                       | Completed bug fix                                         |
| `handoffs/voice-problem-handoff.md`                                   | Abandoned, no timestamp                                   |
| `prompts/WEBPAGE_DESIGNE.md`                                          | Stale, no date                                            |
| `designprofiler/frontend-designer-agent-spec.md`                      | Legacy, superseded by SUBAGENT_SPEC                       |
| `designprofiler/hypotheses.md`                                        | Stale working doc                                         |
| `specs/payroll-wizard-architecture.md`                                | Placeholder, no content                                   |
| `specs/team-csv-mapping-architecture.md`                              | Placeholder, no content                                   |
| `agents/mobile-design/component-ledger.md`                            | Stale inventory                                           |
| `agents/mobile-design/decisions.md`                                   | Stale, superseded by SUBAGENT_SPEC                        |
| `agents/mobile-design/hypotheses.md`                                  | Stale, predates learning loop                             |

**Total: ~28 files archived**

### To `docs/needs-rewrite/` (merge candidates)

| File                                                             | Rewrite Target                        |
| ---------------------------------------------------------------- | ------------------------------------- |
| `engines/system-inteligence/00-core-state-engine.md`             | Cascade spec Section 2 or drop        |
| `engines/system-inteligence/01-system-architecture-contracts.md` | Cascade spec Phase D or drop          |
| `engines/system-inteligence/02-agent-framework-runtime.md`       | architecture/agent-framework.md       |
| `architecture/SMARTOUT_IMPLEMENTATION_GUIDE.md`                  | Extract Phase 0, archive rest         |
| `architecture/SMARTOUT_UI_ARCHITECTURE.md`                       | Extract personas, archive rest        |
| `architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md`                  | Merge into SECRET_API_INFRASTRUCTURE  |
| `SMARTOUT_PLATTFORMEN.md`                                        | Merge into SMARTOUT_SYSTEM_OVERVIEW   |
| `roadmaps/admin-onboarding.md`                                   | Merge into Roadmaps/Admin onboarding/ |

**Total: 8 files staged for rewrite**

### Fixed in place

| File                                            | Fix                                            |
| ----------------------------------------------- | ---------------------------------------------- |
| `modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md` | Repair broken YAML frontmatter                 |
| `modules/SMARTOUT_MODULE_7_ABSENCE.md`          | Mark as placeholder                            |
| `engines/system-inteligence/README.md`          | Add supersession notice                        |
| `WORKLOG.md`                                    | Move to `worklogs/WORKLOG-schedule-ui-root.md` |

### NOT touched (confirmed current)

- All cross-cutting/ (11 files)
- All reference/ (20 files)
- All narratives/ (8 files)
- All research/ (7 files)
- All superpowers/ (14 files)
- All industri-inteligence/hospitalety/ (27 files, minus 1 archived)
- Most architecture/ (21 of 26 files)
- Most modules/ (22 of 25 files)
- All User Manual/ (15 files)
- All journeys/ (40+ files)
- All decisions/ (55+ files)
- All learnings/ (17+ files)
- All worklogs/ (50+ files)
- All plans/ (100+ files)
