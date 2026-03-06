---
title: Decision Log
status: in_progress
updated: 2026-04-10
created: 2026-03-04
module: operations
tags: [decisions]
---

# Decision Log — journey-package-skills

| #   | Date       | Decision                                                                                                         | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-06 | Mission skill produces both Mission.md + seed SQL (executable artifact, not just design doc)                     | Accepted |
| 2   | 2026-03-06 | Observability contract mandatory in every mission (three pillars: results, trackability, triggerability)         | Accepted |
| 3   | 2026-03-06 | Journey steps don't map 1:1 to mission stages (UI-only steps and confirmations should merge)                     | Accepted |
| 4   | 2026-03-06 | Triage gate: not every journey needs a mission (system journeys get stub Mission.md with status: not-applicable) | Accepted |
| 5   | 2026-03-06 | Agent-added stages are valid (greeting/wrapup stages may have no Journey step)                                   | Accepted |
| 6   | 2026-03-06 | Guardian integration is automatic, not manual (events flow through emitGuardianEvent())                          | Accepted |
| 7   | 2026-03-06 | journey_step_id is the Guardian bridge (without it on engine_stages, Guardian evaluator skips the stage)         | Accepted |

---

# Decision Log — season-creation-wizard

| #   | Date | Decision | Status |
| --- | ---- | -------- | ------ |

module: governance
tags: [decisions]

---

# Decision Log — governance-admin-ui

updated: 2026-03-06
created: 2026-03-06
module: platform-admin
tags: [decisions]

---

# Decision Log — service-layer

updated: 2026-03-06
created: 2026-03-06
module: onboarding
tags: [decisions]

---

# Decision Log — onboarding-showcase-system-room

| #   | Date | Decision | Status |
| --- | ---- | -------- | ------ |
