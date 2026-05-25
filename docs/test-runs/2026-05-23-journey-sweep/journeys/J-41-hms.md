---
title: J-41 HMS — Avvik / Drift / Oversikt / Signoff
status: FAIL
journey_docs:
  - JOURNEY-hms-phase-1.md
  - JOURNEY-ui-shell-hms-cluster-polish-*.md (3 docs)
  - JOURNEY-ui-shell-hms-collision-fix.md
spec: apps/e2e/tests/hms-*.spec.ts (4 specs)
result: 2 passed / 11 failed
evidence: ../evidence/run-41-hms.log
---

# J-41 HMS — FAIL (11/13)

11 fails — broad HMS surface regression. Could be:
- Recent UI cluster polish/r2-fixup drift (multiple ui-shell-hms-* journey docs in repo)
- Seed gap (no protocol assignments → empty states)
- Auth issue (admin context not resolving HMS routes)

## Action
- Inspect 11 failure causes
- Likely related to recent HMS polish sortie work documented in MEMORY.md
