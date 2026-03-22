---
title: Decision Log
status: done
updated: 2026-03-22
created: 2026-03-20
module: payroll
tags: [decisions]
---

# Decision Log

| #   | Date       | Decision                                                                                                                               | Status   |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-20 | Extract placeholder logic to `@smartout/utils` as pure functions (no DB deps) so both platform-admin and contract-service can use them | Accepted |
| 2   | 2026-03-20 | `contract_attachment` table: platform-admin only, no RLS policies, all access via `service_role`                                       | Accepted |
| 3   | 2026-03-20 | Del 3 (DocuSeal multi-document delivery) deferred to separate branch — higher risk, needs manual DocuSeal testing                      | Accepted |
| 4   | 2026-03-20 | Use dynamic `import()` for `@smartout/utils` in Next.js API route to avoid workspace resolution issues                                 | Accepted |
| 5   | 2026-03-22 | ADR-0056: Cascade Core Foundation Schema — A1/A2/A3 tiers, independent cascade layer, legacy containment, SHA-256 hashing              | Accepted |
| 6   | 2026-03-21 | ADR-0057: Payroll Schema Separation — dedicated `payroll` schema for 23 tables + 16 enums, establishes pattern for future modules      | Accepted |
| 7   | 2026-03-22 | Mobile payroll screens in Meg tab + Home card — no new navigation tab, action-first priority on home screen                            | Accepted |
| 8   | 2026-03-22 | Three-tier trust labels (Foreløpig estimat / Registrert tid / Avregnet i lønn) — every monetary figure tagged with epistemic status    | Accepted |
| 9   | 2026-03-22 | Supplement stacking: kveld+helg additive, helg+helligdag helligdag-wins, cross-midnight splits at 00:00, breaks excluded               | Accepted |
| 10  | 2026-03-22 | Balance-first absence request (Planday pattern) — show remaining balance before form, live projection with holiday/overlap checks      | Accepted |
| 11  | 2026-03-22 | Timebank balance client-side computation — tech debt, move to DB view/RPC before payroll calc engine ships                             | Accepted |
| 12  | 2026-03-22 | Employee absence withdrawal uses "rejected" status — absence_status enum lacks "cancelled", migration deferred                         | Accepted |

status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [decisions]

---

# Decision Log — walkie-talkie

| #   | Date       | Decision                                                      | Status   |
| --- | ---------- | ------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | Parallel schema alongside existing chat (Approach C)          | Accepted |
| 2   | 2026-03-22 | profile_role 'system' enum value for Botsson profiles         | Accepted |
| 3   | 2026-03-22 | Dotted telemetry event names for channel domain               | Accepted |
| 4   | 2026-03-22 | Membership-scoped RLS (not workspace-scoped) for child tables | Accepted |
| 5   | 2026-03-22 | Read-model RPCs for complex channel queries                   | Accepted |

status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [decisions]

---

# Decision Log — website-factory

| #   | Date       | Decision                                                                 | Status   |
| --- | ---------- | ------------------------------------------------------------------------ | -------- |
| 1   | 2026-03-22 | Dedicated `websites` PostgreSQL schema for bounded context isolation     | Accepted |
| 2   | 2026-03-22 | Website section trigger resolves workspace via page join (not direct FK) | Accepted |
| 3   | 2026-03-22 | PostgREST needs explicit `--schema websites` for RPC/type gen            | Accepted |
| 4   | 2026-03-22 | 2-column editor with preview as separate tab (no inline WYSIWYG)         | Accepted |
| 5   | 2026-03-22 | 20 templates across 3 tiers (Basic/Pro/Premium)                          | Accepted |
| 6   | 2026-03-22 | System-connected sections use bridge pattern (live data, not copies)     | Accepted |
| 7   | 2026-03-22 | Hours bridge is bidirectional, menu bridge is read-only                  | Accepted |
| 8   | 2026-03-22 | Spokesperson requires GDPR-compliant approval flow via mobile app        | Accepted |
| 9   | 2026-03-22 | Spokesperson data: content in section JSONB, workflow in dedicated table | Accepted |
| 10  | 2026-03-22 | dnd-kit for drag-to-reorder (already in codebase, no new deps)           | Accepted |
| 11  | 2026-03-22 | AI writing panel stubbed with static suggestions (backend not ready)     | Accepted |
| 12  | 2026-03-22 | notifications added to EventDestination type for spokesperson flow       | Accepted |
