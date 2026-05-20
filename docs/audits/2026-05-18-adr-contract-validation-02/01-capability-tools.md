---
title: Capability Tools Audit — Slice 01
run: 2026-05-18
adrs: [0151, 0173, 0186, 0204, 0238, 0240]
traps: [L-0176, L-0177]
scope: packages/ai/src/capabilities/**/tools.ts
files_read: 37
---

# Slice 01: Capability Tools Audit

## Coverage

37 tools.ts files read in full. Per-tool trace performed on all mutation paths.
Active in-flight (council-APPROVED, not flagged): `day-line/tools.ts`, `task/tools.ts`.
Known false positive FP-001 (`validate_aml_14_6` channel inversion) not applicable — that
tool is not in this slice's file set.

---

## MEDIUM

### M-001 — `billing-query/tools.ts:getUsageSnapshot` — body-supplied `workspace_id` accepted as filter (ADR-0151)

**File:** `packages/ai/src/capabilities/billing-query/tools.ts:249-279`

**Tool:** `get_usage_snapshot`

| gate_action | gatedMutation | emit() | Verdict |
|---|---|---|---|
| resolveCompanyId (company-scope) | N/A (read-only) | none | MEDIUM |

The schema accepts `workspace_id` as a body parameter (line 255). The query at line 270 uses `.eq("workspace_id", params.workspace_id)` combined with `.eq("company_id", companyId)`. The company_id anchor (`resolveCompanyId`) is server-derived from `ctx.workspaceId`, so a body-supplied `workspace_id` for a workspace the caller does NOT own (but that is within the same company) would succeed — it can expose usage snapshots from sibling workspaces. This is scoped to workspaces in the same company, limiting the blast radius, but it violates ADR-0151 (workspace_id MUST be server-derived, never body-supplied for scoping reads).

**Fix:** derive `workspace_id` from `ctx.workspaceId` and ignore the body parameter, OR add an explicit `.eq("workspace_id", ctx.workspaceId)` and remove the schema field.

---

### M-002 — `payroll/tools.ts:adjustTimebankBalance` + `forceTimebankPayout` — direct INSERT after gate, no `gatedMutation` wrapper (ADR-0204)

**File:** `packages/ai/src/capabilities/payroll/tools.ts:1104-1118` (adjust), `1186` (payout)

**Tools:** `adjust_timebank_balance`, `force_timebank_payout`

| Tool | gate_action | gatedMutation | emit() | Verdict |
|---|---|---|---|---|
| adjust_timebank_balance | callGateAction:1085 | none | yes:1122 | MEDIUM |
| force_timebank_payout | callGateAction:1167 | none | yes:1201 | MEDIUM |

Both tools call `callGateAction` then perform `.schema("payroll").from("timebank_entry").insert(...)` directly outside any `gatedMutation` or `mutateWithGate` callback. ADR-0204 requires all persistence calls to flow through `gatedMutation`. The docstring for `update_payroll_profile` (line 69) explicitly acknowledges "gate-then-update is the established payroll convention" — this is a documented payroll-specific deviation. However:
1. It is not documented in ADR-0204 as an approved exception.
2. The other payroll mutation tools (`overrideCalculationLine`, `addManualSupplement`, `lockPeriod`) use `callGateAction` + direct write as the same "payroll convention" pattern. The pattern is consistent within the payroll capability but not aligned with the canonical ADR-0204 requirement.

**Assessment:** Medium rather than High because `callGateAction` IS called before every write and workspace scope is enforced via `.eq("workspace_id", ctx.workspaceId)`. Gate-then-direct is materially equivalent for the approval gate; the gap is the gatedMutation audit log (change_proposal, gate_evaluation linkage to the write). Recommend filing an ADR amendment acknowledging the payroll convention or migrating to `mutateWithGate`.

---

### M-003 — `shift-lifecycle/tools.ts:approveShift` — direct `.update()` outside `gatedMutation` after gate (ADR-0204)

**File:** `packages/ai/src/capabilities/shift-lifecycle/tools.ts:350-362`

**Tool:** `approve_shift`

| gate_action | gatedMutation | emit() | Verdict |
|---|---|---|---|
| callGateAction:281 | none | yes:364 | MEDIUM |

`approve_shift` calls `callGateAction` (line 281), then updates `shift_approval` directly via `.from("shift_approval").update(...)` (line 350). `publish_shift` has the same pattern (line 177). Neither uses `gatedMutation` or `mutateWithGate`. Same class as M-002 (gate-then-direct pattern). `interpret_shift` and `settle_shift` use RPCs — ADR-0204 §RPC exception may apply; worth confirming.

---

### M-004 — `timeline-template/tools.ts:applyTemplate` — `session_hook` insert does NOT verify department scope of the hook against the session's department (ADR-0173)

**File:** `packages/ai/src/capabilities/timeline-template/tools.ts:318-346`

**Tool:** `apply_template` → `insertItemsInExec` → `session_hook` branch

