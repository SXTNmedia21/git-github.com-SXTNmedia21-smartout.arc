---
title: DB-RLS Audit — Smoke (2026-05-25)
status: done
created: 2026-05-25
updated: 2026-05-25
module: security
tags: [rls, security, migrations, audit, adr-0008, adr-0301]
---

# DB-RLS Audit — Smoke (2026-05-25)

## Coverage

- Tables scanned: 89 (all tables identified via CREATE TABLE across all migrations)
- Policies scanned: ~200+ (via grep across migration corpus)
- Migrations scanned: 50 most recent (20260620140700 → 20260715100000) + targeted older migrations for schema tables

## CRITICAL findings

None.

## HIGH findings

**H1** — `supabase/migrations/20260621200000_fn_generate_company_invoice.sql:36` — ADR-0301 / L-0172  
`fn_generate_company_invoice` is declared `SECURITY DEFINER` but `SET search_path` appears only as a
session-level statement (`SET search_path TO public, extensions;` on line 1), NOT inline in the function
definition. PostgreSQL `SECURITY DEFINER` functions execute with the caller's `search_path` unless the
function itself carries a `SET search_path` clause — a session-level SET is not inherited by the function body.
An attacker controlling `search_path` could shadow `public.invoice`, `public.invoice_line_item`, etc. with
malicious objects. Fix: add `SET search_path = public, extensions` between `SECURITY DEFINER` and `AS $$`.

**H2** — `supabase/migrations/20260621200002_fn_check_billing_run.sql:26` — ADR-0301 / L-0172  
Same pattern as H1: `fn_check_billing_run` is `SECURITY DEFINER` with `SET search_path` only at session
scope (line 1). The function body reads `billing_activity_log`, `invoice`, and multiple platform-scoped tables.
Missing inline `SET search_path = public, extensions`. Fix: same as H1.

## MEDIUM findings

**M1** — `supabase/migrations/20260624000000_create_consent_acceptance.sql:44` — ADR-0008 / ADR-0301  
`consent_acceptance` table comment says "INSERT: service-role only (Server Action / SECURITY DEFINER RPC)"
but there is no explicit `service_role` INSERT policy (and no service_role FOR ALL policy). Supabase
bypasses RLS for service_role by default so this is not a functional gap today, but it violates the
explicit-policy-documents-the-write-path convention established by `payroll.consent_document` and similar
tables. No INSERT path is locked out, but the intent is undocumented in the policy layer.  
Risk: a future migration adding a `FOR ALL TO authenticated` policy could open direct employee INSERT.  
Fix: add `CREATE POLICY "service_role_all_consent" ON public.consent_acceptance FOR ALL TO service_role USING (true);`

**M2** — `supabase/migrations/20260715200000_setup_documents_godmode_bypass.sql` — REFERENCED BUT MISSING  
The audit task references this migration by name (godmode bypass for setup-documents bucket) but the file
does not exist in the migration corpus. The existing `20260415200000_setup_documents_storage_policy.sql`
has workspace-scoped SELECT/INSERT/DELETE policies for `authenticated` but NO godmode bypass. If platform
admins need to access setup-documents objects across workspaces, this is a gap. Current policies route
all access through `company_member → workspace` join — a godmode user without a `company_member` row
cannot read any setup-documents path.  
Severity: MEDIUM (affects operator tooling / platform-admin support flows, not end-user security).

**M3** — `supabase/migrations/20260623100000_botsson_imports_storage_bucket.sql` — ADR-0008 (defence-in-depth)  
`botsson-imports` bucket has SELECT, INSERT (admin-only), DELETE (admin-only) policies but no UPDATE policy.
Storage objects in Supabase are immutable by convention (replace = delete + insert), so an UPDATE policy
is rarely needed. However, other buckets that follow the same pattern (e.g. `setup-documents`,
`routine-source`) either have explicit FOR ALL or explicit SELECT+INSERT+DELETE. The asymmetry means
UPDATE on `botsson-imports` objects falls through to RLS deny-by-default, which is the correct behavior —
but it is undocumented and different from peer buckets.  
Fix: add a comment to the migration explicitly noting UPDATE is intentionally blocked (immutable uploads).

## LOW findings

**L1** — `supabase/migrations/20260623100500_routine_source_storage_bucket.sql:8` — Defence-in-depth  
`routine_source_member_rw` uses `FOR ALL TO authenticated` — meaning any workspace member (including
employees) can read, write, and delete any routine-source image in their workspace, regardless of whether
they authored it. Contrast with `botsson-imports` which restricts INSERT+DELETE to admins only.
Routine-source images are authoritative provenance artifacts (linked via `source_reference` per
`20260624130000_routine_brownfield_governance.sql`). Allowing employees to delete images they did not
upload could corrupt routine provenance chains.  
Recommendation: split into member-read + admin-write, matching botsson-imports pattern.

**L2** — `supabase/migrations/20260624000100_create_employee_onboarding_state.sql:52` — ADR-0008 completeness  
`employee_onboarding_state` has JWT SELECT+UPDATE+INSERT (own-profile only) and API key SELECT. No
service_role policy is defined. If the employee-onboarding Server Action runs with service_role (e.g.
for initialising state during workspace bootstrap or admin-triggered re-onboarding), the write will
succeed via RLS bypass — but if it runs with JWT (the normal path), the own-profile INSERT policy
covers it. The ambiguity between which path the Server Action uses is not documented in the migration.  
Recommendation: add a comment or explicit service_role policy to document the intended write path.

