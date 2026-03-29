---
title: "Hospitality Operations Cockpit V1 — First-Screen Design"
status: approved_with_changes
updated: 2026-03-28
created: 2026-03-28
module: operations
tags: [cockpit, first-screen, action-first, module-4, module-4.5, governance, mobile-parity]
---

# Hospitality Operations Cockpit V1 — First-Screen Design

> **Context:** Council verdict is **APPROVE WITH CHANGES** for the first-screen scope.
>
> **Goal:** Deliver one live, action-first cockpit screen that helps on-shift leaders detect risk, act safely, and keep operational flow moving.

---

## 1. Context and Goal

The cockpit is a **runtime execution surface**, not a feature catalog.  
V1 must prioritize what needs action now: staffing risk, operational/HACCP risk, progression on duty, guarded communication, and a single activity stream.

The first screen is successful when a leader can answer in under 10 seconds:

1. What is risky right now?
2. What action is safe to take now?
3. What changed in the last moments?

---

## 2. Locked V1 Scope (5 Slices)

V1 scope is locked to exactly these slices:

1. **Staffing risk**  
   Live staffing exposure based on shifts, absences, and critical coverage signals.

2. **Operational/HACCP risk**  
   Open critical tasks, missed controls, and unresolved deviations requiring immediate attention.

3. **On-duty progression**  
   Session progress against today’s required flow (what is done, blocked, overdue).

4. **Guarded broadcast path**  
   Fast message path to relevant on-duty recipients, gated by governance and audience constraints.

5. **Unified activity feed**  
   Chronological, deduplicated event stream across staffing, operations, reconciliation, and communication.

---

## 3. Non-Negotiables

1. **No new workflow state**
   - Cockpit reads and acts on existing runtime truth.
   - No parallel state machine for cockpit-specific status.

2. **C4 governance on quick actions**
   - All quick actions must pass authority checks before execution.
   - "Confident != Authorized" remains enforced.

3. **Normalized event envelope + dedup**
   - Feed events must use one normalized envelope.
   - Dedup is mandatory to avoid repeated cards/events from multi-source emissions.

4. **Shared contract for mobile parity**
   - Same data contract powers web and mobile surfaces.
   - V1 implementation cannot introduce web-only payload semantics.

---

## 4. UI Layout Hierarchy (V1)

First-screen hierarchy is fixed:

1. **Top strip (now):** current shift/session context, last refresh, active alerts count.
2. **Primary risk row:** staffing risk + operational/HACCP risk cards (highest urgency first).
3. **Progression row:** on-duty progression card with blockers and next required actions.
4. **Action rail:** guarded broadcast entry and scoped quick actions.
5. **Unified activity feed:** latest normalized events with clear actor, entity, and timestamp.

---

## 5. Interaction Constraints (V1)

- No deep workflow editing from cockpit cards.
- Quick actions must be explicit, reversible when possible, and audited.
- Risk cards open focused detail panels; they do not spawn alternate flows.
- Feed interactions support acknowledge/open-context only (no hidden state mutation).
- Visual priority is urgency-first, not module-first.

---

## 6. V1 Defer List

Deferred beyond V1:

- Predictive recommendations and auto-remediation proposals.
- Custom per-role cockpit layouts.
- Multi-location command center view.
- Advanced trend analytics and historical drill-down on first screen.
- OCR-heavy reconciliation enhancements beyond current runtime truth.
- Any new workflow-state expansion tied only to cockpit UX.

---

## 7. Risks and Mitigations

| Risk                                    | Impact                      | Mitigation in V1                                                    |
| --------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| Event noise or duplicate activity items | Leader trust drops          | Normalize envelope + enforce dedup before feed render               |
| Unsafe fast actions                     | Governance breach           | Mandatory C4 authorization check on all quick actions               |
| Screen overcrowding                     | Slower decisions            | Fixed hierarchy and locked 5-slice scope                            |
| Drift between web and mobile behavior   | Inconsistent operations     | Shared contract and parity checks before release                    |
| Runtime/source mismatch                 | Wrong operational decisions | Read only runtime truth (existing session + reconciliation sources) |

---

## 8. Acceptance Criteria

V1 is accepted when all are true:

- Cockpit first screen renders the 5 locked slices and nothing outside scope.
- No new workflow-state tables or cockpit-specific state machine is introduced.
- Quick actions are blocked when authority fails and logged when executed.
- Activity feed uses normalized envelope and deduplicates repeated events.
- Same contract is consumed by web and mobile clients without schema fork.
- Runtime status shown in cockpit matches existing operational sources of truth.
- Action latency and refresh behavior support real-time operational use.

---

## 9. Implementation Boundary Note

This decision defines **first-screen V1 scope only**.  
It does not replace broader module specs for operations, reconciliation, or cascade; it constrains what the cockpit must ship first.
