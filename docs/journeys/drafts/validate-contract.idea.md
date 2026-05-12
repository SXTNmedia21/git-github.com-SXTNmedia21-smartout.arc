---
schema_version: "2.0.0"
journey_id: "validate-contract"
status: idea
created: 2026-04-29
author: pontus
---

# Validate Employment Contract Against Aml. §14-6

**Actor:** admin
**Goal (one sentence):** verify a draft employment contract satisfies Aml. §14-6 before sending it to the employee for signature
**Trigger:** contract status transitions `draft → pending_signature` (mandatory gate)
**Module (guess):** contract-components (primary surface) + agent-sdk (Lovsen capability invocation)

## One-paragraph context

Norwegian employment law (Aml. §14-6, post juli 2024-revisjon, EU-direktiv 2019/1152) requires every employment contract to cover 16 mandatory points (bokstav a–p). Today admins draft contracts in Smartout without explicit verification of statutory completeness — gaps surface only when Mattilsynet/Skatteetaten audits or when the employee disputes terms. This journey gates the draft→pending_signature transition with a Lovsen-driven §14-6 validation: every required field is checked, paragraph-cited issues are surfaced (error=blocks, warning=advisory), and the admin gets either a green light or an actionable remediation list before any signature request leaves the system. Compliance becomes a byproduct of drafting, not a quarterly audit chore.
