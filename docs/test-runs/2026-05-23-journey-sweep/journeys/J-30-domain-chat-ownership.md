---
title: J-30 Domain Chat Ownership — ADR-0238 surface ownership
status: FAIL
journey_docs:
  - JOURNEY-domain-taxonomy.md (related)
  - ADR-0238 (canonical)
spec: apps/e2e/tests/domain-chat-ownership/
result: 1 passed / 7 failed
evidence: ../evidence/run-30-domain-chat-ownership.log
---

# J-30 Domain Chat Ownership — FAIL (7/8)

4 specs: botsson-provider-scope, komm-chat-passive, komm-thread-passive, schedule-active

7 fails suggests systemic regression in Orb suppression logic — direct ADR-0238 violation (see L-0178 in main MEMORY.md).

## Action
- Inspect 7 failures (`evidence/run-30-domain-chat-ownership.log`) — confirm if cascade or distinct UX violations
- ADR-0238 enforces Orb passive-mode when domain chat declares ownership; failures suggest the suppression mechanism broke
- Same class as the wizard textbox vs Orb dual-surface UX trap noted in MEMORY.md
