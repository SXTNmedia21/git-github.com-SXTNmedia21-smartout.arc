---
title: "Web Composes, Mobile Executes — Cascade Surface Boundary"
id: ADR_0133
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-18
accepted: 2026-04-18
---

# ADR-0133: Web Composes, Mobile Executes — Cascade Surface Boundary

## Context and Problem Statement

The recurring product framing "make mobile reach parity with web" was tested in Council 2026-04-17 and rejected. Two independent reviewers (system-steward via cascade ontology, frontend-designer via UX verb-table) converged on the same boundary from different angles: web is an authoring/composition surface, mobile is an in-venue execution surface. Six prior councils (2026-03-26 through 2026-04-14) all deferred mobile work as "Phase 2" without articulating WHY — the missing answer is that mobile is not a smaller web, it is a different surface with different verbs onto the same cascade model.

## Decision Drivers

- Cascade ontology has dimensions (D1–D6) and control planes (C1–C4), not a "platform" axis — web and mobile are both execution surfaces onto the same model
- Mobile-on-shift-floor has different ergonomics: one hand, wet hands, gloves, bright sunlight, 3-second attention window, frequent interruption
- Building "smaller dashboard" features on mobile produces a feature graveyard (each web feature half-ported, never used)
- ADR-0078 forbids voice for critical data — mobile cannot be a parity surface for voice-driven authoring
- Mobile-native capabilities (camera evidence, biometric, GPS, push) are cascade extensions web cannot provide

## Considered Options

1. **Pursue feature parity with web.** Rejected: framing produces feature graveyards; reviewer consensus rejects it.
2. **Mobile is read-only.** Rejected: shift workers need to punch, swap, report deviations from the floor.
3. **Web composes (D1–D5 authoring), mobile executes (D6 production + C4 acceptance).** Chosen.

## Decision Outcome

**Chosen: Option 3 — verb boundary between surfaces, both reading the same cascade model.**

| Verb | Web | Mobile |
|---|---|---|
| Author | YES | NO |
| Compose | YES | NO |
| Plan | YES | NO |
| Approve | YES | YES (primary) |
| Execute | limited | YES (primary) |
| Witness/log (with camera) | limited | YES (primary) |
| Browse/discover | YES | YES |
| Configure | YES | read-only |

## Rules & Consequences

### R1. Mobile owns D6 production + C4 acceptance
- D6 surfaces (department_session, session_hook, session_task, schedule_shift, deviation) get mobile execution UIs
- C4 surfaces (change_proposal approval, override decisions) get mobile approval UIs
- Mobile reads from D1–D5 but never authors them

### R2. Web-only verbs (out of scope on mobile)
- Schedule drag-drop editor (web-only — D6 authoring + grid editing)
- Onboarding wizard (web-only — long-form composition)
- Contract authoring (web-only — DocuSeal template + composition pipeline)
- Governance authoring (policy/protocol composition — web-only)
- Workspace setup / organization configuration (web-only)
- Year-wheel planning (web-only — strategic D4 demand authoring)
- Cost / billing / reconciliation (web-only — admin cockpit)
- AI authoring tools (spokesperson AI panel, etc. — web-only)

### R3. Mobile-native superpowers map to cascade dimensions, not "mobile features"
- Push reminders → D6 production hooks
- GPS clock-in → D6 session_hook with location truth
- Camera evidence → governance protocol completion artifact (see ADR-0136)
- Biometric → C4 authority gate confirmation
- NFC ID badge → identity layer

### R4. Mobile IA reflects the verb boundary
- Tab bar surfaces execution + approval, not authoring
- The hidden `(payroll)/` group must be deleted (see Council 2026-04-17 finding 6)
- A `MOBILE_IA_CONTRACT.md` document at `docs/architecture/MOBILE_IA_CONTRACT.md` enumerates every screen, its cascade surface ownership, and its allowed verbs

### R5. The "decline shift" mutation is in scope on mobile
- Resolved per Council 2026-04-17 Pair E — declining a shift is execution (D6 production response), not authoring
- Routes through capability tool, fully telemetered, channel-restricted

### Agent Impact
- **Steward:** verify every new mobile screen against the verb table in R1/R2 before approving
- **Build agents:** if a feature request maps to "Author" or "Compose" verbs, route to web-only by default
- **Frontend-designer:** mobile redesigns enforce the verb table — when in doubt, choose execute over author
- **Product:** new mobile features must declare their D-dimension or C-plane in the spec

## Consequences

- **Good:** mobile becomes coherent ("what is mobile FOR") instead of "smaller web"; cascade integrity preserved
- **Bad:** rejects user requests for "do X on mobile too" when X is authoring; needs Pontus's air cover for the boundary
- **Migration cost:** rewriting product backlog priorities; some half-built mobile features may need scope reduction

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-references ADR-0132, ADR-0078, ADR-0114. Drives the MOBILE_IA_CONTRACT.md document (to be written).
