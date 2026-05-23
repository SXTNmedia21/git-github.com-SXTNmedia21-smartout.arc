---
title: "Contracts — Domain Index"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [domain, contracts, employment, docuseal, source-of-truth]
---

# Contracts — Source of Truth

> Authoritative folder for the **contracts** domain. If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| `employment_contract` + related tables | ✅ | ✅ | 44 migrations; full lifecycle |
| `contract` + `contract_template` (client-facing) | ✅ | ✅ | DocuSeal-backed |
| Composition engine (`contract-service/lib/`) | ✅ | 🟡 | composition via cascade derivation ADR-0076 |
| Capability `contract` (8 tools) | ✅ | 🟡 | 3 unit tests; fork/publish/deprecate |
| Capability `contract-intake` (3 tools) | ✅ | 🟡 | 1 unit test |
| Web dashboard `/dashboard/people/contracts/` | ✅ | ✅ | Route migrated from `/dashboard/contracts/` (plan 2026-05-19, pending) |
| Web dashboard `/dashboard/contracts/` (old path) | 🟡 | — | Pending route migration per plan 2026-05-19 |
| Employee-side contract signing | ✅ | ✅ | DocuSeal embedded + awaiting-my-signature |
| DocuSeal integration (webhooks + sync) | ✅ | 🟡 | routes: webhooks.ts, sync.ts |
| Contract intake (employer + employee) | ✅ | 🟡 | engine-state-filter + submission |
| Contract template binding | ✅ | 🟡 | ADR-0182 lifecycle |
| Amendment flow | ✅ | 🟡 | ADR-0111 detail versioning |
| Phantom contracts (ADR-0197) | ✅ | 🔴 | promotion logic in code; no dedicated test |
| Apprentice / lærling (ADR-0253) | 🟡 | 🔴 | block enforced; full lærling flow deferred |
| GDPR / PII anonymize RPC | ✅ | 🟡 | `anonymize_contract_rpc.sql` |
| Mobile contract signing | 🟡 | 🔴 | ADR-0245 — WebView DocuSeal + biometric C4; plan complete, UI partial |
| Tripletex columns | ✅ | 🔴 | columns added; push-sync deferred |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map + pipeline trace |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys + handoffs |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta + overlap |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test coverage map |

## Agent Guardrails

> Read before touching contracts code. Detailed skill: none yet — consult ARCHITECTURE.md.

- **NEVER write to `employee_payroll_profile` rate columns from contracts capability.** ADR-0242: payroll owns those columns. Contract reads start_date → seniority; payroll resolves tariff. No dual ownership.
- **NEVER bypass Aml §14-6 strict-mode validation.** ADR-0234: lovsen-mcp validates; contract-intake calls it. Skip = compliance violation.
- **NEVER create a contract amendment without consulting ADR-0111 + ADR-0082.** Drafts are NOT versions. `employment_contract_detail` is the versioned supplement layer.
- **NEVER invoke `packages/lovsen-contract/` as if it owns legal rules.** It is a Zod-schema type-contract package for the lovsen-mcp citation interface (ADR-0256 + ADR-0257). It belongs to the lovsen domain; contracts imports nothing from it.
- **NEVER hardcode Aml clause numbers in contract body.** Citations must carry `lovsen-contract` Citation schema: verbatim text + SHA-256 + fetched_at + source_url.
- **NEVER create new contract mutations without `gatedMutation` per ADR-0204.** `create_employee_contract`, `send_employee_contract`, `fork_template`, `publish_workspace_template`, `deprecate_workspace_template` all use it.
- **NEVER resolve `workspace_id`/`profile_id` from body-supplied row without fail-fast on row-not-found.** ADR-0151 forgery defense.
- **NEVER build contract authoring UI on mobile.** ADR-0133: mobile = sign + view only. Drawer / new-contract flow stays web.
- **NEVER store contract PII (personnummer, bank account) in plain columns visible to all RLS tiers.** ADR-0077: RPC-controlled access for Høy-PII tier.
- Owning tables: `public.employment_contract`, `public.employment_contract_detail`, `public.contract`, `public.contract_template`, `public.contract_template_attachment`, `public.contract_template_binding`, `public.contract_pay_rule`, `public.contract_tip_rule`, `public.contract_obligation`, `public.contract_amendment`, `public.contract_attachment`, `public.contract_event`, `public.contract_reminder`, `public.message_template`, `public.clause_library`
- Owning capability: `packages/ai/src/capabilities/contract/` (8 tools) + `packages/ai/src/capabilities/contract-intake/` (3 tools)
- Owning service: `services/contract-service/` (Fastify, port 5012)
