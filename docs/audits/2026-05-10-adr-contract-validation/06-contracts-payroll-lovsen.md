---
title: "Audit Slice 06 — contracts / payroll / lovsen (legal)"
status: done
created: 2026-05-10
updated: 2026-05-10
module: contracts, payroll, legal
tags: [audit, adr-contract-validation, contracts, payroll, lovsen, channel-restriction]
---

# Audit Slice 06 — Contracts / Payroll / Lovsen (Legal)

**Branch:** campaign/botsson-arena
**ADR cluster:** 0024, 0076-0079, 0234-0235, 0241-0245, 0249-0254, 0256-0259
**Surface audited:**
- `packages/ai/src/capabilities/contract/`
- `packages/ai/src/capabilities/contract-intake/`
- `packages/ai/src/capabilities/payroll/`
- `packages/ai/src/capabilities/legal/`
- `services/contract-service/src/`

**Known FPs skipped:** FP-001 (validate_aml_14_6 channel "inversion" — intentional layered defence per ADR-0078)

---

## Findings

### F-CL-01 — MEDIUM — validate_aml_14_6 Layer 3 guard blocks "voice" but capability-level allows it

**File:** `packages/ai/src/capabilities/legal/tools.ts:90`
**Also:** `packages/ai/src/capabilities/legal/index.ts:57`

ADR-0249 table row for `validate_aml_14_6` lists its intended channels as `["chat", "voice*"]` with a note that the `*` denotes the capability union (`allowedChannels: ["chat", "voice", "system"]`). However, the Layer 3 guard in the tool body reads:

```typescript
if (ctx.channel !== "chat" && ctx.channel !== undefined && ctx.channel !== "system") {
```

This guard **blocks voice**. The capability-level declaration (`allowedChannels: ["chat", "voice", "system"]`) says voice is allowed at L2, but L3 will deny it. The comment in `legal/tools.ts:69` says "Channel: chat only" — inconsistent with both the ADR table and the capability `allowedChannels`.

**Impact:** A voice session invoking `validate_aml_14_6` would pass L2 (capability filter) but be rejected at L3 — returning a 422-style error JSON instead of an authoritative "channel_not_allowed" gate response. Per ADR-0249 the intended behaviour for voice is already "blocked via tool guard" — so the guard is arguably correct but the capability `allowedChannels` declaration is over-broad and the ADR table note is ambiguous.

**Recommendation:** Either (a) remove `"voice"` from `legal`'s `allowedChannels` to align L2 with L3, or (b) explicitly document in `legal/index.ts` that `"voice"` in `allowedChannels` is there for `cite_law` only and `validate_aml_14_6` self-restricts at L3. The current state passes a voice-channel `validate_aml_14_6` call through L2 invisibly, which could produce confusing error payloads instead of the expected "capability not available on this channel" router rejection.

---

### F-CL-02 — LOW — cite_law has no Layer 3 channel guard (by ADR-0249 design, but asymmetric)

**File:** `packages/ai/src/capabilities/legal/tools.ts:170-207`

ADR-0249 explicitly documents: `cite_law` Layer 3 guard = "None (capability allowedChannels is sufficient)". The code matches this: `cite_law` has only the comment `// ADR-0078 Layer 3: cite_law is chat + voice (no system/autonomous from agent surface).` with no guard code.

This is intentional per the ADR but creates asymmetry: `validate_aml_14_6` self-checks, `classify_amendment` self-checks, but `cite_law` relies on L2 alone. This is a documentation gap — the tool body has no comment explaining *why* there is no guard, only what channels are permitted.

**Recommendation:** Add a one-line comment: `// No Layer 3 self-check — L2 (allowedChannels) is authoritative; cite_law has no PII exposure on voice.` This prevents future authors from adding a defensive stub (explicitly prohibited by ADR-0078 Amendment §"Anti-pattern: defensive stubs").

**Severity:** LOW — design matches ADR; no behaviour gap.

---

### F-CL-03 — MEDIUM — GET /contracts (list) workspace_id filter is OPTIONAL

**File:** `services/contract-service/src/routes/contracts.ts:12-23`

```typescript
app.get("/contracts", async (request, reply) => {
  const query = listContractsQuery.parse(request.query);
  let q = supabase.from("contract").select("*");
  if (query.workspace_id) q = q.eq("workspace_id", query.workspace_id);
  // ...
```

