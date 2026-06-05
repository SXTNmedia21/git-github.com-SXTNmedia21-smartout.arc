---
topic: redesign-wiring-pipeline
status: active
updated: 2026-05-31T13:30:17Z
created: 2026-05-31T13:30:17Z
supersedes:
---

# Decision lesson — redesign-wiring-pipeline

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

For a campaign that wires a finished UI-redesign onto an existing, already-wired backend, the fast-AND-honest pipeline is ordered, not parallel-first:

1. **Foundation sortie (serial, once):** port the design system tokens ONCE (never fork the source stylesheet) + set up the harness gate config. Everything downstream inherits it.
2. **Golden-path sortie (serial, one domain):** take a single backend-ready domain fully through — UI port that REUSES the existing data hook + full gate battery green. Proves the motion.
3. **Fan-out (parallel, ~3–4 worktrees):** the remaining backend-ready domains as copies of the golden-path motion.
4. **Gap track (parallel to 0/1):** domains with backend gaps get their backend closed FIRST on a separate track — they are the longest pole and the true wall-clock limiter, NOT the UI porting.

Two binding choices for such campaigns: (a) **port the redesign INTO the existing app and reuse its hooks** — never re-derive a data-access layer that already exists; (b) **full-strict gates ON** (no-mock + component-indexer noop + interactive_contract + e2e-against-live-seed + dual-perspective).

## Why

The redesign and the backend are both already done, so per-domain work is mechanical and independent → textbook pipeline. The non-obvious truth: **mechanically-enforced honesty makes wide fan-out FASTER, not slower** — noop_gate/no-mock/e2e-from-disk surface dead buttons and fake-finishes automatically, so the human stops being the per-agent review bottleneck and throughput becomes compute-bound. Two anti-patterns this ordering prevents: re-deriving hooks that already exist (pure waste — ~85% of wiring is free if reused), and fanning out before the pattern is proven (N agents make N different mistakes at once). Wall-clock is gated by the backend-gap domains, so start that track early or it lands on the critical path.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T13:30:17Z — initial: foundation→golden-path→fan-out→gap-track ordering; reuse-hooks over re-derive; full-strict gates enable (not hinder) wide parallel fan-out.
