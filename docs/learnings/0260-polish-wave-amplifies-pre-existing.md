---
title: "Polish-wave amplifies pre-existing debt — agent-callable bridge mounted on page with ungated browser-direct mutation"
id: L-0260
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: agent-harness
tags: [botsson, harness, blast-radius, gatedMutation, pre-existing-debt, bridge, organization]
---

# L-0260: Polish-wave amplifies pre-existing debt

## The Trap

When a polish wave adds an agent-callable bridge to a page that already has a browser-direct ungated mutation, the wave does NOT introduce the bug — but it expands the bug's blast radius from "user-click-only" to "agent-triggers."

**Concrete example (2026-05-14, B2 blocker):**

`apps/web/src/app/dashboard/organization/_components/EditDepartmentDialog.tsx` Save handler:
```ts
// Pre-existing browser-direct write — no gatedMutation, no Server Action
const { error } = await supabase.from("department").update({ name, ... }).eq("id", dept.id)
```

The 2026-05-14 organization bridge registered a `openDepartmentEdit(deptId)` tool that opens this dialog. Pre-bridge, the ungated mutation was only reachable via user click in the UI. Post-bridge, any agent (chat/voice/CI actor) can invoke `openDepartmentEdit`, and the user then "confirms" a dialog whose Save path bypasses authority entirely.

The council classified this as BLOCKER B2: bridge amplifies pre-existing audit trail gap + ADR-0204/ADR-0287 bypass to agent-callable surface.

## Why It's Invisible at Bridge-Time

1. Bridge author sees `openDepartmentEdit` as a navigation/propose tool (opens dialog, user confirms)
2. The confirm step feels like a "human in the loop" safety
3. The dialog Save handler is in a different file — not reviewed as part of the bridge PR
4. No lint rule catches "dialog opened by bridge uses direct Supabase client"
5. Pre-existing debt has no ADR or comment flagging it as ungated

## The Rule: Pre-Flight Audit Before Bridge Registration

Before mounting any `propose-flow` or `navigate` bridge tool that opens a dialog or triggers a mutation:

1. **Find the downstream handler** — what executes when the user confirms the proposed action?
2. **Grep for `supabase.from(` in the handler file** — is there a direct Supabase client call?
3. **If yes: fix the handler first** — wrap in Server Action + `gateAction` + `emit`, THEN register the bridge.
4. **If fix is out of scope for this sortie** — do NOT register the bridge tool. Defer to a dedicated sortie that fixes both.

Pattern: bridge registration and downstream-handler hardening are the SAME commit or the SAME sortie. Never split.

## Detection at Code Review

Review checklist for any new bridge tool that invokes `open*`, `propose*`, or `show*`:
- [ ] Find the component/dialog opened by this tool
- [ ] Open that component's Save/submit handler
- [ ] Confirm: `gateAction` or `Server Action` wrapper present?
- [ ] Confirm: `emit()` call present in onSuccess or BFF route?
- [ ] If NO to either: this is a B2-class amplification — BLOCK merge

## Promote to `smartout-page-polish` Skill Phase 4.5

Add to Phase 4.5 "underlying-hook audit" (per L-0254):
- Audit includes downstream dialogs/handlers, not just the hook called by the bridge
- grep for `supabase.from(` without `gateAction` in any component opened by propose-* tools

## Cross-references

- L-0254 (harness-bridge-reexposes-emit-gaps — same family, "bridge surfaces old bug")
- L-0176 (docstring drift — same class: false compliance signal)
- ADR-0204 (gatedMutation orchestrator)
- ADR-0287 (gate_action mandatory on mutation capability tools)
- ADR-0324 (page-tool authority semantics — B2 pattern defines forbidden mode)
- Polish-Wave QA Council 2026-05-14 (B2 blocker — EditDepartmentDialog blast-radius amplification)
- `apps/web/src/app/dashboard/organization/_components/EditDepartmentDialog.tsx` (concrete example)
