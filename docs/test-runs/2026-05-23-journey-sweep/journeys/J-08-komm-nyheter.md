---
title: J-08 Komm Nyheter — announcement targeting + pin + agent-publish
status: FAIL
journey_docs:
  - JOURNEY-announce-kind-tier-link.md
  - JOURNEY-botsson-publishannouncement-capability-*.md (4 docs)
spec: apps/e2e/komm-nyheter/
result: 2 passed / 8 failed
evidence: ../evidence/run-08-komm-nyheter.log
---

# J-08 Komm Nyheter — FAIL (8/10)

## Failures

### BUG-1: engine_authority_config missing for `communication` capability (CRITICAL)
- Tests: agent-publish journey-1 (Call A + Call B), journey-3
- Error: explicit message `"engine_authority_config missing for capability=communication. Run migration 20260601100000_seed_communication_authority.sql first."`
- Hypothesis: local DB does not have the seed migration applied; OR migration was renamed/timestamped after last seed.
- Impact: `publish_announcement` capability blocked end-to-end.
- Action: `npx supabase db reset` OR apply seed migration directly.

### BUG-2: Audience selector strict-mode violation
- Test: journey-2 audience targeting (`Bar` button)
- Error: `getByRole('button', { name: /bar/i })` resolves to 5 elements; spec expects 1
- Hypothesis: real UI ambiguity — multiple buttons match "bar" (Toolbar? Sidebar? Department "Bar"?)
- Action: fix spec to scope selector OR fix UI to disambiguate. Likely UI: data-testid needed.

### BUG-3: Pin/unpin DB shape wrong
- Tests: journey-3 pin + unpin
- Error: after pin click, `pinned_by` and `pinned_at` undefined
- Hypothesis: capability writes incomplete row, OR query reads wrong columns, OR optimistic update masking real write
- Action: trace `pin_announcement` capability to confirm what columns it writes

### BUG-4: Filter timeline + slot quickadd timeouts (3 tests)
- Cascade likely from BUG-1 (no seed data) → no day to interact with → click target never visible.

## Journey doc mapping
- 8 botsson-publishannouncement-capability-*.md docs → all blocked by BUG-1
- announce-kind-tier-link.md → not directly covered by these specs (specs/announcement-kind-tier.spec.ts is separate)
