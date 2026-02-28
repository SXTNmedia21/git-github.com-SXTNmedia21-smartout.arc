---
title: "[Feature/Task Name] — Implementation Plan"
id: PLAN_SHORT_ID
status: draft
layer: plan
created: YYYY-MM-DD
updated: YYYY-MM-DD
depends_on:
  - [ARCH_DOC_ID or ADR_NNNN if applicable]
---

# [Feature/Task Name] — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence — what this plan achieves when complete.]

**Tech Stack:** [Key technologies used in this implementation.]

**Source documents:**

- [Link to architecture doc, ADR, or spec that drives this plan]

---

## Architecture Overview

[Brief summary of the technical approach — 2-3 paragraphs max.]

## Prerequisites

- [ ] [What must exist before starting]

## Tasks

### Task 1: [Name]

**What:** [Description]
**Files:** [Files to create or modify]
**Acceptance:** [How to verify it works]

### Task 2: [Name]

**What:** [Description]
**Files:** [Files to create or modify]
**Acceptance:** [How to verify it works]

### Task 3: [Name]

**What:** [Description]
**Files:** [Files to create or modify]
**Acceptance:** [How to verify it works]

## Validation

- [ ] [Check 1 — e.g., build passes]
- [ ] [Check 2 — e.g., tests pass]
- [ ] [Check 3 — e.g., manual verification]

## Post-Implementation

- [ ] Update CLAUDE.md if conventions changed
- [ ] Write ADR if architectural decision was made
- [ ] Write Learning if something unexpected was discovered
- [ ] Register in `docs/INDEX.md`
- [ ] Move to `docs/plans/completed/` when done

---

> After writing: add to `docs/INDEX.md` under Plans.
