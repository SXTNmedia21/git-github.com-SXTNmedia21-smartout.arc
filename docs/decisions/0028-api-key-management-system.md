---
id: ADR-0028
title: API Key Management System
status: accepted
date: 2026-02-28
---

# ADR-0028: API Key Management System

## Context and Problem Statement

Smartout needs API key management for three use cases: workspace API access (external integrations calling our API), external secret vaulting (storing third-party credentials like Stripe/Twilio keys), and service-to-service authentication (internal microservices). The platform admin portal needs a centralized UI for creating, rotating, revoking, and monitoring all keys.

## Decision Drivers

- Sub-microsecond key validation for Edge Functions handling API requests
- Zero-downtime rotation for integrators using workspace API keys
- Secure storage of external secrets that need plaintext retrieval (e.g., calling Stripe API)
- Audit trail for all key lifecycle events
- Rate limiting per key

## Considered Options

1. **SHA-256 for all keys** — Hash everything, never store plaintext
2. **Vault (pgsodium) for all keys** — Encrypt everything with Vault
3. **Hybrid: SHA-256 for issued keys + Vault for external secrets** — Hash our keys, encrypt theirs

## Decision Outcome

**Option 3: Hybrid approach.** SHA-256 hashing for Tier 1 (workspace) and Tier 3 (service) keys. Supabase Vault for Tier 2 (external secrets).

**Rationale:**

- Issued API keys don't need plaintext retrieval — we only need to verify them. SHA-256 comparison is sub-microsecond vs Vault decryption overhead.
- External secrets (Stripe SK, Twilio token) must be decrypted to make API calls. Vault (pgsodium) provides at-rest encryption.
- This matches the industry pattern: API keys are hashed like passwords; stored credentials are encrypted.

## Key Decisions

### Versioned Dual-Key Rotation

Keys use a 3-version system: `current` → `previous` (48h grace) → `revoked`. During rotation, both current and previous keys are valid simultaneously. This gives integrators a window to update their keys without downtime. The grace period is configurable (default 48h).

**Implementation:** DEFERRABLE INITIALLY DEFERRED unique constraint on `(workspace_id, key_type, environment, version)` enables atomic rotation swaps within a single transaction.

### deno-postgres for Edge Function Auth

Edge Functions use `deno-postgres` Pool for direct Postgres connections instead of PostgREST. This enables `set_config('app.workspace_id', $1, true)` for transaction-scoped RLS context without JWT. PostgREST doesn't support GUC variables.

### Hourly Usage Buckets

API key usage is tracked in hourly buckets via `ON CONFLICT DO UPDATE` upserts. This reduces write volume compared to per-request logging while still providing useful analytics for rate limit tuning and abuse detection.

### Key Format

`smo_{type}_{env}_{random}` where type is `sk` (workspace) or `svc` (service), env is `live` or `test`, and random is 32 bytes base64url-encoded. The prefix is stored separately for display purposes.

## Rules & Consequences

- All API key routes are super-admin only (V1). Workspace self-service is deferred to V2.
- Plaintext keys are returned exactly once at creation/rotation — never stored or logged.
- External secrets metadata is in `platform_external_secret`; encrypted values in `vault.secrets`.
- `validate-api-key` Edge Function has `verify_jwt = false` in config.toml.
- Grace period cleanup runs via `cleanup-api-keys` Edge Function (cron-triggered).
- Tables: `platform_api_key`, `platform_api_key_usage`, `platform_external_secret`.
- Enums: `api_key_version_status`, `api_key_type`.
- Migration: `20260228230000_api_key_management.sql`.
