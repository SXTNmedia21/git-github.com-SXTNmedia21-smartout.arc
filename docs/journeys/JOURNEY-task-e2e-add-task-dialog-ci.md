---
title: "JOURNEY — task e2e: AddTaskDialog opens in CI (J3)"
status: in_progress
updated: 2026-05-26
created: 2026-05-26
module: task
journey-id: J3
sortie: task-e2e-spec-fixes
---

# JOURNEY J3 — AddTaskDialog opens fra Oppgaver-tab (Playwright UI)

## Symptom

Spec `daily-operation-tasks-add-task.spec.ts:24` J-C2-a — failing 3 retries:

```
Error: locator.click: Test timeout of 60000ms exceeded.
Error: expect(locator).toBeVisible() failed
       Expected: visible
       Error: element(s) not found
```

Dialog åpnes ikke. Lokator finner ikke element. 60s timeout.

## Diagnose path

1. Last ned Playwright trace fra artifact `playwright-report` → `tests-.../trace.zip`
2. Åpne trace, se siste skjermbilde — er bruker på riktig side? Logget inn? Redirect-loop?
3. Sjekk om setup-flow (PR #486 redirect-guard) er aktiv på fixture-bruker i CI
   - Memory: `project_dashboard_shell_setup_hydration_mismatch` + L-PGRST201 — setup-flow har historisk hatt redirect-loop issues
4. Mulige root causes:
   - Fixture-bruker ikke har profile.is_setup_complete=true → redirected til onboarding
   - Cookie/godmode bypass mangler i CI fixture
   - Sub-domain routing fungerer ikke (localhost vs slug.smartout.ai)

## Acceptance

- J-C2-a + J-C2-b begge grønne i `e2e-task.yml`
- Ingen retries på dialog-åpning

## Estimat

30-60 min. Krever artifact-nedlasting + trace-analyse først.
