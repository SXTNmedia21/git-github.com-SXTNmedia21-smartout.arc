---
title: "SECURITY DEFINER RPCs change threat model — don't call them 'ceremony' without tracing"
id: LEARNING_0062
status: canonical
layer: learning
created: 2026-04-19
updated: 2026-04-19
tags: [council, security, rpc, rls, threat-model]
---

# Learning-0062: SECURITY DEFINER RPCs change the threat model — don't label them "ceremony" without tracing the SQL

## Context

System Health Audit Council (2026-04-19) briefing included a prompt to Supervisor asking "is the ADR-0091 `callGateAction` in `shift-lifecycle/tools.ts` actually protecting against the original attack, or just ceremony?" The framing implied the gate might be security theatre — a function call that makes the code look safer without actually providing protection.

Supervisor traced `packages/ai/src/capabilities/shift-lifecycle/gate.ts:41-71` and the underlying RPC definition. Finding: `gate_action` is declared `SECURITY DEFINER` and writes a `gate_evaluation` audit row server-side. The agent tool CANNOT forge `allow: true` — the RPC is the decision authority. The call from the tool is not ceremony; it is the actual gate.

## Discovery

`SECURITY DEFINER` in Postgres runs the function with the privileges of the function *owner*, not the caller. This means:
- The caller cannot override the function's internal decisions by passing hostile inputs.
- The function's writes (the `gate_evaluation` audit row) happen under the owner's auth, not the caller's.
- RLS policies inside the function apply to the *owner's* role, not the caller's.

This is fundamentally different from a regular function call where the caller's privileges propagate. A regular call can be "ceremony" (the caller could have done the write directly, the wrapper adds no protection). A `SECURITY DEFINER` wrapper is server-authoritative — the caller literally cannot skip it without directly writing to the underlying table (which RLS blocks).

**Rule:** Before labelling an RPC call "ceremony", trace the SQL function definition. Check for `SECURITY DEFINER`. If present, the wrapper is the enforcement boundary, not decoration.

## Impact

- **Council briefing discipline:** Authors must not frame RPC calls as "ceremony vs protection" without first confirming the RPC's security mode. The binary "ceremony or real" depends entirely on `SECURITY DEFINER`.
- **Agent Trust Gate:** When evaluating whether a tool's gate check is tamper-proof, the test is: trace to the RPC source, confirm `SECURITY DEFINER`, confirm RLS on any fallback direct-table path. If all three hold, the gate is real.
- **Code review:** Removing a `SECURITY DEFINER` RPC call because it "looks redundant" is a security regression disguised as cleanup. This is a P0 review catch.

## References

- Council: 2026-04-18 / 2026-04-19 System Health Audit (COUNCIL-LOG.md)
- Gate client: `packages/ai/src/capabilities/shift-lifecycle/gate.ts:41-71`
- ADR-0091 (cascade gate write) + ADR-0099 (tools call gate_action before mutation)
- Related: L-0062 is the positive case; prior L-0041/L-0054 covered cases where framing was wrong in the opposite direction

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
