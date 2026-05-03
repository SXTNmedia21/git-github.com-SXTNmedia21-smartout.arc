---
title: "Amendment to ADR-0203/0204 — MCP-gateway consumes unified callGateAction (not parallel gate)"
id: ADR-0211
status: Accepted
layer: decision
module: authority
created: 2026-04-24
updated: 2026-04-24
tags: [authority, mcp, dual-gate, amendment, council-2026-04-24]
supersedes_sections: []
amends: [ADR-0203, ADR-0204]
---

# ADR-0211: Amendment to ADR-0203/0204 — MCP-gateway is consumer, not parallel gate

**Status:** Accepted
**Date:** 2026-04-24
**Council:** 2026-04-24 (Botsson Harness v2 spec review)

## Context and Problem Statement

ADR-0203 avviste unifisering av `gate_action` og `cascade_gate_write` som to forskjellige policies (agent-tool-authority vs Server-Action-data-authority). ADR-0204 valgte komposisjon via `gatedMutation()` orkestrator.

v2-specen (skrevet <24 timer etter ADR-0203/0204 ble akseptert) foreslo stille en MCP-gateway `auth-guard.ts` som ville kalt kun `callGateAction()` før hver tool-call. Dette ville effektivt kollapsert dual-gate tilbake til én gate. Council 2026-04-24 fanget dette som en "silent re-open".

## Decision Drivers

- Fremtidige "universal gateway"-forslag vil fortsette å foreslå unifisering med mindre ADR-0203/0204 har eksplisitt rekkverk om at nye transports er konsumenter, ikke parallelle policy-paths.
- ADR-0207 (callGateAction unification) gjør canonical wrapper til eneste riktige konsument.

## Considered Options

1. **La ADR-0203/0204 stå — håndter fremtidige re-opens case-by-case.** Avvist — gjentatte councils er dyrt.
2. **Amend med eksplisitt regel: MCP/Slack/CLI/andre transports er konsumenter av den canonical wrapperen.**
3. **Re-åpne dual-gate-spørsmålet.** Avvist — ADR-0203 beslutningen holder.

## Decision Outcome

**Valgt: Option 2.** Følgende regel legges til ADR-0203/0204:

> Enhver ny transport eller gateway (MCP, Slack, CLI, Discord, framtidige) er **konsument** av den unified `callGateAction`-wrapperen (ADR-0207). Den er **ikke** en parallell policy-path. Server Actions fortsetter å bruke `cascade_gate_write` for data-rule-enforcement. Dual-gate-beslutningen (to policies) holder på tvers av alle transports.

## Rules & Consequences enforced for Agents

- **Good, because** dual-gate-beslutningen er motstandsdyktig mot fremtidige "unify everything behind one gateway"-forslag.
- **Good, because** ADR-0207 får forsterket begrunnelse.
- **Bad, because** nye transports må eksplisitt lese denne amendmenten før design.
- **Agent Impact:** Når en agent foreslår en ny transport / adapter / gateway som kaller autoritet, må den 1) konsumere unified `callGateAction`, 2) aldri åpne dual-gate-spørsmålet på nytt uten skriftlig ny council. "Simpler if we just have one gate" er avvist-som-default.
