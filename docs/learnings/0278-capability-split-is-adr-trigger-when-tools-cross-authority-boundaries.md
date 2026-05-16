---
id: L-0278
title: "Capability split is an ADR-trigger when new tools cross authority boundaries"
status: accepted
date: 2026-05-16
discovered_in: chat-whatsapp Phase 3 priority council (2026-05-16) — Trust Gate D analysis
related_adrs: [ADR-0336, ADR-0078, ADR-0099, ADR-0163, ADR-0189, ADR-0287]
tags: [capability, authority, adr-trigger, channel-admin, harness]
---

# Capability split is ADR-trigger when tools cross authority boundaries

## Discovery

Chat-WhatsApp Phase 3 priority council (2026-05-16). Trust Gate D FAILS in
part because channel-admin tools (mute, leave, invite, rename, archive,
role_change) were briefed as extensions to the existing `communication`
capability without an ADR for the split.

The `communication` capability has `defaultAuthority: "read_only"` and
9 read-biased tools. Adding channel-admin tools would span three distinct
authority profiles:

| Tool | Required authority | Gap from defaultAuthority |
|---|---|---|
| mute, leave | autonomous | +2 levels above read_only |
| invite, rename, archive | confirm | +3 levels above read_only |
| role_change | confirm + min_role: admin | +3 levels + role constraint |

Adding tools that span authority levels makes `defaultAuthority` meaningless —
every tool would need a per-tool override, eliminating the purpose of the
capability-level default.

## The rule

**A capability split requires its own ADR when:**

1. **Authority divergence** — new tool's required authority differs from
   `defaultAuthority` by ≥1 level (read_only→autonomous is 1 level; extends
   existing gap further)
2. **Channel restriction divergence** — new tool requires a different
   `allowedChannels` profile than the existing capability (e.g. invite needs
   `["chat"]` for PII, existing `communication` allows multiple)
3. **min_role constraint introduced** — any tool requiring `min_role: admin`
   or `min_role: manager` where capability default has no role constraint

**A capability extension (no ADR needed) when:**
- New tool shares the same authority level as existing tools
- Same channel restrictions apply
- No new role constraints

## Why this matters

- **Authority seed** (`engine_authority_config`) has one row per capability.
  Mixed authorities within a capability mean the seed row is wrong for some
  tools — silent security misconfiguration.
- **ADR-0189** — authority seed ships atomically with first tool. If the
  capability is wrong, the seed is wrong from day 1.
- **Trust Gate** — capability split decision is a BLOCKER in Trust Gate D
  (the council finding). Without the ADR, the gate cannot pass.

## Detection gate

Before adding tools to an existing capability:

```bash
# 1. Read the capability's defaultAuthority
grep -A5 "capability: 'communication'" packages/ai/src/capabilities/*/index.ts

# 2. Classify each new tool's required authority
# autonomous | suggest | confirm | confirm+min_role | block

# 3. If any new tool authority ≠ defaultAuthority → ADR REQUIRED
# 4. If any new tool requires different allowedChannels → ADR REQUIRED
# 5. If any new tool introduces min_role → ADR REQUIRED
```

## Example: correct decision tree

```
Adding invite_to_channel to communication (defaultAuthority: read_only)?
  └── invite requires confirm + PII channel restriction
      └── authority diverges (read_only vs confirm) → ADR REQUIRED
          └── Carve new channel_admin capability (ADR-0336)
              └── Seed migration ships with first tool (ADR-0189)
```

## Relationship to other learnings

- L-0066 (default-allow capability authority CVE trap) — same class: wrong
  defaultAuthority is a security issue, not just a design issue
- L-0097 (C4 authority defaults are not free) — capability defaults have
  downstream consequences on every workspace bootstrap
- ADR-0278 (this) → ADR-0336 (channel_admin capability split)
- ADR-0189 (authority seed ships with first tool — the constraint this pattern
  enforces)
