---
topic: agent-def-is-instruction-not-manifesto
status: active
updated: 2026-06-01T00:00:00Z
created: 2026-06-01T00:00:00Z
supersedes:
metadata:
  type: feedback
---

# Decision lesson — agent-def-is-instruction-not-manifesto

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.

---

## Decision

**Agent-definition files (`agents/*.md`) are operating instructions for a model, NOT a manifesto/pitch for a human reader.** Write them so the agent knows _what to do_; cut everything written to _convince_. Bloat signature seen in `sxtn-harness-builder.md` (262 lines): the same rule restated 3–5× across differently-named sections (Standing Goal / Drive / Control Cycle / Hard Rules / Result all re-encode "no task left undone"; "two walls" appears 5×; "read evidence from disk" 4×), plus temperament-prose ("eager, allergic to idle", "relishes the fed-back instruction"), mantras/metaphors ("Mission orchestrates. Engine whispers."), and duplicate structure (Identity IS/IS-NOT **and** Hard Rules encode the same boundaries; Control Cycle **and** Startup Ritual are the same sequence twice).

**Rule going forward:** one fact, one home. Keep: frontmatter/tools, one-sentence goal, concrete mechanics (loop, test-on-install steps), deduped Hard Rules, output shape. Drop: drive/temperament, mantras, the "why it exists" essays, and any IS/IS-NOT block that Hard Rules already cover. Target ≈90 lines for a file like harness-builder, not 260.

## Why

A model spends tokens reading the whole def every invocation; redundancy-as-rhetoric is pure cost and dilutes the load-bearing rules among pep-talk. Pontus: "hvorfor er det så lang tekst? ... bare ranty rant." The file read like a pitch — every section trying to persuade — which is why the same idea recurred 5×. Relates to [[decision-hooks-command-not-prompt]] (another "the asset was authored for the wrong reader" failure).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01 — initial: agent-def files are instruction not manifesto; dedup repeated rules, cut temperament/mantra/why-essays; harness-builder 262→~90 lines target.
