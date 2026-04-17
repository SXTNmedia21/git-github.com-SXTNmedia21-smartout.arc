---
title: "Migration is knowledge extraction, not table-by-table transfer"
id: LEARNING_0034
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [migration, strike-mcp, bubble, governance, scope]
---

# Learning-0034: Migration is knowledge extraction, not table-by-table transfer

## Context

Tier 2 strike-mcp council (2026-04-17) ran 4 reviewers + Steward synthesis on
11 questions about Bubble→v3 governance mapping. The council produced a verdict
of APPROVE WITH CHANGES with 7 ADRs, 3 product decisions, 3 discovery passes,
and a Tier 1 patch.

Pontus then halted the council with one Norwegian sentence:

> "Vi behøver jo ikke hente informasjonen table by table. Vi må bare hente
> kunnskapen fra Workspacen og implementere den i version 3."

This dissolved most of the verdict. The 11 questions assumed a 1:1 schema
mapping problem. The actual problem is content extraction.

## Discovery

When the source schema encoded workarounds for the source platform's UX
limitations, 1:1 mapping imports the limitations and creates phantom decision
work. Specifically for Bubble→v3:

- Bubble's "Global content" + "add to workspace[]" array existed because
  Bubble had no shared template layer. v3 has K1a — but v3 doesn't *need* a
  K1a governance layer just because Bubble had cross-workspace content.
- Bubble's `_activityType` × `_dataType` discriminator existed because Bubble
  flattened multiple content types into one entity. v3 has separate entities
  (procedure, runbook, knowledge_test) — we don't need to discriminate, we
  re-create as the right entity.
- Bubble's activity tree (`children` + `🚀 Parant`) existed because Bubble
  had no second hierarchy primitive. v3 has `protocol → procedure_step` — we
  use that natively.
- Bubble's multilingual `§locale§` concatenation existed because Bubble had
  no i18n. Wrightegaarden writes in Norwegian. We use Norwegian.

The reframe: read Wrightegaarden's *content* — the handbook chapters, the
training material, the quizzes — understand what they wanted to teach, and
re-create that intent as v3-native rows.

## Impact

**For strike-mcp Tier 2:** Stop building a structural-mapping pipeline.
Build a content-extraction + v3-native-creation pipeline. The 7 ADRs from
the council verdict (Tier 1 runbook patch is the only one that survives)
are not needed. Most of the 11 questions evaporate because they were
schema-shape questions that don't apply when we choose the v3 shape ourselves.

**For future migrations from any source:** Before building a 1:1 mapper, ask:
"Is this schema the source's data model, or the source's UX model?" If it's
the UX model (and the target has a better UX model), extract the knowledge,
not the schema. A migration that imports source-platform compromises is a
migration that never settles — every quirk becomes a permanent v3 quirk.

**For council process:** A reviewer asking "is this question even the right
question?" is more valuable than 11 well-resolved sub-questions. The Frontend
Designer surfaced a hint of this ("Bubble's data model encoded workarounds
for Bubble's UX limitations") but the council didn't escalate it to "halt and
reframe." Pontus's reframe came after the verdict landed. Future councils on
migration topics should include an explicit "is the framing correct?" gate
before Phase 3 dispatch.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-17 entry
- Strike-mcp Tier 2 discovery: `~/dev/strike-mcp/docs/source/DISCOVERED-bubble-content-model.md`
- New Tier 2 spec: `~/dev/strike-mcp/docs/superpowers/specs/2026-04-17-tier2-content-extraction.md`
- Related: Learning 0033 — Migration attestation completeness ≠ apply-readiness
- Related: Tier 1 council verdict 2026-04-16

---
