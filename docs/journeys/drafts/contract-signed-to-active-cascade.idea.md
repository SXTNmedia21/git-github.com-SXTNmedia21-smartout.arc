---
schema_version: "2.0.0"
journey_id: "contract-signed-to-active-cascade"
status: done
created: 2026-05-20
updated: 2026-06-21
author: pontus
---

# Contract Signed → Employee Active (Cascade Activation)

**Actor:** system (cascade engine)
**Goal (one sentence):** the cascade engine transitions an employee's profile from trainee to active once a fully-signed employment contract emits `contract.signed`.
**Trigger:** `contract.signed` engine_event (final signature — both employer and employee signed via DocuSeal; emitted by `apps/web/src/app/api/webhooks/docuseal/route.ts` per WH-01 fix).
**Module (guess):** onboarding (trainee→active is the readiness-completion transition; touches D2 resource + C4 governance).

## One-paragraph context

Today the `contract.signed` engine_event is emitted (WH-01 restored the producer 2026-05-20) and routed via `engine_trigger` to the `integration_sync` process — but the actual D2 profile_status flip (trainee→active) plus C4 authority re-evaluation is documented-deferred Phase 4 (migration `20260520120100_engine_trigger_contract_events.sql` comment: "Phase 4 will wire actual D2 update + C4 authority-flip steps into this process"). The cascade currently syncs billing/integration on signing but does NOT make the employee "active." This journey specs the missing closed loop: signed contract → profile activation → employee is Ready. Without it, a fully-signed employee stays trainee indefinitely, gated out of shift assignment and protocol completion that "active" unlocks.

<!-- Op 1 (Create) stop point. Run /journey-protocol spec contract-signed-to-active-cascade to flesh out steps. -->
<!-- Open spec-phase questions to resolve:
  - Does C4 authority-flip require a change_proposal (governance gate) or is contract-signature itself the authorization?
  - Idempotency: re-fired contract.signed (DocuSeal retry) must not double-transition or regress an already-active profile.
  - Failure path: signed contract but profile already inactive/offboarding — does activation apply or no-op?
  - Telemetry: which emit event marks the transition (profile.activated)? Does it exist in registry?
-->