**L3** — `supabase/migrations/20260620141000_celebration_publication_table.sql:57` — ADR-0008 completeness  
`celebration_publication` has only manager-read (JWT) and API-key read policies. No INSERT/UPDATE/DELETE
policy exists (intentional — sole write path is SECURITY DEFINER RPC). This is architecturally correct
per ADR-0369. However, unlike `announcement_meta` (which explicitly adds an UPDATE policy for message
senders), there is no UPDATE path at all — a retrospective correction (e.g. re-linking `message_id`
after a cascade delete + re-post) would require service_role. This is acceptable but should be documented.

**L4** — `supabase/migrations/20260625120000_workspace_bootstrap_gate.sql:88-96` — ADR-0008 completeness  
`workspace_bootstrap_gate` has JWT read (workspace members) and API-key read. All writes go through
SECURITY DEFINER RPCs (`fn_close_bootstrap_gate`, `fn_skip_bootstrap_gate`, `fn_list_open_bootstrap_gates`)
which apply `is_admin_in_workspace` guards internally. The functions correctly use inline
`SET search_path = public, pg_temp`. The pattern is sound. LOW: no service_role explicit policy — if
the engine-dispatch or a cron job ever needs to write directly, RLS bypass is relied upon silently.

## Tables missing RLS

None found among user-facing tables. The following three platform-admin tables intentionally omit RLS
(documented in `00013_platform_admin_tables.sql` line 13: "No RLS — only accessible via service role in
platform-admin routes"):

- `public.platform_audit_log` — service_role only (intentional per ADR-0008 §platform-admin exception)
- `public.platform_impersonation_log` — service_role only (intentional)
- `public.platform_metrics_daily` — service_role only (intentional)

These are consistent with ADR-0008 which exempts platform-admin tables from the workspace-scoped RLS
requirement. No action required unless a future migration exposes these to JWT callers.

## Tables missing godmode-bypass (where it should exist)

The canonical godmode bypass pattern (`OR EXISTS (SELECT 1 FROM user_identity WHERE user_id=auth.uid() AND is_godmode=true)`) is present on:
- `landing_variant`, `landing_block`, `landing_media` — `20260301600001_landing_page_builder.sql`
- `journey`, `journey_step`, `journey_event`, `journey_test_run` — `20260301140000_journey_system.sql`

**Potential gap:** `setup-documents` storage bucket (`20260415200000_setup_documents_storage_policy.sql`)  
All three policies (SELECT, INSERT, DELETE) use `company_member → workspace` join only. A godmode operator
without a `company_member` row (pure platform-admin account) cannot access any setup-document. If the
referenced-but-missing migration `20260715200000_setup_documents_godmode_bypass.sql` was meant to fix this,
it was either never created or committed to a different branch. **Action required:** confirm whether
godmode access to setup-documents is needed for support workflows. If yes, create the migration.

## Summary table

| File | Line | Severity | ADR | Issue |
|------|------|----------|-----|-------|
| 20260621200000_fn_generate_company_invoice.sql | 36 | HIGH | ADR-0301 | SECURITY DEFINER missing inline SET search_path |
| 20260621200002_fn_check_billing_run.sql | 26 | HIGH | ADR-0301 | SECURITY DEFINER missing inline SET search_path |
| 20260624000000_create_consent_acceptance.sql | 44 | MEDIUM | ADR-0008 | No explicit service_role INSERT policy (intent undocumented in policy layer) |
| 20260715200000_setup_documents_godmode_bypass.sql | — | MEDIUM | ADR-0008 | Migration referenced by audit spec does not exist |
| 20260623100000_botsson_imports_storage_bucket.sql | — | MEDIUM | ADR-0008 | No UPDATE policy (immutable intent undocumented) |
| 20260623100500_routine_source_storage_bucket.sql | 8 | LOW | ADR-0008 | FOR ALL grants employee DELETE on provenance images |
| 20260624000100_create_employee_onboarding_state.sql | 52 | LOW | ADR-0008 | Service_role write path undocumented |
| 20260620141000_celebration_publication_table.sql | 57 | LOW | ADR-0008 | No UPDATE path documented for retrospective message_id correction |
| 20260625120000_workspace_bootstrap_gate.sql | 88 | LOW | ADR-0008 | No service_role explicit policy (relies on RLS bypass silently) |

## Confidence: 78/100

**Rationale:** Static analysis of migration SQL only — no live DB query, no schema diffing against a running
instance. Key limitations:

1. Cannot verify that `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was not subsequently reverted by an
   unlisted or hotfix migration outside the standard migrations directory.
2. Cannot verify that `SET search_path` at session scope in H1/H2 provides adequate protection for the
   specific Supabase Postgres version in use (some PG versions do inherit session-level SET in SECURITY
   DEFINER, but this is not guaranteed and not the documented safe pattern).
3. The `payroll.*` table GRANT coverage relies on `ALTER DEFAULT PRIVILEGES` at schema creation time
   (`20260422110700_payroll_schema.sql`) — not verified against current table list to confirm no tables
   were created before the default privileges grant was in effect.
4. `20260715200000_setup_documents_godmode_bypass.sql` referenced in audit spec but absent — confidence
   impact: this file may exist in a staged but unmerged branch, or may be a spec that was never implemented.
