# API KPI and Review Cadence

> Operational KPI model and governance review cycle for Smartout APIs.
> Last updated: 2026-02-28

---

## Purpose

Define how Smartout tracks API maturity, quality, security, and governance over time.

This document turns the API roadmap into a measurable operating system.

---

## Core KPI set

### Documentation KPIs

| KPI                        | Formula                                                        | Target |
| -------------------------- | -------------------------------------------------------------- | ------ |
| Documentation completeness | documented implemented endpoints / total implemented endpoints | >= 95% |
| Inventory freshness        | endpoints reviewed in last 30 days / total endpoints           | >= 95% |
| Contract drift incidents   | count of undocumented behavior changes                         | 0      |

### Governance KPIs

| KPI                         | Formula                                                                | Target        |
| --------------------------- | ---------------------------------------------------------------------- | ------------- |
| Governance coverage         | endpoints with policy + audit mapping / total implemented endpoints    | >= 90%        |
| Sensitive policy compliance | sensitive responses passing policy checks / sensitive responses tested | 100%          |
| Revocation reaction time    | time from revoke action to access blocked                              | <= 60 seconds |

### Security KPIs

| KPI                       | Formula                                                    | Target |
| ------------------------- | ---------------------------------------------------------- | ------ |
| Auth model completeness   | endpoints with explicit auth model / total endpoints       | 100%   |
| Scope model completeness  | scoped endpoints with documented scopes / scoped endpoints | 100%   |
| Secret exposure incidents | count of secret leaks in responses/logs                    | 0      |

### Reliability KPIs

| KPI                              | Formula                                    | Target              |
| -------------------------------- | ------------------------------------------ | ------------------- |
| API availability                 | successful request windows / total windows | >= 99.9% (critical) |
| p95 latency (critical endpoints) | measured p95                               | domain-specific SLO |
| 5xx error rate                   | 5xx responses / total responses            | <= 0.5%             |

### Lifecycle KPIs

| KPI                        | Formula                                          | Target               |
| -------------------------- | ------------------------------------------------ | -------------------- |
| Deprecated past sunset     | count of deprecated endpoints past sunset date   | 0                    |
| Migration completion       | migrated clients / clients on deprecated version | >= 95% before sunset |
| Breaking change exceptions | count of unplanned breaking releases             | 0                    |

---

## KPI ownership

| KPI area                    | Owner                   | Review audience                |
| --------------------------- | ----------------------- | ------------------------------ |
| Documentation and inventory | API domain owners       | Engineering                    |
| Governance and data sharing | Security + Product      | Governance board               |
| Reliability and latency     | Platform engineering    | Engineering + leadership       |
| Lifecycle and deprecation   | API architecture review | Engineering + customer success |

---

## Review cadence

### Weekly (engineering API review)

Agenda:

- endpoint changes merged this week,
- undocumented change detection,
- incidents and near-misses,
- top blockers for roadmap phases.

Outputs:

- updated inventory statuses,
- action list with owners and due dates.

### Monthly (API Architecture Review)

Agenda:

- standards compliance trend,
- versioning/deprecation decisions,
- cross-domain consistency issues,
- roadmap reprioritization.

Outputs:

- accepted architecture decisions,
- updated roadmap phase priorities.

### Monthly (Governance Review)

Agenda:

- sensitive data sharing exceptions,
- approval and audit anomalies,
- revoke/rotate events and response times,
- policy gap remediation.

Outputs:

- governance exception log,
- remediation commitments.

### Quarterly (Strategy review)

Agenda:

- connector priority by market demand,
- API product opportunity assessment,
- partner feedback and integration friction.

Outputs:

- updated connector tiering,
- quarterly API investment plan.

---

## KPI reporting template

For each month:

- metric name
- target
- current value
- trend (up/down/flat)
- reason for variance
- owner
- remediation action

---

## Escalation thresholds

- Documentation completeness < 90% for two consecutive months.
- Any secret exposure incident.
- Revocation reaction time > 5 minutes.
- Deprecated endpoints past sunset > 0 for more than one cycle.
- 5xx error rate above threshold for critical endpoints.

If any threshold is breached:

- open a remediation epic,
- assign executive owner,
- track weekly until resolved.
