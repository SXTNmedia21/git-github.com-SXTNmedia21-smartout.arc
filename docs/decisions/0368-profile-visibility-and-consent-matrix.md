---
title: "Profile Visibility and Consent Matrix (Cross-Workspace PII Governance)"
id: ADR_0368
status: proposed
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0368: Profile Visibility and Consent Matrix (Cross-Workspace PII Governance)

## Context and Problem Statement

Smartout collects personal data at two layers: `user_identity` (cross-workspace identity facts — date of birth, full name, national ID, address, phone, personal email) and `profile` (workspace-scoped employment context — pronouns, preferred name, languages, emergency contact, bio). The same `user_identity` can hold multiple `profile` rows across workspaces (Strøm Mat & Bar + Yogurt Heaven, etc.), and each workspace has a different social contract: a tight-knit restaurant where everyone celebrates birthdays vs. a workspace where the same person works as an anonymous substitute and wants minimal exposure.

Today the codebase has no first-class representation of who is allowed to see which field in which workspace. Visibility is implicit: any policy that lets a viewer read `profile` also leaks every column on it, and any join to `user_identity` exposes every column there. As we add social surfaces (birthday notifications, team feeds, profile cards), legally-bound surfaces (A-melding, employment contract export), and AI surfaces (Botsson tools that resolve "send a message to Per" or "who has language X"), the absence of a consent layer becomes a privacy bug and a GDPR exposure.

A boolean per field per surface (`share_birthday_with_team`, `share_phone_with_team`, `share_pronouns_with_workspace`, …) will not scale: every new field forces a migration, every new audience forces another column, and there is no audit of what consent was given when by whom. We need a structured visibility model that lives on `profile` (workspace-scoped), composes with C4 authority, and gives surfaces a single contract to filter by.

## Decision Drivers

- One `user_identity` can have N `profile` rows in N workspaces. Consent must be per-workspace, not per-identity.
- Boolean-per-field on `profile` is a known anti-pattern (already 30+ columns; adding 10 visibility booleans per new field is non-starter).
- AI agents (Mr. Botsson, voice) resolve PII via `read_surface` (engine_world) and capability tools. Surfaces MUST filter by visibility before returning to the LLM; otherwise an authorized caller leaks data they were not consented to see.
- Compliance fields (national ID, address, full name) are mandatory under Norwegian payroll law (A-melding) and cannot be opt-out. Operational fields (phone, emergency contact) have role-bound defaults. Social fields (birthday, pronouns, bio) require explicit opt-in.
- GDPR Articles 13 (information), 15 (right to know), 16 (rectification), 17 (erasure), 5(1)(c) (data minimization) all map onto a visibility model — without one, each surface owns its own ad-hoc filtering and audit fails.
- Cross-workspace bleed: a profile that opts in to share birthday in WS A must not have that consent silently apply to WS B.
- Existing `activity_trail` audit already exists; visibility decisions and reads MUST emit so the system can answer "who saw what when".

## Considered Options

1. **Option A — Field-level booleans on `profile`.** Add `share_<field>_with_<audience>` columns as needed. Rejected: schema bloat, no audit of consent changes, no way to express "manager-only" vs "team-visible" without combinatorial column explosion, breaks at the second new field.

2. **Option B — JSONB `visibility_settings` blob on `profile`.** One column, free-form. Rejected: no constraints, no RLS-friendly shape, surface code becomes a JSON parser, schema drift, no enum safety on field names or audience values.

3. **Option C — Structured `profile_visibility` matrix table (profile_id, workspace_id, field, audience, source).** New table with enums for audience and consent source. Defaults seeded per field; profile-level rows override only where consent diverges from default. Surfaces query through a single SQL helper / capability layer that takes (caller, target, field) → audience-decision. Selected: composable, auditable, enum-safe, schema-stable as fields are added.

## Decision Outcome

Chosen option: **Option C — Structured `profile_visibility` matrix table with field catalog, audience enum, and consent-source enum.** Selected because it scales linearly with new fields (insert a row in the field catalog, not a column on the table), composes onto existing RLS and C4 authority gates, and gives `activity_trail` a single event class to audit consent changes against reads.

### Schema

