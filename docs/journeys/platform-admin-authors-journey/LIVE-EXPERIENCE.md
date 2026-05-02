---
title: "Live experience — Platform admin authors a new journey"
journey_id: platform-admin-authors-journey
created: 2026-04-29
updated: 2026-04-29
---

# Live experience

Pontus opens `/platform-admin/journeys` in the dashboard. The "Ny journey"
button is top-right with a plus icon. He clicks. The launcher inserts a
fresh `wizard_session` row, redirects him to
`/platform-admin/journeys/wizard/<wizard_session_id>`, and the chat
surface fades in. The phase indicator shows "Fase 1/6 — Discovery".

In the textarea he types one paragraph: what the journey should
accomplish, who triggers it, what the actor is. He presses send. The
agent reads, asks one or two clarifying questions if the goal sentence
contains "and", and proposes a title plus a one-sentence
trigger_description. Pontus confirms; the agent calls `save_draft` and
the phase pill flips to "Fase 2/6 — Classification".

The agent runs `check_duplicates` and `lookup_journeys` before
proposing module, actor, platform, priority, and tags. It quotes any
sibling journeys it found. Pontus approves the classification; another
`save_draft` call persists.

Phase 3 is the longest. The agent walks Pontus through the user flow
chronologically. Each step is one user action. The agent pushes back on
"steps" that are really three sub-actions, on UI rendering used as a
step, and on flows with more than 12 steps. After 6–10 steps with keys,
actions, expects, screens, and components locked in, Pontus says "go".

Phase 4 fixes the test assertion (one Playwright-runnable line) and the
preconditions array. Phase 5 captures Norwegian copy: doc_title plus
the three outcome blocks (success, empty, error). Each phase ends with
a `save_draft` to wizard_session.

Phase 6 is the lock. The agent shows the complete spec as a table plus
a steps list. It waits for an explicit "godkjent". On confirmation it
calls `publish_draft(confirm: true)`. The tool reads
`wizard_session.draft_journey`, builds a v2.1 JourneyIR, inserts a
`journey` row (status `ready_test`) and a `journey_version` row, marks
the wizard_session completed, and returns the `journey_version_id`. The
agent chains immediately into `journey.publish_mission(journey_version_id)`,
which writes one `engine_missions` row (`is_active=false` per ADR-0194)
and N `engine_stages` rows. The agent reports the mission_id back to
Pontus and notes that activation is a separate enrichment step.

Pontus closes the wizard. The journey is now in the catalogue with
status `ready_test`. The next platform admin who hits the runtime sees
the new mission ready to enrich.
