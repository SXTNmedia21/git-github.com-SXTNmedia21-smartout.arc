# API Release Gates and Compliance

> Mandatory release gates and compliance checks for Smartout API changes.
> Last updated: 2026-02-28

---

## Policy

No API endpoint or contract change is production-ready unless all applicable gates pass.

Applies to:

- Next.js API routes,
- Supabase Edge Functions,
- internal service APIs,
- public/partner/event APIs.

---

## Gate 1: Contract integrity

Required checks:

- Request/response schema defined or updated.
- Error contract documented.
- Backward compatibility reviewed.
- Endpoint reference entry updated.

Evidence:

- schema artifact or route-level schema definition.
- contract review note in PR.

---

## Gate 2: Security and auth

Required checks:

- auth model explicit (`public`, `session`, `service`, `oauth`, `webhook-signature`).
- authorization checks implemented (role/workspace/scope).
- rate limiting evaluated for externally reachable endpoints.
- secret handling validated (no secret in responses/logs).

Evidence:

- auth/authorization test cases.
- security checklist completion in PR.

---

## Gate 3: Governance and data policy

Required checks:

- fields mapped in `API_DATA_DICTIONARY`.
- sensitive fields have deny/allow policy behavior defined.
- audit events added for privileged actions.
- revocation behavior documented where credentials are involved.

Evidence:

- dictionary update.
- policy/audit notes and test evidence.

---

## Gate 4: Reliability and operability

Required checks:

- health/monitoring behavior defined for the API surface.
- timeout/retry strategy documented for upstream calls.
- failure modes produce deterministic error responses.
- on-call ownership for incident response assigned.

Evidence:

- metrics/alert notes.
- operational runbook link.

---

## Gate 5: Testing and verification

Required checks:

- happy-path tests.
- auth failure tests.
- validation/error-path tests.
- regression checks for adjacent endpoints.

Evidence:

- CI test results.
- manual verification notes where automation is not yet available.

---

## Gate 6: Lifecycle readiness

Required checks:

- lifecycle state assigned (`draft`, `beta`, `stable`, `deprecated`, `sunset`).
- versioning impact assessed.
- migration notes written for breaking or semantically significant changes.

Evidence:

- `API_VERSIONING_AND_LIFECYCLE.md` alignment.

---

## Compliance matrix

| API type                    | Minimum required gates |
| --------------------------- | ---------------------- |
| Internal route/edge changes | 1, 2, 4, 5             |
| External-facing data APIs   | 1, 2, 3, 4, 5, 6       |
| Auth/key/scope APIs         | 1, 2, 3, 4, 5, 6       |
| Webhooks and event APIs     | 1, 2, 3, 4, 5, 6       |

---

## Release decision rule

- **Pass:** all required gates satisfied with evidence.
- **Conditional pass:** only if risk accepted by architecture + security owners.
- **Fail:** any required gate missing evidence.

---

## Recommended PR checklist snippet

- [ ] Endpoint reference updated
- [ ] Data dictionary updated (if fields changed)
- [ ] Auth/scope checks verified
- [ ] Sensitive data policy verified
- [ ] Audit events added where required
- [ ] Tests added/updated and passing
- [ ] Versioning/deprecation impact assessed
