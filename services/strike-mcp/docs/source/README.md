---
title: Tier 2 Source Documentation
status: draft
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [tier2, governance, content-model, source]
---

# Tier 2 Source Documentation

Place your Bubble governance/content model documentation here. Claude reads
this folder at session start when working on Tier 2 mapping.

## What to put here

1. **bubble-content-model.md** — your overview of how aktiviteter, håndboken,
   and kvisser (quizzes/quality checks) relate in Bubble. Norwegian or English.

2. **bubble-mcp-types/** — copy your existing MCP's TypeScript type definitions
   or JSON schemas that define the entity structure. Don't need the running MCP —
   just the type files so I can see the shape.

3. **bubble-entity-exports/** — CSV exports or screenshots from Bubble Data Tab
   showing the actual fields on: training, handbooks, tasks, subtasks, inventory,
   supplements, shift_templates.

4. **v3-governance-mapping-notes.md** — any thoughts you already have on how
   Bubble content maps to v3's governance hierarchy (policy → protocol →
   procedure / routine / runbook / control_list / knowledge_test / confirmation).

## What I already know (from Tier 1)

- Bubble entity sidecars exist in `mappings/.local/` with column-level samples
- v3 governance model is hierarchical (CLAUDE.md: "policy → protocol → {procedure,
  routine, runbook, control_list, knowledge_test, confirmation}")
- 12 non-Tier-1 entities with ~1,870 rows total
- handbooks (26 rows) already matched to public.runbook
- training (706 rows) is the biggest structural challenge

## Next session pickup

1. Read everything in this folder
2. Propose structural transformation (Bubble flat → v3 hierarchy)
3. Run council for the hard decisions (training, tasks)
4. Attest tractable entities (supplements, shift_templates, handbooks)
