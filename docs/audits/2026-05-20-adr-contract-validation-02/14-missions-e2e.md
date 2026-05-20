---
title: Audit Slice 14 — missions-e2e
status: complete
created: 2026-05-20
updated: 2026-05-20
module: missions + e2e
tags: [audit, missions, e2e, protocol-registry, hardcoded-keys]
---

# Audit Slice 14 — missions-e2e

## Summary

**Verdict: YELLOW — 2 MEDIUM, 1 LOW, 1 INFO**

Baseline findings **confirmed present and unchanged** — no regression, no new CRITICAL/HIGH. Both MEDIUMs from the 2026-05-20 synthesis are verified here:

1. `p-swap-marketplace-pipeline.ts` — Playwright protocol file exists, exports **nothing**, and is **absent from `PROTOCOL_REGISTRY`** in `protocols/index.ts`. The `S12` slot is currently occupied by `P_SIDEBAR_ORPHAN_COVERAGE` (a different file). The protocol is a fully functional 1243-line Playwright test but unreachable via the generator pipeline.

2. `announcement-atomic-rpc.spec.ts` — Hardcoded local service-role key (`sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`) as `??` fallback. The suite correctly guards with `HAS_SUPABASE_ENV = Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)` and uses `describe.skipIf(!HAS_SUPABASE_ENV)`, so the fallback only activates when the env var is unset — but the literal still ends up committed to git and is visible in source.

Mission registry is clean: 7 missions in `MISSIONS` object, `MissionIdSchema` enum lists all 7. No drift. ADR-0356 audit symmetry (`actor_capability` / `delegated_via`) is not applicable to mission definitions (missions are Ultravox/LiveKit config objects, not capability tools — they emit via capability layer on tool calls, not at mission load).

---

## Findings

### MEDIUM — M-14-01: `p-swap-marketplace-pipeline.ts` not registered in PROTOCOL_REGISTRY

| Field | Value |
|---|---|
| Severity | MEDIUM |
| File | `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` |
| ADR | None explicit — implicit consequence of protocol-generator architecture |
| Status | Present (matches baseline) |

`protocols/index.ts` defines `PROTOCOL_REGISTRY` with slots P-001, S8–S12. The `S12` slot maps to `P_SIDEBAR_ORPHAN_COVERAGE` (imported from `p-sidebar-orphan-coverage.ts`). The `p-swap-marketplace-pipeline.ts` file (1243 lines, 3 journeys, claims to be "S12 — Shift Swap + Marketplace Pipeline") exports **zero constants** — it is a self-contained Playwright test file, not a `JourneyIR` definition.

Consequence: the mission-generator pipeline (`generators/mission-generator.ts`) cannot pick up this protocol. Journey run results from this suite are also not captured by `JourneyReporter` (which depends on `PROTOCOL_REGISTRY`). The file's run instruction in its header comment references a non-existent `tests/p-swap-marketplace-pipeline.spec.ts` path — the tests live directly in the file, not in a separate `.spec.ts`.

**Root cause:** The file was likely built as a standalone Playwright test (correct pattern for complex multi-journey BFF tests) but was mislabelled as "S12" in its docblock, creating a naming collision with the sidebar-orphan protocol that also claims S12. Neither the file nor the registry have been updated to resolve this.

**Remediation options:**
1. Assign a new slot (e.g. `S13`) in `PROTOCOL_REGISTRY` and expose the file's journey definitions as a `JourneyIR` export — if generator integration is desired.
2. Remove the `S12` claim from the file's docblock, document it as a standalone BFF integration test (no registry entry needed), and clarify that the sidebar-orphan coverage holds S12. This is the lighter path.

---

### MEDIUM — M-14-02: Hardcoded local service-role key in `announcement-atomic-rpc.spec.ts`

| Field | Value |
|---|---|
| Severity | MEDIUM |
| File | `apps/e2e/db/announcement-atomic-rpc.spec.ts:17` |
| ADR | CLAUDE.md — Secrets Protocol; secrets-protocol skill |
| Status | Present (matches baseline) |

```ts
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"; // local dev only — not a production secret
```

The comment "local dev only — not a production secret" is accurate: this is the well-known Supabase local dev service role key, not a production credential. The suite also has a correct `HAS_SUPABASE_ENV` guard that skips all tests when the env var is absent, making the fallback value operationally inert in CI. However, committing any literal secret to git violates the secrets protocol regardless of scope — the value ends up in git history, IDE autocomplete, and search results.

Compare: `apps/e2e/db/helpers/clients.ts:18` uses `process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""` (empty fallback — correct pattern). `birthday-cohort.spec.ts` also uses empty fallback with `HAS_SUPABASE_ENV` skip guard.