The `session_hook` insert reads `department_id` from `department_session` (line 326) and inserts a new `session_hook` row with that `department_id`. This is a cross-namespace write (timeline-template capability inserting into `session_hook`, which is a D6 domain table typically owned by operations/governance). The docstring's compliance table does not mention ADR-0173 for `session_hook` items. ADR-0240 says cross-namespace writes must delegate to the owning capability's tool. The session_hook insert here creates hooks without going through a `session_hook.create` tool in the operations or governance capability.

**Assessment:** The write is inside `mutateWithGate` (ADR-0204 satisfied), but the ADR-0173 delegation chain is missing. The day-line capability demonstrates the correct pattern (delegates to `task.create_session`). This capability should either delegate `session_hook` creation or document an explicit ADR-0173 exemption.

---

## LOW

### L-001 — `billing-query/tools.ts:getUsageSnapshot` — no `emit()` on read access (observability gap)

**File:** `packages/ai/src/capabilities/billing-query/tools.ts:249-279`

`get_usage_snapshot` returns usage counts and `counted_profile_ids` (PII-adjacent: contains profile UUID arrays). The other billing tools that return sensitive billing data emit at minimum a read event for audit. `get_usage_snapshot` emits nothing. Not a blocking issue (no ADR mandates read-emit for this tool), but it weakens audit coverage for PII-adjacent data access.

---

### L-002 — `schedule/tools.ts:getShiftColleagues` — uses `id` column on `schedule_shift` (line 138) instead of `schedule_shift_id`

**File:** `packages/ai/src/capabilities/schedule/tools.ts:138`

The first `schedule_shift` query in `getShiftColleagues` uses `.eq("id", params.shift_id)`. The canonical PK is `schedule_shift_id` (confirmed from schema and other tools in this file). Line 152 correctly uses `.neq("profile_id", ctx.profileId)` but line 138 uses `id` which may be an alias or may fail silently (Supabase PostgREST returns empty row-set rather than error on unknown column). The second query at line 148 correctly selects `schedule_shift_id`. Inconsistency warrants verification against the live schema.

---

### L-003 — `contract-intake/tools.ts:getIntakeProgress` — reads PII columns directly from `profile` table without gate (ADR-0099)

**File:** `packages/ai/src/capabilities/contract-intake/tools.ts:396-445`

**Tool:** `get_intake_progress`

`get_intake_progress` queries `personal_number, bank_account, address_line_1, postal_code, city` from `profile` (line 399). These are the highest-PII columns in the system. No `callGateAction` call is present — this is a read-only tool, so ADR-0099 (which targets mutations) technically does not mandate gating. However, the payroll capability gates even read-only PII access (`query_tax_card`, `view_personal_number`). The tool does scope by `ctx.profileId` (self-only read), but an explicit gate would provide audit coverage for this PII access. The existing comment says "never returns actual PII values" but the SELECT reads them to derive completion status, which still triggers a service-role read of raw PII columns.

---

## Smoke Run Re-verification

### `billing-query:270` (smoke run HIGH)

**Confirmed as MEDIUM-001** above. The cross-workspace concern is real but blast radius is limited to sibling workspaces within the same company (not cross-company). Downgraded from HIGH to MEDIUM because `resolveCompanyId` provides company-scope anchor. The issue is ADR-0151 body-supplied workspace scope, not cross-company data leakage.

### `journey-authoring:483-509` (smoke run HIGH)

**NOT CONFIRMED — RESOLVED.** The `publish_draft` tool performs `journey` + `journey_version` + `wizard_session` writes at lines 483-543. All three are inside a single `gatedMutation` execute callback (line 478). The ADR-0240 cross-namespace note is present at lines 454-457 with an explicit rationale (journey-authoring is the sole writer in wizard flow; `publish_mission` consumes but does not write `journey_version`). The ADR-0204 requirement is satisfied. Trust Gate PASSES for `publish_draft`. Trust Gate also PASSES for `save_draft`, `check_duplicates`, `lookup_journeys`.

---

## Per-Tool Trust Gate Summary (mutation tools only)