The service client is service-role (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS. The `workspace_id` filter is **optional** — a caller that omits it receives all contracts across all workspaces. The X-Service-Key auth hook validates the caller is a trusted service, but it does not enforce workspace scoping. Any service-key holder can enumerate the full `contract` table.

**Impact:** Cross-workspace data leakage if a misconfigured caller omits `workspace_id`. The contract-service is intended as an internal service called only by the web BFF and AI capability layer — both currently pass `workspace_id` — but the missing enforcement is a latent risk.

**Recommendation:** Make `workspace_id` a required query parameter on `GET /contracts`. Return 400 if omitted. Mirror the check in `GET /contracts/:id` which also lacks a `workspace_id` filter.

---

### F-CL-04 — MEDIUM — GET /contracts/:id has no workspace_id filter

**File:** `services/contract-service/src/routes/contracts.ts:27-39`

```typescript
app.get("/contracts/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const [contractResult, eventsResult] = await Promise.all([
    supabase.from("contract").select("*").eq("contract_id", id).single(),
    supabase.from("contract_event").select("*").eq("contract_id", id).order("created_at"),
  ]);
```

Any authenticated service-key caller can retrieve any contract by UUID regardless of workspace. The AI capability layer (`sendEmployeeContract`, `checkContractStatus`) always passes the workspace-scoped `contractId` — so the risk is limited to direct service-key users, not agent paths. Still violates ADR-0151 (forgery defence) at the service boundary.

**Recommendation:** Accept `workspace_id` as a required header or query param and add `.eq("workspace_id", workspaceId)` to both selects. Same fix as F-CL-03.

---

### F-CL-05 — LOW — contract-service routes emit no telemetry (activity_trail gap)

**File:** `services/contract-service/src/routes/contracts.ts` (all route handlers)

None of the contract-service route handlers call `emit()`. Contract lifecycle events (create, send, cancel, fetch-documents) are logged only to `contract_event` (application-level audit) — they do NOT reach `activity_trail` (compliance-level audit) or PostHog.

The AI capability layer (`contract/tools.ts`) does emit via `@smartout/telemetry` for actions it triggers, but the service has a separate path: the web BFF calls the service directly (outside the AI capability layer) for the same operations, and those paths produce no `activity_trail` entries.

**Impact:** Some contract-send operations — those triggered by the web UI directly rather than through the AI capability — will have no `activity_trail` entry. The AI capability path is covered; the direct-BFF path is not.

**Recommendation:** Add `emit()` calls in the contract-service `POST /contracts` and `POST /contracts/:id/send` handlers. This requires importing `@smartout/telemetry` into the service. If that dependency is undesirable, the BFF route (`/api/contracts/send`) should ensure it emits before delegating to the service.

---

### F-CL-06 — INFO — classify_amendment stub always returns "admin" — misleading default

**File:** `packages/ai/src/capabilities/legal/tools.ts:278-296`

The `classify_amendment` Phase 0c stub always returns `classification: "admin"` for every field change. `AmendmentClassification` includes `"material"`, `"admin"`, `"derived"`, `"system"`, `"blocked"`, `"review_required"`. ADR-0244 mandates that MATERIAL changes require re-signing; the stub silently classifies everything (including MATERIAL fields like `monthly_salary`, `job_title`, `tariff_id`) as `admin`.

The stub body contains a `warnings[].message_no: "classify_amendment er en stub. Ikke bruk i produksjon."` which partially mitigates the risk, and the stub only runs in Phase 0c.

**Impact:** If a consumer calls `classify_amendment` in a test/staging environment and acts on the result (e.g., to decide whether re-signing is needed), MATERIAL amendments will be silently mis-classified as not requiring a signature. The stub warning partially covers this, but there is no runtime assertion that blocks production use.

**Recommendation:** Add a guard: if `process.env.NODE_ENV === "production"`, return an explicit `classification: "blocked"` with `blocked_reason: "classify_amendment is not yet implemented for production"`. This prevents production consumers from accidentally acting on stub output.

Note: The audit spec asked about MATERIAL / WORKSPACE_DEFAULT_ALIGNED / TARIFF_REVISION terminology. These are NOT terms defined in the `AmendmentClassification` union or current ADRs — the canonical terms are MATERIAL / ADMIN / DERIVED / SYSTEM / BLOCKED / REVIEW_REQUIRED (per ADR-0244). WORKSPACE_DEFAULT_ALIGNED and TARIFF_REVISION are not found anywhere in the codebase or ADRs. This terminology may exist only in the audit-spec prompt and does not correspond to current implementation.

---

### F-CL-07 — MEDIUM — lønnsslipp used in mobile and web UI labels (should be lønnsgrunnlag)

**Files (selection):**
- `apps/mobile/app/(app)/(me)/payroll/payslip.tsx:82` — `title="Ingen lønnsslipper"`
- `apps/mobile/src/constants/strings.ts:230` — `"Ingen lønnsslipp tilgjengelig ennå..."`
- `apps/mobile/src/constants/strings.ts:236` — `loadErrorPayslip: "Kunne ikke laste lønnsslipp"`
- `apps/web/src/app/dashboard/my-salary/_components/PeriodList.tsx:53` — `Ingen lønnsslipp ennå`
- `apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx:40` — `"Sjekk timeoversikt, tillegg og lønnsslipp."`
- `apps/mobile/app/(app)/(me)/index.tsx:171` — `Siste lønnsslipper`

Per memory (feedback_lonnsgrunnlag_not_lonnsslipp.md): Smartout produces **lønnsgrunnlag** (wage basis for accountants/Tripletex/Visma), not **lønnsslipp** (payslip/employee-facing paycheck document). The UI labels use **lønnsslipp** which frames the output as a payslip rather than a wage basis.

**Compliance:** Per the memory note, capability names and telemetry events should remain unchanged; only UI labels and docs should use lønnsgrunnlag. The code-level naming (`usePayslips`, `PayslipDetail`, `PayslipEntry`) is internal and not user-facing — acceptable per the rule. The Norwegian-language strings displayed to the end user must change.

**Severity:** MEDIUM — user-facing framing diverges from positioning; creates incorrect expectation that Smartout produces the final payslip document rather than the wage basis that accountants consume.

**Recommendation:** Replace user-facing Norwegian strings: `lønnsslipp` → `lønnsgrunnlag`, `lønnsslipper` → `lønnsgrunnlag` (or `lønnsgrunnlag-perioder`). Internal code identifiers (`usePayslips`, `PayslipEntry`, `PayslipDetail`) need not change per the memory rule.

---

### F-CL-08 — LOW — ADR-0259 authority seed targets `industry_intelligence.lovsen_query` but legal capability is registered as `legal`

**File:** `docs/decisions/0259-lovsen-capability-authority.md:38-49`
**Compared to:** `packages/ai/src/capabilities/legal/index.ts:45` (`name: "legal"`)

ADR-0259 seeds `engine_authority_config` for capability `'industry_intelligence.lovsen_query'`. The registered capability name in the code is `"legal"`. The `gate_action` RPC matches on the `capability` column — if the seed uses the old dotted name and the code passes `"legal"`, the gate evaluation will find no matching row and fail-closed (which is safe) but will also block legitimate legal capability invocations.

**Impact:** If the ADR-0259 seed migration was applied verbatim, `callGateAction` with `capability: "legal"` will return `allow: false` with `reason: "gate_action unavailable: ..."` or a not-found result — blocking all legal capability tools for all users.

**Check:** Verify the actual seed migration file. ADR-0249 specifies a separate seed (`20260430000001_legal_capability_authority_seed.sql`) using `'legal'` as the capability value. If that migration is applied and ADR-0259's migration is absent or applied with `'legal'` not `'industry_intelligence.lovsen_query'`, there is no issue. If both migrations exist and use different keys, there are two orphaned rows.

**Recommendation:** Confirm the applied migrations. The code and ADR-0249 agree on `"legal"`. ADR-0259 appears to describe an earlier naming scheme. If ADR-0259 seed has not shipped, mark it superseded by ADR-0249.

---

### F-CL-09 — PASS — ADR-0099 gate_action wrappers present on all mutations

**Files:**
- `contract/tools.ts`: all 5 mutation tools call `gateMutation()` before any DB operation
- `payroll/tools.ts`: all 2 mutation tools (`update_payroll_profile`, `set_pension_scheme`) call `callGateAction()` before write
- `legal/tools.ts`: `classify_amendment` calls `callGateAction()` before any logic
- `contract-intake/tools.ts`: `submit_field_group` and `decline_intake` call `callGateAction()` before mutation

No L-0176 violation found (tool docstring claiming gate compliance without body satisfying it). All gate calls are fail-closed on RPC error.

---

### F-CL-10 — PASS — Voice channel correctly blocked for Høy-PII tools (ADR-0077/0078)

**Files:** `payroll/tools.ts:38-48`, `contract/tools.ts:475,586,680`, `contract-intake/tools.ts:106`

All Høy-PII capability tools implement the 3-layer defence:
- L1: Process-level `allowed_channels` (enforced by dispatcher)
- L2: `allowedChannels: ["chat"]` on both `contract` and `payroll` capabilities
- L3: Tool-level `assertChatChannel()` / explicit `ctx.channel !== "chat"` checks

Voice + all other channels are permanently blocked at L3 for payroll tools even if L1/L2 are misconfigured.

---

### F-CL-11 — PASS — ADR-0151 workspace_id forgery defence present

**Files:** `payroll/tools.ts:93-99, 253-259, 337-343`, `contract/tools.ts:109-119`, `legal/tools.ts:251-257`

All tools that accept an external `profile_id` parameter verify `.eq("workspace_id", ctx.workspaceId)` before trusting the row. No tool uses a caller-supplied `workspace_id` directly.

---

### F-CL-12 — PASS — §14-6 validation gate wired in /api/contracts/send

**File:** `apps/web/src/app/api/contracts/send/route.ts:327-373`

`validateAml146.execute()` is called with `channel: "system"` (correct for server-side route) BEFORE DocuSeal dispatch. On `pass === false` (Phase 0c+ behaviour), the route returns 422 with structured `aml_errors[]`. The Phase 0c stub always returns `pass: true` so the gate is currently a no-op, but the wiring is correct and will activate automatically when Phase 0c+ ships the real validator.

---

### F-CL-13 — PASS — No cross-namespace writes detected (ADR-0240)

Checked `contract/tools.ts`, `payroll/tools.ts`, `legal/tools.ts`, `contract-intake/tools.ts`:
- Each capability only writes to tables owned by that capability's concern
- `legal/classify_amendment` is a Phase 0c stub — no writes at all
- `contract-intake` correctly delegates PII writes to the `submit_own_pii` RPC (not direct table writes to `employee_payroll_profile`)

---

### F-CL-14 — PASS — §15-7 constructive dismissal risk flagged in ADR-0244

ADR-0244 mandates `is_constructive_dismissal_risk` column and UI warning when `job_title + tariff_id + agreed_weekly_hours` change together. The audit scope (capability tools) doesn't implement this — it belongs to the amendment-handler service-side path (not yet implemented per Phase 0c stub in `classify_amendment`). Documented as Phase 0c+ work. No regression found.

---

## Summary Table

| ID | Severity | Area | Pass/Fail | Short Description |
|----|----------|------|-----------|-------------------|
| F-CL-01 | MEDIUM | legal | Fail | `validate_aml_14_6` L3 blocks voice but capability L2 declares voice allowed — mismatch |
| F-CL-02 | LOW | legal | Fail | `cite_law` missing L3 comment explaining no-guard-by-design |
| F-CL-03 | MEDIUM | contract-service | Fail | `GET /contracts` workspace_id filter is optional — cross-workspace leak risk |
| F-CL-04 | MEDIUM | contract-service | Fail | `GET /contracts/:id` has no workspace_id filter |
| F-CL-05 | LOW | contract-service | Fail | No telemetry emission in contract-service routes — activity_trail gap for BFF-direct path |
| F-CL-06 | INFO | legal | Fail | `classify_amendment` stub returns `"admin"` for MATERIAL fields — no production block guard |
| F-CL-07 | MEDIUM | mobile + web | Fail | UI labels use `lønnsslipp` — should be `lønnsgrunnlag` per positioning memory |
| F-CL-08 | LOW | legal | Warn | ADR-0259 authority seed uses `industry_intelligence.lovsen_query` but code uses `"legal"` |
| F-CL-09 | — | all | PASS | gate_action wrappers on all mutations (L-0176 check passed) |
| F-CL-10 | — | payroll/contract | PASS | Voice permanently blocked for Høy-PII tools (ADR-0077/0078) |
| F-CL-11 | — | all | PASS | ADR-0151 workspace_id forgery defence present in all tools |
| F-CL-12 | — | legal/web | PASS | §14-6 validation gate wired in /api/contracts/send route |
| F-CL-13 | — | all | PASS | No cross-namespace writes (ADR-0240) |
| F-CL-14 | — | legal | PASS | §15-7 constructive dismissal flag documented; Phase 0c+ work |

## Finding Count by Severity

| Severity | Count |
|----------|-------|
| MEDIUM | 4 (F-CL-01, F-CL-03, F-CL-04, F-CL-07) |
| LOW | 3 (F-CL-02, F-CL-05, F-CL-08) |
| INFO | 1 (F-CL-06) |
| PASS | 6 |

## Highest Priority Remediation

1. **F-CL-07** (MEDIUM) — lønnsgrunnlag label fix: mechanical string replacement in `apps/mobile` and `apps/web`, no architecture change required. Directly affects user-facing positioning.
2. **F-CL-03 + F-CL-04** (MEDIUM) — Contract-service list + detail endpoints need mandatory workspace_id enforcement. Low blast radius (add `.eq()` filter + schema validation).
3. **F-CL-01** (MEDIUM) — Resolve `allowedChannels` vs Layer 3 guard inconsistency for `validate_aml_14_6`. Remove `"voice"` from capability `allowedChannels` or add a comment justifying the union-for-cite_law pattern.
