---
title: "Docstring Compliance Claims Are Not Evidence — Trace the Body"
id: LEARNING_0176
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [council, code-trace, capability, audit-gap, adr-0204]
---

# Learning-0176: Docstring Compliance Claims Are Not Evidence — Trace the Body

## Context

`packages/ai/src/capabilities/journey-authoring/tools.ts:282` carried the docstring: `"0204 gatedMutation surrounds the journey + journey_version inserts"`. Body at lines 443-481 contradicts: three direct `supabase.from("journey").insert()` / `.from("journey_version").insert()` / `.from("wizard_session").update()` calls executed outside any `gatedMutation` wrapper. Council R1 (2026-04-29) Phase 3 agent-coord + botsson-harness-builder caught the contradiction by tracing the function body. Chair Phase 3 missed it — partly because the docstring assertion was authoritative-shaped.

## Discovery

A docstring asserting "this code is X-compliant" is **a claim**, not evidence. Especially for compliance dimensions where the wrapper is a single function call — `gatedMutation(...)` is either present in the body or absent. Reading the docstring tells you the author's intent at writing time. Reading the body tells you the actual contract today.

The asymmetry that fooled Chair: docstring is at line 282 (visible at function-header skim), body is at lines 443-481 (requires scrolling 160 lines + actually parsing the inserts). Docstring is "what this should do." Body is "what this does."

The same shape generalizes:
- Docstring says "ADR-0204 compliant" → trace body for `gatedMutation` call
- Docstring says "emits telemetry" → trace body for `emit()` call
- Docstring says "delegates to capability X" → trace body for the actual call to X
- Docstring says "validates input via Zod" → trace body for the schema parse
- Docstring says "RLS-safe" → trace body for client choice (admin vs user)

## Impact

1. **Code-trace mandate addition:** when reviewing capability tools, ignore docstrings for compliance claims. Open the function body. Follow each persistence call. Verify the wrapper. The docstring is not the contract.
2. **Run-Council Phase 3 reviewer briefing:** add explicit instruction "do not accept docstring assertions about gate/emit/RLS compliance — trace body". Pair with L-0175's per-tool trace requirement.
3. **Lint potential:** future tooling could verify docstring-vs-body consistency for known compliance markers ("ADR-0204", "ADR-0099", "gatedMutation", "emit"). Out of scope for a learning, but worth flagging.
4. **Pattern signature:** when a docstring carries an unusually specific compliance claim (citing ADR by number, naming wrapper functions), that's also where bodies most often diverge from intent. Authors write the docstring at the start; bodies drift.

## References

- ADR-0204 — gatedMutation canonical mutation primitive
- ADR-0237 — journey-authoring tool boundary (this council outcome)
- L-0166 — journey/tools.ts has 7 direct writes bypassing both gates (same shape — bodies diverge from intent)
- L-0175 — per-tool trace mandatory (this council, sibling rule)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
