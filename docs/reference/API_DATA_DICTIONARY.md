---
title: "API Data Dictionary"
id: REF_API_DATA
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on:
  - REF_API_OVERVIEW
tags:
  - api
  - data-dictionary
  - field-semantics
  - sensitivity
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout API Data Dictionary

> Canonical API field semantics, sensitivity classes, and sharing guidance.
> Last updated: 2026-02-28

---

## Usage

Use this dictionary to:

- define consistent field naming and semantics across APIs,
- classify field sensitivity,
- and drive data-sharing governance and policy enforcement.

Sensitivity classes:

- `public_operational`
- `internal_operational`
- `personal_basic`
- `personal_sensitive`
- `security_critical`

---

## Core identity and tenant fields

| Field          | Type   | Description                                               | Sensitivity          | External sharing default |
| -------------- | ------ | --------------------------------------------------------- | -------------------- | ------------------------ |
| `company_id`   | uuid   | Legal company identifier                                  | internal_operational | deny unless scoped       |
| `workspace_id` | uuid   | Operational workspace identifier                          | internal_operational | deny unless scoped       |
| `user_id`      | uuid   | Authenticated identity id                                 | personal_sensitive   | deny                     |
| `profile_id`   | uuid   | Workspace-specific profile id                             | personal_basic       | deny unless scoped       |
| `email`        | string | User/invite email                                         | personal_sensitive   | deny                     |
| `first_name`   | string | Given name                                                | personal_basic       | deny unless scoped       |
| `last_name`    | string | Family name                                               | personal_basic       | deny unless scoped       |
| `role`         | enum   | Role in context (`employee`, `manager`, `admin`, `owner`) | internal_operational | allow if needed          |
| `status`       | enum   | Status in context (`pending`, `active`, etc.)             | internal_operational | allow if needed          |

---

## Audit and lifecycle fields

| Field          | Type     | Description                       | Sensitivity          | External sharing default |
| -------------- | -------- | --------------------------------- | -------------------- | ------------------------ |
| `created_at`   | datetime | Record creation timestamp         | internal_operational | allow                    |
| `updated_at`   | datetime | Last update timestamp             | internal_operational | allow                    |
| `published_at` | datetime | Published version timestamp       | internal_operational | allow                    |
| `created_by`   | uuid     | Creator identity reference        | personal_sensitive   | deny                     |
| `updated_by`   | uuid     | Last editor identity reference    | personal_sensitive   | deny                     |
| `published_by` | uuid     | Publisher identity reference      | personal_sensitive   | deny                     |
| `version`      | number   | Version number of a record/config | internal_operational | allow                    |

---

## Content/config fields

| Field            | Type   | Description                             | Sensitivity          | External sharing default       |
| ---------------- | ------ | --------------------------------------- | -------------------- | ------------------------------ |
| `slug`           | string | URL-safe key for content/config objects | public_operational   | allow                          |
| `name`           | string | Human-readable display name             | public_operational   | allow                          |
| `locale`         | string | Locale code                             | public_operational   | allow                          |
| `config_json`    | object | Draft config payload                    | internal_operational | deny unless explicitly allowed |
| `published_json` | object | Published config payload                | public_operational   | allow if content is public     |

---

## Telemetry and event fields

| Field        | Type     | Description            | Sensitivity          | External sharing default |
| ------------ | -------- | ---------------------- | -------------------- | ------------------------ |
| `event`      | string   | Telemetry event name   | internal_operational | allow aggregated only    |
| `actor_id`   | uuid     | Event actor identity   | personal_sensitive   | deny                     |
| `properties` | object   | Event metadata payload | internal_operational | filter by policy         |
| `timestamp`  | datetime | Event occurrence time  | internal_operational | allow                    |

---

## Onboarding intelligence fields

| Field                 | Type        | Description                 | Sensitivity          | External sharing default      |
| --------------------- | ----------- | --------------------------- | -------------------- | ----------------------------- |
| `sessionId`           | uuid/string | Onboarding session id       | internal_operational | deny unless scoped            |
| `userMessage`         | string      | User chat message           | personal_sensitive   | deny                          |
| `conversationHistory` | array       | Ordered message history     | personal_sensitive   | deny                          |
| `extractIntelligence` | boolean     | Toggle for extraction mode  | internal_operational | n/a                           |
| `scrapedData`         | object      | Website-extracted structure | internal_operational | filter by policy              |
| `webSearchData`       | object      | Search enrichment data      | internal_operational | filter by policy              |
| `ai_analysis`         | object      | Suggested workspace model   | internal_operational | allow summary only by default |

---

## Contract and signature fields

| Field                  | Type       | Description                   | Sensitivity          | External sharing default   |
| ---------------------- | ---------- | ----------------------------- | -------------------- | -------------------------- |
| `event_type`           | string     | Webhook event type            | internal_operational | allow                      |
| `submission_id`        | number     | DocuSeal submission id        | internal_operational | deny unless contract scope |
| `document_url`         | string/url | Signed doc reference URL      | personal_sensitive   | deny by default            |
| `signatories`          | array      | Signer details and timestamps | personal_sensitive   | deny                       |
| `x-docuseal-signature` | string     | Shared secret header          | security_critical    | never share                |

---

## Health and watchdog fields

| Field        | Type         | Description             | Sensitivity          | External sharing default            |
| ------------ | ------------ | ----------------------- | -------------------- | ----------------------------------- |
| `status`     | enum/string  | Health/integrity status | public_operational   | allow                               |
| `checks`     | object/array | Detailed check results  | internal_operational | allow internally, filter externally |
| `latency_ms` | number       | Request/check latency   | internal_operational | allow                               |
| `error`      | string       | Failure reason detail   | internal_operational | redact for public                   |

---

## Integration governance target fields

| Field            | Type   | Description                         | Sensitivity          | External sharing default |
| ---------------- | ------ | ----------------------------------- | -------------------- | ------------------------ |
| `integration_id` | uuid   | Integration client identifier       | internal_operational | deny unless admin scope  |
| `client_id`      | string | Public client identifier            | internal_operational | allow admin scope only   |
| `client_secret`  | string | Secret credential                   | security_critical    | never share              |
| `api_key`        | string | Provider secret key                 | security_critical    | never share              |
| `scope`          | string | Permission token scope              | internal_operational | allow admin scope        |
| `policy_id`      | uuid   | Data sharing policy id              | internal_operational | allow admin scope        |
| `approval_state` | enum   | Workflow state for high-risk access | internal_operational | allow admin scope        |

---

## Shared naming standards

- IDs: use suffix `_id` for relational ids.
- Timestamps: `*_at` in ISO datetime format.
- Status fields: explicit enums, avoid free-form strings.
- Booleans: prefix `is_` where semantically clear.
- JSON objects: use named fields instead of opaque blobs wherever possible.

---

## Governance mapping notes

- Any field in `security_critical` must be blocked at serialization boundary.
- `personal_sensitive` requires explicit scope + policy allow + audit event.
- Public API responses should prefer aggregated metrics over row-level personal data.
- Data dictionary updates are mandatory when adding/changing endpoint fields.
