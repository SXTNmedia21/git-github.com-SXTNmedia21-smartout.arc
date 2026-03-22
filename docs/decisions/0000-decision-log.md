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
