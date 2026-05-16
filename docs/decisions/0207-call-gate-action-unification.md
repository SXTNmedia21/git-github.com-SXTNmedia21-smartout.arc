---
title: "callGateAction Unification to Single Canonical Wrapper"
id: ADR-0207
status: accepted
layer: decision
module: authority
created: 2026-04-24
updated: 2026-04-24
tags: [authority, gate-action, unification, invariant-13, council-2026-04-24]
---

# ADR-0207: callGateAction Unification to Single Canonical Wrapper

**Status:** Accepted
**Date:** 2026-04-24
**Council:** 2026-04-24 (Botsson Harness v2 spec review)

## Context and Problem Statement

Council 2026-04-24 Agent-Coordinator code-trace viste at `callGateAction` i dag finnes som **fire separate kopier** (per-capability gate.ts i memory / shift-lifecycle / contract-intake / journey) pluss en **femte direkte RPC-path** hvor agent-router kaller `gate_action` uten wrapper. ADR-0204 `gatedMutation()`-orkestratoren er en flag-OFF scaffold. En foreslått MCP-gateway `auth-guard.ts` ville ha blitt sjette-sjette call-site uten at de andre er retired.

Dette er nøyaktig CVE-klassen L-0066 / L-0097 allerede har kostet oss. Drift mellom fem paths garanterer stille feil i default-allow + gate_action-kombinasjonen.

## Decision Drivers

- ADR-0099 Invariant 13 krever `gate_action` på hver mutasjon. Med fem paths kan en mutasjon gå gjennom den path-en som ikke gater.
- ADR-0203/0204 holder dual-gate som to separate policies. Å legge til en sjette wrapper uten å rydde gjør den beslutningen umulig å opprettholde.
- Botsson v2-a (MCP-gateway) forutsetter en canonical wrapper — ellers replikerer MCP-gatewayen fragmenteringen i en ny package.

## Considered Options

1. **La de fire kopier stå, legg til MCP som sjette path.**
2. **Unifiser til én canonical wrapper, retire alle kopier.**
3. **Forkast wrapper-tanken, kall RPC direkte overalt.**

## Decision Outcome

**Valgt: Option 2.** Etabler én canonical `callGateAction`-wrapper. Alle fem eksisterende paths routes gjennom den. Per-capability `gate.ts` beholdes kun som tynn adapter over wrapperen hvis capability-spesifikk pre/post-logikk kreves — aldri som parallell implementasjon.

Denne unifiseringen er P0.1-prereq for v2-a (ADR-0206).

## Rules & Consequences enforced for Agents

- **Good, because** ADR-0099 Invariant 13 blir grepbar: `grep -R "callGateAction\|gate_action" packages apps` returnerer kun canonical path + direkte fra canonical wrapper.
- **Good, because** drift-risiko forsvinner.
- **Bad, because** unifiserings-sub-sortie må koordineres med pågående B1 SS-3/4/5.
- **Agent Impact:** Ingen ny `gate.ts` uten å route gjennom canonical wrapper. Close-feature-gate enforcer dette via grep. Enhver agent som foreslår "skip gate_action for performance / demo / MVP" blir avvist — autonomous er ikke skip-lisens (ref ADR-0196 Invariant 13).