```sql
-- Field catalog: every PII field that has a visibility policy
CREATE TYPE pii_field AS ENUM (
  -- user_identity layer
  'date_of_birth', 'full_name', 'phone', 'personal_email',
  'national_id', 'address', 'avatar_url',
  -- profile layer
  'pronouns', 'preferred_name', 'languages_spoken',
  'emergency_contact', 'bio', 'start_date'
);

CREATE TYPE visibility_audience AS ENUM (
  'self',         -- only the profile owner
  'manager',      -- team leader + workspace managers/admins/owners
  'team',         -- members of the same team
  'workspace',    -- all profiles in workspace
  'company',      -- all profiles in any workspace owned by same company
  'hidden'        -- explicit opt-out (compliance fields cannot use this)
);

CREATE TYPE consent_source AS ENUM (
  'contract',     -- covered by employment contract (compliance, no opt-out)
  'default',      -- workspace default policy
  'opt_in',       -- profile explicitly granted broader visibility
  'opt_out'       -- profile explicitly narrowed visibility (where allowed)
);

CREATE TABLE profile_visibility (
  profile_id    uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  field         pii_field NOT NULL,
  audience      visibility_audience NOT NULL,
  source        consent_source NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  granted_by    uuid REFERENCES profile(id),
  expires_at    timestamptz,
  PRIMARY KEY (profile_id, workspace_id, field)
);
```

### Default-policy seed

A workspace-level default table (`workspace_visibility_default`) holds the baseline audience per field. `profile_visibility` rows exist only where a profile diverges. Resolution at read-time:

```
visibility(profile, workspace, field) =
  profile_visibility row IF present
  ELSE workspace_visibility_default row IF present
  ELSE platform default (hardcoded in pii_field catalog metadata)
```

### Compliance floor

Fields with `source = 'contract'` cannot be set to `audience = 'hidden'`. Enforced via CHECK constraint plus trigger that rejects updates moving a contract-source field to hidden. National ID, address, and full name are seeded as contract-source with audience `manager` (admin-only via role check in the helper, see below).

### Read contract — capability + RLS layer

Surfaces never read PII columns directly. A SECURITY DEFINER function `fn_resolve_visible_fields(caller_profile_id, target_profile_id, fields[])` returns a JSON object of `{ field: value | null }` where null means "filtered". The function:

1. Looks up `visibility(target, workspace, field)`.
2. Resolves caller's relationship to target (self / manager / team-member / workspace / company).
3. Returns the value if caller's relationship ≥ required audience; null otherwise.
4. Emits an `activity_trail` entry `pii_field_read` with `(caller, target, field, allowed, audience_required)`.

`engine_world` `read_surface` for profile data calls this helper. Capability tools that resolve "send message to Per" or "who speaks Polish" call this helper. RLS on raw `user_identity` / `profile` columns remains strict (self + service role); the helper is the only sanctioned read path for cross-profile PII.

### Voice + chat agents

Mr. Botsson (chat + voice) sees only the helper output. Tools that touch PII (`get_employee_phone`, `find_employees_by_language`) are registered as `pii_read` class tools — their results are post-filtered through `fn_resolve_visible_fields` before reaching the LLM context. Two gates: C4 authority ("caller is allowed to ask") + visibility matrix ("caller is allowed to see this field for this target in this workspace").

### Consent change audit

Every insert / update / delete on `profile_visibility` emits `pii_consent_changed` (caller, target_profile, field, old_audience, new_audience, source). Powers GDPR export ("here is every consent decision affecting your data") and admin audit ("who narrowed Per's birthday visibility on 2026-05-18").

### GDPR mapping

- **Art. 13 (information)** — onboarding wizard surfaces the default policy per field at first profile creation; profile self-service surface lets the user view and modify opt-in/opt-out fields.
- **Art. 15 (right to know)** — `fn_export_visibility_for_subject(profile_id)` returns the full matrix plus audit trail.
- **Art. 16 (rectification)** — profile self-edit endpoint, scoped to opt-in/opt-out fields only.
- **Art. 17 (erasure)** — on profile offboarding, all `opt_in` rows are revoked automatically; `contract` rows are retained until employment record retention expires (separate ADR for retention windows).
- **Art. 5(1)(c) (data minimization)** — `pii_field_read` audit lets us answer "which surfaces actually read which fields", informing future field deprecation.

### Cross-workspace isolation

