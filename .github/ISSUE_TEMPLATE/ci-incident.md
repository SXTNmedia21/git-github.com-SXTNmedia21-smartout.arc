---
name: CI Incident
about: File a CI/CD failure for agent triage
labels: ci-incident
assignees: ''
---

## Run URL

<!-- Paste the GitHub Actions run URL -->

## Branch

<!-- Which branch was this on? -->

## First seen

<!-- When did you first notice? (date or run link) -->

## Suspected class

<!-- Mark the most likely class with an X -->

- [ ] `app-bug` — Application logic regression (test fails on code error)
- [ ] `ci-config` — Workflow YAML misconfiguration (missing concurrency, timeout, bad action pin)
- [ ] `dep-cache` — pnpm/Turbo dependency or cache failure
- [ ] `env-secrets` — Missing or expired environment variable / secret
- [ ] `flaky-test` — Intermittent test failure (passes on re-run)
- [ ] `deploy` — Deploy-class failure (HOP A/B, promote-preview, smoke) — hand off to deploy-conductor
- [ ] `security` — Leaked credential or security scanner triggered

## Notes

<!-- Any context that helps triage: log excerpt, recent merge, related PR, suspected pattern -->