Three other specs use the same Supabase-demo JWT split-join pattern (`knowledge-ingestion.spec.ts`, `journey-doc-chunk-ingest-failure.spec.ts`, `journey-doc-chunk-protocol-edit.spec.ts`) — those are similarly low-risk (well-known demo token) but inconsistent with the canonical empty-fallback pattern.

**Remediation:** Replace the hardcoded fallback with `""` (empty string) — the `HAS_SUPABASE_ENV` guard already ensures the suite skips when no real key is present. Apply the same pattern to the three JWT-split specs.

---

### LOW — L-14-01: S12 slot collision in docblock

| Field | Value |
|---|---|
| Severity | LOW |
| File | `apps/e2e/protocols/p-swap-marketplace-pipeline.ts:7` and `apps/e2e/protocols/p-sidebar-orphan-coverage.ts:4` |

Both files claim to be "S12" in their opening docblocks. The sidebar-orphan file has the legitimate registry slot. The swap-marketplace file pre-dates the sidebar assignment and was never renumbered. Maintenance confusion risk only — no runtime impact.

---

### INFO — I-14-01: `p-swap-marketplace-pipeline` hardcoded login credential fallbacks

| Field | Value |
|---|---|
| Severity | INFO |
| File | `apps/e2e/protocols/p-swap-marketplace-pipeline.ts:483-484` |

```ts
await page.getByTestId("login-email").fill(process.env.E2E_ADMIN_EMAIL ?? "admin@smartout.no");
await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "admin123456");
```

`admin@smartout.no` / `admin123456` are the well-known local seed credentials; `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are the correct env-var references. The fallbacks are safe for local dev, but differ from the empty-fallback + skip-guard pattern used elsewhere. Since the file is already a standalone Playwright test (not run in CI without env setup), runtime risk is negligible. Pattern inconsistency only.

---

## Per-ADR rollup

| ADR | Area | Finding | Status |
|---|---|---|---|
| Secrets Protocol (CLAUDE.md) | Hardcoded key in source | M-14-02 | Open |
| ADR-0356 (audit symmetry: actor_capability + delegated_via) | Missions are config objects, not capability tools — no emit site, no applicability | — | N/A |
| ADR-0174 (protocol authoring — JourneyIR v2 canonical) | PROTOCOL_REGISTRY only accepts JourneyIR exports; p-swap-marketplace-pipeline.ts has no JourneyIR export | M-14-01 | Open |

---

## Verified intentional

| Item | File | Rationale |
|---|---|---|
| `HAS_SUPABASE_ENV` skip guard in `announcement-atomic-rpc.spec.ts` | `apps/e2e/db/announcement-atomic-rpc.spec.ts:22-23,47` | Correct pattern: `describe.skipIf(!HAS_SUPABASE_ENV)` gates entire suite. Consistent with `birthday-cohort.spec.ts` and `birthday-auto-publish.spec.ts`. |
| `p-swap-marketplace-pipeline.ts` as standalone Playwright file (no JourneyIR export) | `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` | Complex multi-BFF protocol reasonably implemented as a direct Playwright test — the generator path adds little value here. The issue is the docblock naming collision, not the architecture. |
| Mission registry 7-entry completeness | `packages/ai/src/missions/registry.ts` + `types.ts` | All 7 IDs in `MISSIONS` object match all 7 IDs in `MissionIdSchema` enum. No drift. `manifest.ts` derives from registry at import time — no secondary sync needed. |
| `SUPABASE_URL` fallback to `127.0.0.1:54321` | `apps/e2e/db/announcement-atomic-rpc.spec.ts:15` | Standard local Supabase port. Harmless, correct for local dev spec. |

---

## In-progress / campaign filter

Active campaign `campaign/bubble-migration` — T6 (emit chain) and T11 (ADR cleanup) may touch this slice:

- **T6 (emit chain):** No emit call sites in `packages/ai/src/missions/` — missions are config objects. Any T6 emit work targets capability tools, not mission definitions. No collision risk.
- **T11 (ADR cleanup):** If T11 touches protocol registry or mission IDs, M-14-01 (S12 slot collision) and M-14-02 (hardcoded key) are candidates for same-PR remediation. Recommend bundling both fixes into T11 if it touches the e2e layer.

---

## Finding counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 1 |
| INFO | 1 |
| **Total** | **4** |

**Top 3:** M-14-01 (unregistered protocol / S12 slot collision), M-14-02 (hardcoded service-role key in git), L-14-01 (docblock S12 naming collision).