Consent rows are scoped on `(profile_id, workspace_id, field)`. A user with profiles in WS A and WS B has two independent rows per field. RLS on `profile_visibility` restricts writes to the workspace owner (self) and workspace admin (via role check). No background process copies consent across workspaces.

### Birthday surface (anchoring example)

Pulling threads from the prior conversation: the birthday surface (calendar entry, team notification, manager nudge) sources `date_of_birth` from `user_identity` via `fn_resolve_visible_fields(viewer, target, ['date_of_birth'])`. If audience is `self`, surface returns no entry. If audience is `team` and viewer is in target's team, surface returns day-and-month; if `share_birthday_year` (separately gated as a derived field) is granted, surface includes age. Compliance reads (D3 framework triggers for minor work restrictions) go through a separate `fn_resolve_compliance_field` path that ignores audience because the law overrides consent — but those reads are still audited.

## Rules and Consequences

- **Good, because** new PII fields require one enum addition + one default row, never a column-per-audience matrix.
- **Good, because** every PII read becomes auditable, satisfying GDPR Art. 5(2) accountability.
- **Good, because** AI agents inherit privacy filtering automatically by routing through the helper; capability tools do not invent their own filter logic.
- **Good, because** cross-workspace bleed is structurally impossible — the primary key includes `workspace_id`.
- **Good, because** the C4 authority gate (can ask) and the visibility matrix (can see) are orthogonal, matching the model that authority and consent are independent concerns.
- **Bad, because** every PII read now carries an `activity_trail` write — measurable cost on hot surfaces (team feed, voice agent). Mitigation: batch-resolve at surface load, not per-render; aggregate audit rows in 1-minute buckets where the same (caller, target, field) tuple repeats.
- **Bad, because** the helper function becomes a critical-path performance and security boundary — bugs leak PII silently. Mitigation: dedicated test suite covering self / manager / team / workspace / company / hidden audiences and contract-floor enforcement; CI gate that grep-fails any direct cross-profile read of catalog fields outside the helper.
- **Bad, because** consent UX (profile self-service, onboarding consent screen) is now a new surface to design and ship. Mitigation: ship in two waves — Wave 1 schema + helper + default seed + agent integration + birthday surface; Wave 2 self-service UI.
- **Agent Impact:**
  - Capability tools that read PII MUST route through `fn_resolve_visible_fields`. Direct reads of `user_identity` or `profile` PII columns outside this helper are CI-blocked.
  - `read_surface` in engine_world MUST attach a viewer identity to every PII surface request; surfaces that cannot identify viewer return only self-data.
  - All new fields proposed for the catalog require an ADR amendment (default audience + consent source).
  - Telemetry registry adds `pii_field_read` and `pii_consent_changed` events with `emit()` call-sites in the helper and in the consent-write capability tool (per L-0176, L-0177, ADR-0358).
  - Birthday-specific surfaces (calendar derivation, engine_process notification, mobile card) consume only helper output; they do not store derived PII.

### Out of scope (deferred to separate ADRs)

- Encryption-at-rest for national ID and address columns (separate security ADR; pgsodium pathway already noted in bubble-migration learning).
- Retention windows per consent source (Art. 5(1)(e)) — needs interaction with payroll archive retention.
- Cross-company consent (parent organisation reads child workspace profile) — `company` audience exists in the enum but resolution rules are out of scope for V1.
- Asymmetric reveal (target sees who viewed their PII) — possible later, audit trail supports it.

### Migration plan (Wave 1)

1. Migration A: `pii_field`, `visibility_audience`, `consent_source` enums + `profile_visibility` + `workspace_visibility_default` tables + RLS policies.
2. Migration B: seed `workspace_visibility_default` rows for all existing workspaces using the platform default per field.
3. Migration C: `fn_resolve_visible_fields` + `fn_resolve_compliance_field` + `fn_export_visibility_for_subject` SECURITY DEFINER functions.
4. Telemetry registry: add `pii_field_read` + `pii_consent_changed` events.
5. Capability layer: refactor any tool that currently reads cross-profile PII to route through the helper; CI grep gate enabled.
6. engine_world surface filter: profile-card surface and team-list surface route through helper.
7. Birthday surface (anchoring deliverable): virtual calendar entry + cron-triggered notification engine_process, both consuming helper output.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
