---
schema_version: "2.0.0"
journey_id: "draft-contract"
status: idea
created: 2026-04-29
author: pontus
---

# Draft Employment Contract from Structured Employment Data

**Actor:** admin
**Goal (one sentence):** generate a compliant Norwegian employment contract text from structured employment data
**Trigger:** admin clicks "Generate contract draft" inside the new-employment flow (or invokes `/draft-contract <employment_id>` via Botsson)
**Module (guess):** contract-components (primary surface) + agent-sdk (Lovsen `contract-drafter` Tier 2 skill)

## One-paragraph context

Today admins build employment contracts manually — copy-paste from a template, hand-fill workspace name, employee identity, lønn, prøvetid, oppsigelsesfrister, tariff-binding, and 12+ other fields. Errors creep in: missing §14-6 letters, wrong notice-period defaults, holiday_allowance_pct outside the 10.20–20.00 band, tariff-version forveksling. This journey lets the admin enter structured employment data once (employee identity, role, lønn, scheme, framework binding), and Lovsen's `contract-drafter` skill produces the full Norwegian contract text — with paragraph references, current Riksavtalen version, OTP-pliktig pension, and §14-6 a–p coverage baked in. The output is a draft that the `validate-contract` journey can immediately gate. Drafting and compliance collapse into one motion.
