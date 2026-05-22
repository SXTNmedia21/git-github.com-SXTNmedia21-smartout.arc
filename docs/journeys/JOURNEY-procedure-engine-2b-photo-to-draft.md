---
title: "Journey — Manager captures checklist photo and gets a draft"
feature: procedure-engine-2b
journey: photo-to-draft
status: draft
verified_at: null
e2e_test: null
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [journey]
---

# Journey: Manager captures a checklist photo and gets a routine draft

**Role:** manager

**Precondition:** Manager is authenticated in the mobile app with a non-empty workspace + profile context.

## Happy Path

1. Manager long-presses the center FAB (≥500ms) → BotssonSheet opens.
2. Manager taps the image button in the text-mode input row → picks (or captures) a photo of a printed checklist → app uploads the image to the `routine-source` bucket.
3. App calls `POST /api/mobile/routine/extract` with the storage_path → stage-engine vision returns a structured draft.
4. A compact draft summary card appears in the transcript ("Fant N oppgaver — <navn>") with a "Gjennomgå og opprett" affordance.

**Postcondition:** A routine draft is held in client state; zero database writes have happened.

## Error Paths

- **Unreadable image / no tasks found** → extract returns an empty step set; sheet shows a message, no card.
- **Upload fails / signed-URL fails** → error surfaced in the sheet, no card.
- **Permission denied (media library/camera)** → no upload attempted; permission prompt shown.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E/Detox test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end on device

**Mark `status: verified` in frontmatter when all three boxes are checked.**
