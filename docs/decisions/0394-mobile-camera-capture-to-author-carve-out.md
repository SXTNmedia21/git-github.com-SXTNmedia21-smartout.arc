---
title: "ADR-0133 carve-out — AI-mediated capture-to-author from camera evidence"
id: ADR_0394
status: accepted
layer: decision
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [procedure-engine, mobile, camera, authoring, carve-out, adr-0133]
---

# ADR-0394: ADR-0133 Carve-out — AI-mediated capture-to-author from camera evidence

## Context and Problem Statement

ADR-0133 ("web composes, mobile executes") draws a firm line: authoring/compose verbs — including
creating a routine — live on web. Mobile owns execute/approve/witness verbs. This ADR is sound in
the general case: drag-drop schedule editors, onboarding wizards, and governance authoring all
belong on web.

However, the natural capture moment for a photo→routine flow is physically on the phone, at the
location, where the task is being performed. Requiring the employee to walk back to a desktop to
"compose" a routine from a photo they just took on their phone defeats the purpose of the capture.
The 2B spec (`docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md`)
introduces a Botsson-mediated flow: take photo → AI extracts structured routine → human confirms →
routine committed. The human is always the decision-maker; Botsson is the author in the technical
sense, not the human. Without a carve-out, this flow is blocked by ADR-0133.

## Decision Drivers

- The capture moment is mobile-native (camera, physical location, shift context).
- ADR-0132 (mobile thin client) must be preserved — no heavy authoring logic on device.
- ADR-0133's principle ("web composes") must be respected at the spirit level, not just the letter.
- ADR-0136 (camera evidence as cascade extension) establishes that camera captures are a
  sanctioned mobile superpower, not a violation of mobile's "execute" role.
- The human-confirm gate (C4 `gate_action`) is non-negotiable — AI alone must never commit a
  routine without explicit human approval.
- Scope creep risk: this carve-out must not become a precedent for arbitrary mobile authoring.

## Considered Options

1. **Carve-out for AI-mediated + human-confirmed capture-to-author** (chosen) — the phone
   captures, AI extracts, human confirms via a C4 gate; the commit call is a thin BFF proxy.
2. **Web-only: capture on phone, author on web** — photo shared to web, user opens dashboard to
   complete authoring. Preserves ADR-0133 verbatim but destroys UX; the capture moment is lost.
3. **Full mobile authoring (no carve-out)** — amend ADR-0133 broadly to allow authoring on
   mobile. Rejected: opens the door to drag-drop editors, wizard ports, etc. on mobile. Too broad.

## Decision Outcome

Chosen option: **Option 1**.

**Sanctioned mobile cascade extension:** AI-mediated capture-to-author from camera/photo evidence,
gated by an explicit C4 human confirmation (`gate_action`), is a SANCTIONED mobile cascade
extension — a sibling to biometric C4 confirmation (ADR-0133 §mobile-native-superpowers) and
camera evidence (ADR-0136).

**Scope boundary (hard):**

- IN: Botsson-mediated extraction from a camera/photo image → structured routine draft →
  human reviews → human taps Confirm → BFF commits. The human confirms; Botsson is the author.
- OUT: Any freehand mobile authoring UI (drag-drop, text editor, wizard, form without AI mediation).
  These remain web-only per ADR-0133.
- OUT: Botsson committing a routine without a human-confirm step. The C4 gate is mandatory.

**ADR-0133 amendment:** §Mobile-native superpowers gains a third bullet:
> "AI-mediated capture-to-author — camera evidence piped through Botsson extraction + C4 human
> confirm gate. Scope-bound: AI proposes, human approves, BFF commits. NOT a general authoring
> precedent."

**Architecture compliance:** The mobile commit call routes through `/api/mobile/routine/commit`
(BFF, Arch B thin proxy per ADR-0132), matching the `/api/mobile/*` pattern. No authoring logic
runs on device. Botsson's extraction runs server-side (stage-engine, `/routine/extract`). The
device sends the Storage path and the human's confirmed edits; the server does the rest.

**Future precedent rule:** Future mobile-AI-authoring features MAY cite this ADR as precedent but
MUST satisfy both constraints: (a) AI-mediated (no freehand user composition on device) and
(b) explicit human-confirm gate before commit. Missing either constraint = not covered by this
carve-out; a new ADR is required.

## Rules & Consequences

- **Good, because** the capture moment stays on device (natural UX) while authoring authority
  stays server-side (ADR-0132 preserved in spirit).
- **Good, because** the C4 human-confirm gate means "AI proposes, human approves" — the
  "confident ≠ authorized" principle (cascade core) is upheld.
- **Good, because** scoping to AI-mediated + human-confirm prevents this carve-out from bleeding
  into arbitrary mobile authoring.
- **Bad, because** the boundary (AI-mediated vs freehand) requires judgment — it is not
  mechanically enforced at the ADR level. Future reviewers must actively check both constraints.
- **Agent Impact:** The 2B mobile commit flow is compliant with ADR-0133 as amended. When
  reviewing future mobile features that involve creating content: check ADR-0394 constraints
  (AI-mediated AND human-confirm) before citing this as precedent. If either constraint is absent,
  do NOT cite this ADR — open a new one. Never build a mobile authoring UI that bypasses both
  constraints, even as a "small" form.

Refs: ADR-0133 (web composes, mobile executes — amended by this ADR), ADR-0132 (mobile thin
client — BFF pattern preserved), ADR-0136 (camera evidence as cascade extension — sibling
precedent), ADR-0393 (ungoverned routines — enables the committed row to exist without a protocol),
ADR-0395 (multimodal image-storage contract — the extraction route this carve-out depends on).
Spec: `docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md` §4.

---

> Registered in `docs/decisions/0000-decision-log.md`.
