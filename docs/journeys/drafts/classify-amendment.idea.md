---
schema_version: "2.0.0"
journey_id: "classify-amendment"
status: idea
created: 2026-04-29
author: pontus
---

# Classify Contract or Payroll-Profile Field Change

**Actor:** admin
**Goal (one sentence):** classify a proposed field change on an active contract or payroll-profile so the system knows whether it requires re-signing, can commit silently, or is outright illegal
**Trigger:** admin edits a field on `employment_contract` or `employee_payroll_profile` (handler intercepts before commit)
**Module (guess):** contract-components (primary surface) + agent-sdk (Lovsen `amendment-classifier` Tier 1 skill)

## One-paragraph context

Today field-changes on active contracts commit straight to the database with no compliance gate. Lønn-økning, oppsigelsesfrist-endring, prøvetid-forlengelse, employment_form-konvertering — all silently mutate `employment_contract` rows without ever asking "does this require ansatt-signering iht. Aml. §14-6?" or "is this legal at all (§14-9 saklig grunn for permanent→temporary)?". This journey runs every proposed change through Lovsen's `amendment-classifier`: routes the field through `field_classification_metadata` (ADR-0001) plus conditional rules plus special-case overrides (e.g. lønn-down always MATERIAL, employment_form perm→temp BLOCKED), and returns one of {material, admin, derived, system, blocked, review_required} with paragraph-citation reasoning. MATERIAL triggers an amendment + signature flow; BLOCKED stops the write and proposes alternatives; ADMIN/DERIVED/SYSTEM commit but with audit-trail. Compliance becomes a per-keystroke gate, not an annual audit.
