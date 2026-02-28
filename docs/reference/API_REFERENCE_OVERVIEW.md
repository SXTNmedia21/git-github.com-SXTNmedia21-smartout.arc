# Smartout API Reference Overview

> Central entry page for Smartout API documentation.
> Last updated: 2026-02-28

---

## Documentation index

- `API_ENDPOINT_REFERENCE.md`
- `API_DATA_DICTIONARY.md`
- `API_VERSIONING_AND_LIFECYCLE.md`
- `API_INVENTORY_AND_COVERAGE.md`
- `API_VISIBILITY_AND_RELEASE_PROFILES.md`
- `openapi.smartout.v1.yaml` (canonical source)

---

## Base URLs

Current hosts:

- Web route handlers: `https://app.smartout.ai/api/*`
- Landing route handlers: `https://smartout.ai/api/*`
- Edge functions: `https://{projectRef}.supabase.co/functions/v1/*`
- Internal service (scrapling): private/internal network deployment

---

## Authentication model

Smartout currently uses multiple auth patterns depending on endpoint type:

- Supabase session auth (cookie/session-bound routes)
- Bearer auth for edge functions and machine-to-machine calls
- Shared-secret webhook validation for inbound providers
- Public read-only endpoints for selected content/health paths

Target model for external API platform:

- OAuth 2.1 + OIDC for customer/partner integrations
- service accounts with explicit scopes
- per-tenant credentials and governance policies

---

## Rate limiting

Current:

- selective route-level rate limits (e.g. telemetry intake).

Target:

- profile-based quotas by client/integration plan
- endpoint-level limit classes (read-heavy vs write-heavy vs webhook)
- standardized `429` behavior and retry guidance

---

## Error format

Standard JSON error envelope:

```json
{
  "error": "Human-readable message",
  "details": "Optional technical context"
}
```

---

## Visibility and go-live control

Use release profiles to hide/show endpoints safely:

- internal: everything
- partner: partner + public
- public: public only
- go-live: public subset explicitly enabled

See `API_VISIBILITY_AND_RELEASE_PROFILES.md` for commands and workflow.
