---
title: L-0347 Reviewer counter-claims need same code-trace standard as chair claims
id: L-0347
status: canonical
updated: 2026-05-24
created: 2026-05-24
module: meta
tags: [council, trust-gate, reviewer, citation, symmetric-rigor]
related: [L-0344, L-0176, L-0297]
---

# L-0347 — Reviewer counter-claims need same code-trace standard as chair claims

## What happened

Journey-sweep 2026-05-24 council. Chair Phase 3 said "BUG-16 (contracts-compliance auth fail 11/11) needs 30-min auth-route diagnosis (possibly token_hash fallout from PR #441)."

**Two reviewers counter-claimed:**
- Agent Coordinator Phase 3: "BUG-16 = seed gap. `anna@strommatabar.local` user not in seed."
- Supervisor Phase 3: "BUG-16 = 5-min sed. Password literal `testpassword123` (spec line 25) vs `password123` (seed.sql:59 crypt). 11 specs need sed."

Chair Phase 5 grep-verified the counter-claims. **Both reviewer claims were FALSE:**
- Direct grep of `apps/e2e/tests/*.spec.ts` showed `password123` (matches seed) — no `testpassword123` literal exists
- The "seed gap" claim was directionally true (strommatabar workspace not in default seed) but the proposed "5-min sed" fix was based on a literal that doesn't exist

Real BUG-16 cause: still unknown. Both counter-claims were equally confident-sounding as chair's original direction. **All three claims needed grep-verification; only chair's Phase 3 was treated as needing verification.**

## Why it matters

Council Phase 5 protocol mandates chair self-reversal when 2+ reviewers vote opposite with code-trace evidence (L-0147). **The protocol implicitly trusts the reviewers' evidence.** This council demonstrates that reviewer counter-claims can be equally wrong — and when both chair AND reviewers are wrong, Phase 5 can synthesize a verdict that is doubly wrong.

The asymmetry: chair claims are scrutinized in Phase 5; reviewer counter-claims are typically accepted as falsifying evidence. When the falsifying evidence is itself unfalsified, the system has a blind spot.

## How to apply

**Symmetric trust-gate (Phase 5 chair MUST do):**
- For every reviewer counter-claim that contains a file:line citation OR a specific literal value, grep-verify the citation before accepting it as L-0147 falsifying evidence
- If reviewer cites a literal (e.g. password value, env var name, error message text), confirm the literal actually appears at the cited location
- If reviewer cites a file path, confirm the file exists
- If reviewer cites a symbol/function, confirm grep finds it

If a reviewer counter-claim fails verification, treat it as a **partial reversal at most** — chair's original direction may still be correct, just over-narrow or under-specified.

**Canonical Phase 5 format addition:**

```
Reviewer X counter-claim Y was [TRUE/FALSE].
Verification: <grep command output or file:line>.
Classification: ACCEPTED / REJECTED / PARTIAL.
```

## Sibling patterns

- [[L-0344]] — BUGS.md ghost-claim pattern (author-side trust-gate)
- [[L-0176]] — docstring drift (author asserts compliance, body doesn't deliver)
- [[L-0297]] — ADR-to-enforcement-code receipt (ADR claims enforcement, no artifact)

## Precedent count

1st codified occurrence. Likely 2nd-3rd occurrence will come from future multi-reversal councils. Promote to council SKILL.md Phase 5 hard rule on 3rd repeat.
