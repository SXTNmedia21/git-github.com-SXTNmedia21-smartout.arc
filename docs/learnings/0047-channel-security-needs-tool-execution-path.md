---
title: "ADR-0078 channel security requires a tool execution path — without it the guard is vacuous"
id: LEARNING_0047
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [security, adr-0078, mobile, council, channel-restriction, defence-in-depth]
---

# Learning-0047: Channel security guard is vacuous without a tool execution path

## Context

2026-04-17 mobile strategy council. ADR-0078 ("voice forbidden for critical data") established a 3-layer defence:

1. Process-level: `engine_process.allowed_channels`
2. Capability-level: `capability.allowedChannels`
3. Tool-level: `ctx.channel` guard inside tool execution

Agent-coordinator code-traced mobile and found that on mobile, layer 3 *never fires* — because mobile has no tool execution path. Mobile Botsson chat writes directly to `chat_message` table; it never invokes a capability tool through stage-engine. The `ctx.channel` guard exists in the capability tool code, but no tool ever runs from a mobile-originated request.

So mobile users could (today, theoretically) submit critical data via voice channel hint, and no layer would block them — because the path that would block them doesn't execute.

## Discovery

Defence-in-depth assumes all layers fire. If a path bypasses the layers entirely, the defence is theatre. Specifically:

- Layer 1 (process allowed_channels) only fires if a process is started → mobile doesn't start processes through stage-engine
- Layer 2 (capability allowedChannels) only fires if a capability is invoked → mobile doesn't invoke capabilities
- Layer 3 (tool ctx.channel) only fires if a tool runs → tools don't run for mobile-originated requests

All three layers are structurally bypassed by the architectural choice that mobile chat persists to `chat_message` directly without going through the agent pipeline.

### The invariant

**Security ADRs that name enforcement layers must include an enforcement test that proves the layers fire on every supported invocation path.** Without the test, "we have 3-layer defence" is a claim, not a fact.

For ADR-0078 specifically: every client surface that can submit user input to AI must have a test that demonstrates the channel guard rejects forbidden combinations. If the surface bypasses the agent pipeline, the bypass itself is the security violation — not "missing layer 3 guard."

## Application

- ADR-0132 routes mobile AI through web BFF → stage-engine, restoring all 3 layers for mobile
- Future security ADRs require an "enforcement test plan" section listing how each layer will be proven to fire
- Council reviewers ask "what test proves this enforcement?" not "is the code in the right place?"
- A surface that bypasses an enforced pipeline is a security finding by itself — not a feature gap

## Repeat-learning watch

If new client surfaces (mobile, embedded widgets, third-party integrations) appear and haven't had their channel guard test verified, surface as a council blocker.