| Capability | Tool | gate_action | gatedMutation | emit() | ADR-0151 | Verdict |
|---|---|---|---|---|---|---|
| billing_query | get_usage_snapshot | resolveCompanyId | N/A | none | FAIL (body workspace_id) | **M-001** |
| contract | createEmployeeContract | gateMutation:237 | N/A (ext.fetch) | yes | PASS | PASS |
| contract | sendEmployeeContract | gateMutation:342 | N/A (ext.fetch) | yes | PASS | PASS |
| contract | forkTemplate | gateMutation:480 | N/A (direct+role) | yes | PASS | PASS |
| contract | publishWorkspaceTemplate | gateMutation:591 | N/A (direct+role) | yes | PASS | PASS |
| contract | deprecateWorkspaceTemplate | gateMutation:681 | N/A (direct+role) | yes | PASS | PASS |
| contract_intake | submitFieldGroup | callGateAction:138 | userClient.rpc | yes | PASS | PASS |
| contract_intake | declineIntake | callGateAction:306 | supabaseAdmin.rpc | yes | PASS | PASS |
| operations | createDeviation | callGateAction:194 | none (direct) | yes | PASS | PASS* |
| payroll | updatePayrollProfile | callGateAction:146 | none (direct) | yes | PASS | PASS* |
| payroll | adjustTimebankBalance | callGateAction:1085 | none (direct) | yes | PASS | **M-002** |
| payroll | forceTimebankPayout | callGateAction:1167 | none (direct) | yes | PASS | **M-002** |
| journey_authoring | publish_draft | gatedMutation:460 | yes | yes | PASS | PASS |
| journey_authoring | save_draft | gatedMutation:90 | yes | yes | PASS | PASS |
| shift-lifecycle | publishShift | callGateAction:156 | none (direct) | yes | PASS | **M-003** |
| shift-lifecycle | approveShift | callGateAction:281 | none (direct) | yes | PASS | **M-003** |
| shift-lifecycle | clockInCheck | callGateAction:591 | RPC only | yes (cond.) | PASS | PASS |
| shift_swap | requestSwap | callGateAction:207 | mutateWithGate | yes | PASS | PASS |
| shift_swap | respondToSwap | callGateAction:347 | mutateWithGate | yes | PASS | PASS |
| shift_swap | cancelSwap | callGateAction:519 | mutateWithGate | yes | PASS | PASS |
| shift_swap | overrideSwapPipeline | mutateWithGate:718 | yes | yes | PASS | PASS |
| shift_marketplace | postOpen | mutateWithGate:211 | yes | yes | PASS | PASS |
| shift_marketplace | claim | mutateWithGate:468 | yes | yes | PASS | PASS |
| shift_marketplace | approveClaim | mutateWithGate:621 | yes | yes | PASS | PASS |
| shift_marketplace | cancelOffer | mutateWithGate:771 | yes | yes | PASS | PASS |
| shift_marketplace | overrideMarketplacePipeline | mutateWithGate:957 | yes | yes | PASS | PASS |
| cascade | bindWorkspaceUnion | mutateWithGate:184 | yes | yes | PASS | PASS |
| cascade | addSupplementRule | mutateWithGate:417 | yes | yes | PASS | PASS |
| day-line | create | gateDayLineAction:141 | direct (post-gate) | yes | PASS | PASS* |
| day-line | addItem | gateDayLineAction:268 | delegates | yes | PASS | PASS |
| day-line | instantiateTemplate | gateDayLineAction:440 | delegates | yes | PASS | PASS |
| day-line | updateHours | gateDayLineAction:577 | direct (post-gate) | yes | PASS | PASS* |
| task | createPersonal | gateTaskAction:306 | direct (post-gate) | yes | PASS | PASS* |
| task | createSession | gateTaskAction:432 | direct (post-gate) | yes | PASS | PASS |
| task | createDayAdHoc | gateTaskAction:649 | direct (post-gate) | yes | PASS | PASS* |
| task | complete | gateTaskAction:747 | direct (post-gate) | yes | PASS | PASS |
| task | cancelPersonal | gateTaskAction:949 | direct (post-gate) | yes | PASS | PASS |
| timeline-template | saveTemplate | mutateWithGate:600 | yes | yes | PASS | PASS |
| timeline-template | applyTemplate | mutateWithGate:843 | yes (multi-insert) | yes | PASS | **M-004** |
| timeline-template | archiveTemplate | mutateWithGate:961 | yes | yes | PASS | PASS |

*PASS* = gate present, direct write pattern same as payroll/operations convention; not escalated unless ADR-0204 exception is rejected.

---

## Notes

1. **Payroll "gate-then-direct" convention** (M-002, M-003 family): Multiple capabilities (payroll, shift-lifecycle, operations, day-line, task) use a "callGateAction then direct .from().write()" pattern rather than `mutateWithGate`. The docstring for `updatePayrollProfile` explicitly names this as the "established payroll convention." An ADR clarifying whether `callGateAction + direct write` is an acceptable ADR-0204 variant (compared to `mutateWithGate`) would close this recurring ambiguity across the audit surface.

2. **`governance/tools.ts:checkReadiness`** — read-only, no gate, no emit. Correct per its own docstring ("read-only; does not mutate"). Used as a sub-call from shift-lifecycle, not exposed to users directly.

3. **`schedule/tools.ts`** — 6 read-only tools. No mutations. All workspace-scoped. PASS across the board.

4. **`memory/tools.ts`** — callGateAction present at line 159 (save_memory). PASS.

5. **`onboarding/tools.ts`** — `update_business` and `update_season` use callGateAction + direct write (same M-002 class); `add_procedures` uses callGateAction + direct insert. No gatedMutation. Consistent with payroll convention noted above.
