---
title: "Plan — contract-dispatch-ux-pass"
status: draft
updated: 2026-05-06
created: 2026-05-06
module: contract
linear: SMA-303, SMA-305, SMA-307
tags: [plan, contract, dispatch-drawer, dx, parallel-orchestration]
---

# Plan — contract-dispatch-ux-pass

> Branch: `feat/contract-dispatch-ux-pass` | Worktree: `~/dev/smartout.ai-wt-7` | Base: `development` | Module: contract | Started: 2026-05-06 | Linear: **SMA-303, SMA-305, SMA-307**

## Source of truth

- **Linear:** SMA-303 (preview redigerbar), SMA-305 (MissingInfoSheet popup, Flow A only), SMA-307 (walt fallback gate)
- **CONTRACT-PIPELINE-MAP** (`docs/architecture/contract-service/CONTRACT-PIPELINE-MAP.md`)
- **Lovsen + Steward synthese 2026-05-06** — gaps som blokkerer "use today"

## Goal

Lukke 3 sammenhengende UX-blockers på samme dispatch-overflate slik at admin kan opprette + sende kontrakt uten frustrasjon i én atomisk leveranse: redigerbar preview + popup for manglende info + null fake-success ved service-feil.

## Scope

In:
1. **SMA-303** — `ContractDispatchDrawer` Step 2 preview blir redigerbar; `SendBodySchema` aksepterer `resolved_html`; sanitize via eksisterende `sanitize-html` allowlist; PDF-gate hash matcher submitted HTML
2. **SMA-305 (Flow A only)** — 422-respons har `missing_fields[]`; ny `MissingInfoSheet` popup; ny `admin_submit_employee_pii` RPC; ny `/api/contracts/admin-fill-pii` route; auto-retry send etter fill; ADR-0077 amendment for admin-on-behalf
3. **SMA-307** — walt dev-stub fallback bak `process.env.NODE_ENV !== "production" && process.env.CONTRACT_SERVICE_DEV_FALLBACK === "true"`; prod returnerer 503 med tydelig melding

Out (separate sorties):
- SMA-304 (pop-out preview)
- SMA-306 (validateAml146 real body)
- SMA-308 (GDPR retention)
- SMA-310 (PDF server-gate hash verification — relatert til SMA-303 men egen scope)
- SMA-311 (C4 gate × 3 routes)
- SMA-312 / SMA-313 (request-flow + login-popup)

## Parallel orchestration strategy

3 agents kjører parallelt med strict file ownership boundaries:

| Agent | Owns | Conflict zone i `/api/contracts/send/route.ts` |
|---|---|---|
| **A: SMA-303** | `contract-preview-editor.tsx` (mode prop), `ContractDispatchDrawer.tsx` Step 2 only | Lines 31-36 (`SendBodySchema` adds `resolved_html?`) |
| **B: SMA-305** | NEW: `MissingInfoSheet.tsx`, `admin_submit_employee_pii` RPC migration, `/api/contracts/admin-fill-pii/route.ts`, ADR-0077 amendment | Lines 188-197 (422-response gets `missing_fields[]`) |
| **C: SMA-307** | NONE NEW | Lines 343-394 (walt-fallback gate behind env-flag + 503-error) |

`/api/contracts/send/route.ts` er delt zone — 3 disjoint regions (top schema / mid 422 / bottom fallback). Risk: line-drift mid-merge. Mitigation: serial integration phase etter parallel build (samler i én commit).

## ADR / Learning compliance

- **ADR-0024** (contract-service abstraction) — SMA-307 holder DocuSeal off-disk fra prod
- **ADR-0077** (PII handling) — SMA-305 amendment for admin-on-behalf-policy
- **ADR-0078** (channel restriction) — `MissingInfoSheet` chat-equivalent surface, IKKE voice
- **ADR-0151** (forgery defence) — admin-fill-RPC verifiserer workspace-membership server-side
- **ADR-0244** (PDF preview legal evidence) — SMA-303 må sikre edit ≠ post-PDF-gate
- **L-0107** (authority appearance ≠ presence) — SMA-307 fjerner silent success
- **L-0172** (trigger SECURITY = silent RLS bypass) — admin-fill-RPC SECURITY DEFINER + locked search_path
- **L-0177** (silent workspace-mismatch) — admin-fill-RPC fail-fast på cross-workspace target

## Tasks

### Phase 1 — Architect design (parallel) (~30 min)

3 explorer agents kjører parallelt:

- [ ] **A:** Map exact insertion points i `ContractPreviewEditor.tsx` for `mode="edit"` prop. Verify Tiptap event-handlers + sanitize roundtrip. Identifiser PDF-gate hash flow.
- [ ] **B:** Read `submit_own_pii` RPC source (mønster). Spec ny `admin_submit_employee_pii` RPC + ADR-0077 amendment shape. Identifiser eksisterende `is_admin_in_workspace()` helper signature.
- [ ] **C:** Read `/api/contracts/send/route.ts:343-394` walt-fallback. Verify env-pattern brukt elsewhere (`process.env.NODE_ENV` checks). Spec 503-response shape.

Output: 3 design-blocks i denne plan-filen (Phase 1.A, 1.B, 1.C sub-sections), plus joint integration-table for `/api/contracts/send/route.ts` regions.

### Phase 2 — Parallel build (~4-6 h)

3 build agents kjører parallelt MED disjoint file ownership:

- [ ] **A:** SMA-303 build (preview redigerbar)
- [ ] **B:** SMA-305 build (MissingInfoSheet + RPC)
- [ ] **C:** SMA-307 build (walt fallback gate)

Hver agent committer på egen sub-branch i samme worktree:
- `feat/contract-dispatch-ux-pass-303-preview-edit`
- `feat/contract-dispatch-ux-pass-305-missing-info`
- `feat/contract-dispatch-ux-pass-307-walt-gate`

### Phase 3 — Sequential integration (~30 min)

- [ ] Merge tre sub-branches inn i `feat/contract-dispatch-ux-pass`
- [ ] Resolve conflicts i `/api/contracts/send/route.ts` (forventet 1-3 hunks)
- [ ] Re-typecheck etter merge

### Phase 4 — Verify (~30 min)

- [ ] `pnpm turbo typecheck` passes
- [ ] Smoke test: send kontrakt med ansatt som mangler info → MissingInfoSheet vises → fyll inn → kontrakt sendes
- [ ] Smoke test: stop contract-service docker → send kontrakt → 503 i prod-mode (set `NODE_ENV=production`), 200 m/walt-stub i dev-mode
- [ ] Smoke test: rediger preview-tekst → send → resolved_html persisterer i `contract.resolved_html`

### Phase 5 — Closure

- [ ] HANDOFF
- [ ] `close-feature.sh 7`

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes (0 new errors)
- [ ] SMA-303: editert tekst i drawer Step 2 ender opp i `contract.resolved_html` ved DocuSeal-dispatch
- [ ] SMA-305: 422 fra `/api/contracts/send` med missing fields → `MissingInfoSheet` opens → admin filler inn → auto-retry succeeds
- [ ] SMA-305: ADR-0077 amendment shipped i samme PR; admin-fill-RPC enforce ADR-0151 + audit-emit
- [ ] SMA-307: prod-mode (`NODE_ENV=production`) returnerer 503 ved service-feil, IKKE fake-success
- [ ] HANDOFF skrevet med decisions + learnings + 3-Linear-comment-update (✅)
- [ ] Decision log oppdatert med ADR-0077 amendment

## Risks / Open Questions

1. **`/api/contracts/send/route.ts` 3-way merge conflict** — disjoint regions reduserer risiko, men line-drift kan forskyve mid-region edits. Mitigation: arkitekt gir agents NØYAKTIG line-anchor før build (Phase 1 output).
2. **ADR-0077 amendment scope** — Høy-PII admin-on-behalf-policy er gråsone juridisk. Lovsen-flagg: `personal_number` + `bank_account` admin-fill → krever advarsel-modal "ansatt har gitt eksplisitt tillatelse". Audit-trail mandatorisk. Eskalér til arbeidsrettsadvokat før prod (ikke blocker for sortie).
3. **Tiptap `mode="edit"` + sanitize roundtrip** — sanitize-html kan strippe Tiptap custom nodes (signature-field, date-field). Verifiser allowlist i `/api/contracts/route.ts:22-55` dekker Step 2 output.
4. **PDF-gate vs edit ordering** — SMA-303 må sikre at preview-edit skjer FØR PDF-gate viewing OR at PDF-gate re-rendres etter siste edit (hash matcher). Hvis edit etter PDF-view = legal evidence brutt (Aml. §14-5).
5. **walt fallback removal i prod** — fjerner mulighet for E2E-test mot dev-instans uten contract-service. Mitigation: dev-flag preserves walt-flow i lokal/preview.
6. **Sub-branch merge order** — anbefalt: SMA-307 først (smallest, isolated to bottom of file), deretter SMA-305 (mid-file 422-response), deretter SMA-303 (top-of-file schema). Gjør conflicts predictable.

## Dispatch plan

| Phase | Agent | Model | Why |
|---|---|---|---|
| 1.A | `feature-dev:code-explorer` | sonnet | Map Tiptap mode-prop integration |
| 1.B | `feature-dev:code-explorer` | sonnet | Spec admin RPC + ADR amendment |
| 1.C | `feature-dev:code-explorer` | sonnet | Map walt-fallback env-gate |
| 2.A | `general-purpose` (build) | sonnet | SMA-303 build (Tiptap + schema) |
| 2.B | `general-purpose` (build) | sonnet | SMA-305 build (MissingInfoSheet + RPC) |
| 2.C | `general-purpose` (build) | sonnet | SMA-307 build (walt gate) — smallest |
| 3 | orchestrator (this session) | opus | Sequential merge + conflict resolution |
| 4 | `feature-dev:code-reviewer` | sonnet | Verify ADR/RLS/telemetry coverage |
| 5 | `system-steward` | opus | Trust-gate before close |

## References

- Linear: SMA-303, SMA-305, SMA-307, SMA-312, SMA-313
- ADRs: 0024, 0077, 0078, 0151, 0244
- Learnings: L-0107, L-0172, L-0177
- CONTRACT-PIPELINE-MAP.md
- Sortie 1 sibling: SMA-309 (closed 2026-05-06, commit `2a0df3dee`)

---

## Phase 1.C — SMA-307 Design Map

> Analyst: Phase 1.C explorer | Source files verified 2026-05-06

### 1. Walt fallback dissection

`apps/web/src/app/api/contracts/send/route.ts`. `sendSucceeded` declared `false` line 248, set `true` line 326 (real success) and **line 351 unconditional inside walt block — the bug**. No NODE_ENV / flag guard.

3 failure paths converge at line 347:
| Mode | `isContractServiceConfigured()` | Path | sendError |
|---|---|---|---|
| Env vars missing | false | Lines 252-342 skipped | `null` |
| Network error | true | Catch line 340 | `"Contract service unreachable"` |
| Non-ok HTTP | true | Lines 334-337 / 311-313 | HTTP error string |

Stub corruption seq (351-393): unconditional flag flip → live recipient fetch → INSERT stub `contract` row (`signing_url=/walt/sign-dev/<id>`) → UPDATE `employment_contract.status='sent'`. Caller sees HTTP 202 success.

Lines 396-399 (secondary `if (!sendSucceeded)`) = dead code. Out of SMA-307 scope.

### 2. Env-flag spec

**`apps/web/src/env.ts`** server schema, after line 28:
```ts
CONTRACT_SERVICE_DEV_FALLBACK: z.enum(["true", "false"]).optional(),
```
No `experimental__runtimeEnv` entry needed (server-only var).

**Access pattern:** `process.env.CONTRACT_SERVICE_DEV_FALLBACK` directly in route. Confirmed by `apps/web/src/lib/page-perf.ts:34` + `apps/web/src/lib/perf.ts:18` (both use `process.env.NODE_ENV` directly despite `env.ts:40` registration).

**`.env.template`** after line 168:
```env
CONTRACT_SERVICE_DEV_FALLBACK="false"  # set to "true" only in local dev for walt-stub fallback; NEVER "true" in production
```

Default `"false"` = prod-safe. Both `NODE_ENV !== "production"` AND `CONTRACT_SERVICE_DEV_FALLBACK === "true"` must hold.

### 3. Send-route fix shape — replace lines 343-394

```ts
  // Walt dev-stub fallback — ONLY when both:
  //   1. Not in production (NODE_ENV !== "production")
  //   2. CONTRACT_SERVICE_DEV_FALLBACK explicitly "true"
  // Otherwise: 503. Closes L-0107 silent corruption from line 351.
  if (!sendSucceeded) {
    const isDev = process.env.NODE_ENV !== "production";
    const fallbackEnabled = process.env.CONTRACT_SERVICE_DEV_FALLBACK === "true";

    if (!isDev || !fallbackEnabled) {
      console.error(`[contracts/send] CONTRACT_SERVICE_DOWN: ${sendError ?? "unknown"}`, {
        contract_id: contractId,
        workspace_id: workspaceId,
      });

      void emit({
        event: "contract.send_failed.service_down",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: { entity_type: "employment_contract", entity_id: contractId },
          data: { error: sendError ?? "unknown", contract_id: contractId },
        },
      });

      return NextResponse.json(
        {
          error:
            "Kontrakt-tjenesten er utilgjengelig. Prøv igjen om 1 minutt eller kontakt support.",
          code: "CONTRACT_SERVICE_DOWN",
          retry_after_seconds: 60,
        },
        { status: 503 },
      );
    }

    // Walt dev-stub: existing code preserved, gated by isDev + fallbackEnabled
    sendSucceeded = true;
    // ... [lines 354-393 of current route.ts unchanged inside the gate] ...
  }
```

### 4. Telemetry — `contract.send_failed.service_down`

**`packages/telemetry/src/registry.ts`** interface after line 6386:
```ts
export interface ContractSendFailedServiceDown extends BaseEvent {
  event: "contract.send_failed.service_down";
  properties: {
    entity: EntityRef;
    data: { contract_id: string; error: string };
  };
}
```

Routing entry after line 10609:
```ts
"contract.send_failed.service_down": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "contracts",
},
```

PostHog + logger + activity_trail. NO engine_event (infra failure ≠ workflow trigger). Precedent: `helpdesk.sla.no_observer_resolved` registry.ts:3811.

### 5. ContractDispatchDrawer toast — replace lines 420-424

`res.json()` consumes stream once → parse before branching:

```ts
if (!res.ok) {
  const body = (await res.json()) as { error?: string; code?: string };
  if (res.status === 503 && body.code === "CONTRACT_SERVICE_DOWN") {
    toast.error(
      "Kontrakt-tjenesten er utilgjengelig akkurat nå. Prøv igjen om 1 minutt.",
      {
        action: { label: "Prøv nå", onClick: () => handleSend() },
        duration: 10000,
      },
    );
    return;
  }
  toast.error(body.error ?? "Sending feilet");
  return;
}
```

`handleSend` in scope (line 405). No setTimeout auto-retry.

### 6. Test plan

| # | Setup | Expected |
|---|---|---|
| 1 | docker stop contract-service, NODE_ENV=production, flag unset | 503, toast m/Prøv-nå button, employment_contract unchanged, no stub row |
| 2 | docker stop, NODE_ENV=development, CONTRACT_SERVICE_DEV_FALLBACK=true | 202, walt stub created, employment_contract.status=sent |
| 3 | docker stop, NODE_ENV=production, CONTRACT_SERVICE_DEV_FALLBACK=true | 503 (prod overrides flag) |

E2E stub `apps/e2e/contract-employee/walt-fallback-gate.spec.ts` med 3 `test.todo` — full impl deferred (krever MSW mock).

### 7. Exact line anchors

| Target | File | Lines |
|---|---|---|
| Walt fallback | `apps/web/src/app/api/contracts/send/route.ts` | 343-394 (replace) |
| Toast handler | `apps/web/src/components/contracts/ContractDispatchDrawer.tsx` | 420-424 (replace) |
| Env schema | `apps/web/src/env.ts` | after line 28 |
| Env template | `.env.template` | after line 168 |
| Telemetry interface | `packages/telemetry/src/registry.ts` | after line 6386 |
| Telemetry routing | `packages/telemetry/src/registry.ts` | after line 10609 |

### 8. Disjoint zones — VERIFIED

| Agent | Region | Lines |
|---|---|---|
| SMA-303 (A) | SendBodySchema | 31-36 |
| SMA-305 (B) | 422 response | 188-197 |
| SMA-307 (C) | Walt fallback | 343-394 |

Gap A-B: 151 lines untouched. Gap B-C: 145 lines untouched. 395-426 untouched. **Zero overlap.**

Merge order: C (smallest, bottom) → B (mid) → A (top schema).

---

## Phase 1.A — SMA-303 Design Map

> Explorer: code-analyst | 2026-05-06

### Scope clarification

SMA-303 targets `ContractDispatchDrawer.tsx` (people-page 2-step). Sibling `contract-send-drawer.tsx` already sends `resolved_html` line 246, but Zod strips silently. Adding `resolved_html?` to `SendBodySchema` fixes both drawers.

### 🔥 BLOCKERS (added to scope)

2 contract-service files MUST change — without dem, editert HTML overskrives av server:

1. **`services/contract-service/src/schemas/contracts.ts:3-15`** — `createContractSchema` mangler `resolved_html` field; Zod stripper det
2. **`services/contract-service/src/routes/contracts.ts:80-84`** — `resolvePlaceholders()` overskriver alltid `resolved_html`. Krever bypass-branch

### 1. `contract-preview-editor.tsx` mode-prop refactor

All edit-mode branches finnes ALLEREDE (lines 60, 66-67, 72-76, 80). Kun 2 endringer:

**Lines 30-44** — make `mode` prop:
```diff
 type ContractPreviewEditorProps = {
   contentHtml: string;
   onContentChange: (html: string) => void;
+  mode?: "preview" | "edit";  // default "preview" = bakoverkompatibel
 };

 export function ContractPreviewEditor({
   contentHtml,
   onContentChange,
+  mode = "preview",
 }: ContractPreviewEditorProps) {
   // ...
-  const mode = "preview";  // DELETE
```

**Line 92** — toolbar accepts `"full" | "preview"` (verifisert `editor-toolbar-v2.tsx:30`):
```diff
-<EditorToolbarV2 editor={editor} mode="preview" />
+<EditorToolbarV2 editor={editor} mode={mode === "edit" ? "full" : "preview"} />
```

### 2. Backward-compat callers

`grep "ContractPreviewEditor" apps/web/src/` → 4 filer, 5 mount-sites. Alle uten mode-prop = default "preview" = null behavior change.

| File | Line | Note |
|---|---|---|
| `ContractDispatchDrawer.tsx` | — | iframe i dag → bytter til `mode="edit"` |
| `CompositionDrawer.tsx` | 1046 | default preview, latent bug (out of scope) |
| `contract-send-drawer.tsx` | ~779 | default preview, latent bug (out of scope) |
| `MalerTab.tsx` | 1161 | default preview, oppdater stale comment line 1158 |

### 3. `ContractDispatchDrawer.tsx` Step 2 swap

**3a. Import etter line 64:**
```diff
+import dynamic from "next/dynamic";
+import { EditorSkeleton } from "@/components/ui/editor-skeleton";
+
+const ContractPreviewEditor = dynamic(
+  () => import("@/app/dashboard/contracts/_components/contract-preview-editor")
+    .then((m) => ({ default: m.ContractPreviewEditor })),
+  { ssr: false, loading: () => <EditorSkeleton /> },
+);
```

**3b. Refs etter line 240:**
```diff
+const editedHtmlRef = useRef<string>("");        // tracks Tiptap edits
+const pdfAckdHtmlRef = useRef<string>("");       // snapshot at PDF-ack moment
```
Reset begge i drawer-close effect lines 244-251.

**3c. Init `editedHtmlRef` line 332** når previewHtml resolves:
```diff
  if (!cancelled) setPreviewHtml(html || null);
+ if (!cancelled) editedHtmlRef.current = html || "";
```

**3d. `handlePdfViewed` line 344** — record snapshot:
```diff
  const handlePdfViewed = () => {
    const viewedAt = new Date().toISOString();
+   pdfAckdHtmlRef.current = editedHtmlRef.current;
    setState((prev) => ({ ...prev, pdfPreviewViewedAt: viewedAt }));
    // ... emit unchanged ...
  };
```

**3e. Replace iframe lines 603-608:**
```diff
-<iframe ... srcDoc={`<!doctype html>...${previewHtml}...`} className="h-[280px] w-full bg-white" />
+<ContractPreviewEditor
+  contentHtml={previewHtml ?? ""}
+  mode="edit"
+  onContentChange={(html) => {
+    editedHtmlRef.current = html;
+    // Edit AFTER ack → invalidate (ADR-0244 legal evidence)
+    if (pdfAckdHtmlRef.current && html !== pdfAckdHtmlRef.current) {
+      setState((prev) => ({ ...prev, pdfPreviewViewedAt: null }));
+      pdfAckdHtmlRef.current = "";
+    }
+  }}
+/>
```

**3f. handleSend body lines 412-417:**
```diff
   blocks_acknowledged: Array.from(state.acknowledgedBlocks),
   existing_contract_id: existingContractId ?? null,
+  resolved_html: editedHtmlRef.current || undefined,
 }),
```

**3g. 503 toast handler lines 420-424** — DELT MED SMA-307 owner-overlap. Build-agents må koordinere ELLER SMA-307-agent ownerer hele drawer-error-handler. **Anbefaling: SMA-307 owner gjør 503-handler; SMA-303 gjør resten.**

### 4. `SendBodySchema` extension lines 31-36 (Zone A)

```diff
 const SendBodySchema = z.object({
   template_id: z.string().uuid(),
   target_profile_id: z.string().uuid(),
   blocks_acknowledged: z.array(z.string()).min(1),
   existing_contract_id: z.string().uuid().nullable().optional(),
+  resolved_html: z.string().optional(),
 });
```

Line 77 destructure:
```diff
-const { template_id, target_profile_id, blocks_acknowledged, existing_contract_id } = parsed.data;
+const { template_id, target_profile_id, blocks_acknowledged, existing_contract_id, resolved_html } = parsed.data;
```

### 5. Contract-service bridge (Zone B)

**Search anchor** `callContractService("/contracts"` (unique). Approx line 286 (shift varies med SMA-305 mid-edit):
```diff
   body: JSON.stringify({
     template_id,
     workspace_id: workspaceId,
     contract_type: "employee",
     recipient_name: ...,
     recipient_email: recipientEmail,
+    ...(resolved_html ? { resolved_html } : {}),
   }),
```

### 6. SERVICE files — 2 BLOCKER endringer

**`services/contract-service/src/schemas/contracts.ts:3-15`:**
```diff
 export const createContractSchema = z.object({
   // ...
+  resolved_html: z.string().optional(),
 });
```

**`services/contract-service/src/routes/contracts.ts:70-84`** — bypass:
```diff
-const { resolved_html, resolved_values } = await resolvePlaceholders(
-  template.content_html ?? "",
-  placeholders, body.workspace_id,
-  { ...body.value_overrides, contract_number: contractNumber },
-);
+let resolved_html: string;
+let resolved_values: Record<string, string>;
+if (body.resolved_html) {
+  // BFF sanitiserte allerede via HTML_SANITIZE_OPTIONS
+  resolved_html = body.resolved_html;
+  resolved_values = body.value_overrides ?? {};
+} else {
+  ({ resolved_html, resolved_values } = await resolvePlaceholders(
+    template.content_html ?? "",
+    placeholders, body.workspace_id,
+    { ...body.value_overrides, contract_number: contractNumber },
+  ));
+}
```

Service har IKKE egen sanitize-html — BFF er gate, service er bak. OK defense-posture.

### 7. Sanitize allowlist verification

`HTML_SANITIZE_OPTIONS` `apps/web/src/app/api/contracts/route.ts:22-55` dekker ALLE 6 Tiptap-extensions:

| Tiptap output | Allowed |
|---|---|
| `<span data-type="signature-field">` | ✅ |
| `<span data-type="date-field">` | ✅ |
| `<div data-type="clause-block">` | ✅ |
| `<div data-clause-id="...">` | ✅ |
| `<section data-type="...">` | ✅ |

Null gaps. **Anbefaling:** ekstrakt `HTML_SANITIZE_OPTIONS` til `apps/web/src/lib/contract-html-sanitize.ts` for shared use mellom `route.ts` + `send/route.ts`.

### 8. PDF-gate hash flow (ref-comparison, not SHA-256)

1. Template loads → `editedHtmlRef.current = resolvedHtml`
2. Admin reads/edits → `onUpdate` fires `editedHtmlRef.current = editor.getHTML()`
3. "Jeg har lest gjennom" → `pdfAckdHtmlRef.current = editedHtmlRef.current` + `pdfPreviewViewedAt = now`
4. `canSend` gate på `pdfPreviewViewedAt` (line 403, allerede riktig)
5. Edit etter ack → `onContentChange` ser `html !== pdfAckdHtmlRef.current` → reset `pdfPreviewViewedAt = null` → ack påkrevd igjen
6. Send → `editedHtmlRef.current` (final ack'd) i body

ADR-0244 satisfied. Mønster matcher `contract-send-drawer.tsx` sibling.

### 9. Recommended commit order (sub-branch `feat/contract-dispatch-ux-pass-303-preview-edit`)

1. `apps/web/src/lib/contract-html-sanitize.ts` (NEW) — extract allowlist
2. `apps/web/src/app/api/contracts/route.ts` — import fra new file
3. `services/contract-service/src/schemas/contracts.ts` — add `resolved_html?`
4. `services/contract-service/src/routes/contracts.ts` — bypass branch
5. `apps/web/src/app/api/contracts/send/route.ts` — Zone A (schema + destructure) + Zone B (service POST body) i SAMME commit
6. `apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx` — mode prop
7. `apps/web/src/components/contracts/ContractDispatchDrawer.tsx` — full Step 2 swap + handleSend (delegere 503 til SMA-307)

---

## Phase 1.B — SMA-305 Design Map

> Explorer: code-analyst | 2026-05-06

### KRITISK SCOPE-OPPDATERING

Eksisterende 422 lines 188-197 = **different error** ("missing draft row"). SMA-305 berører IKKE den. Ny PII-gate insertes etter line 103, profile SELECT line 93 utvides.

### 1. `submit_own_pii` source

`supabase/migrations/20260503120000_submit_own_pii_rpc.sql`. Signature `(p_workspace_id UUID, p_field_group TEXT, p_values JSONB) RETURNS JSONB`. SECURITY DEFINER + `SET search_path = public` ONLY (mangler `extensions` — new RPC MUST add per L-0172). Resolves profile_id fra `auth.uid() + p_workspace_id` (lines 27-33). Writes `profile.{personal_number, bank_account, address_*, postal_code, city}`. Audit til `activity_trail` med `actor_id = profile_id` (NOT `auth.uid()`).

### 2. `admin_submit_employee_pii` RPC spec

**File:** `supabase/migrations/20260526010000_admin_submit_employee_pii_rpc.sql` (NEW)

**Helper signature** verifisert `00004_rls_policies.sql:33` + fix-migration `20260515170100_fix_is_admin_in_workspace_signature.sql`:
```sql
public.is_admin_in_workspace(uid uuid, wid uuid) RETURNS boolean
-- ⚠️ uid first, wid second
```

**Full RPC:**
```sql
CREATE OR REPLACE FUNCTION public.admin_submit_employee_pii(
  p_workspace_id          UUID,
  p_target_profile_id     UUID,
  p_field_group           TEXT,    -- 'identity' | 'banking' | 'address' | 'employment' (reserved)
  p_values                JSONB,
  p_high_pii_acknowledged BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_uid UUID;
  v_actor_profile_id UUID;
BEGIN
  -- Step 1: Auth check
  v_actor_uid := auth.uid();
  IF v_actor_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Step 2: Resolve admin profile (single query w/ role check)
  SELECT profile_id INTO v_actor_profile_id
  FROM public.profile
  WHERE user_id = v_actor_uid
    AND workspace_id = p_workspace_id
    AND role IN ('admin', 'owner')
    AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not admin/owner in workspace %', p_workspace_id;
  END IF;

  -- Step 3: Cross-workspace fail-fast (L-0177 + ADR-0151)
  PERFORM 1 FROM public.profile
  WHERE profile_id = p_target_profile_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile % not in workspace % — cross-workspace blocked',
      p_target_profile_id, p_workspace_id;
  END IF;

  -- Step 4: Høy-PII ack gate
  IF p_field_group IN ('identity', 'banking')
     AND NOT COALESCE(p_high_pii_acknowledged, false) THEN
    RAISE EXCEPTION 'High-PII group % requires p_high_pii_acknowledged = true', p_field_group;
  END IF;

  -- Step 5: Validate group
  IF p_field_group NOT IN ('identity', 'banking', 'address', 'employment') THEN
    RAISE EXCEPTION 'Invalid field_group: %', p_field_group;
  END IF;

  -- Step 6: Write per group
  CASE p_field_group
    WHEN 'identity' THEN
      UPDATE public.profile SET personal_number = p_values->>'personal_number', updated_at = now()
        WHERE profile_id = p_target_profile_id;
    WHEN 'banking' THEN
      UPDATE public.profile SET bank_account = p_values->>'bank_account', updated_at = now()
        WHERE profile_id = p_target_profile_id;
    WHEN 'address' THEN
      UPDATE public.profile SET
        address_line_1 = p_values->>'address_line_1',
        address_line_2 = p_values->>'address_line_2',
        postal_code = p_values->>'postal_code',
        city = p_values->>'city',
        updated_at = now()
        WHERE profile_id = p_target_profile_id;
    WHEN 'employment' THEN
      RAISE EXCEPTION 'employment group not implemented — separate sortie';
  END CASE;

  -- Step 7: Audit (NEVER log field values — only group + count)
  INSERT INTO public.activity_trail (
    workspace_id, actor_id, event, action_verb, category, entity_type, entity_id, data
  ) VALUES (
    p_workspace_id, v_actor_profile_id,
    'payroll.admin_filled_pii', 'admin_action', 'compliance',
    'profile', p_target_profile_id,
    jsonb_build_object(
      'field_group', p_field_group,
      'field_count', jsonb_object_length(p_values),
      'high_pii_acknowledged', p_high_pii_acknowledged,
      'admin_profile_id', v_actor_profile_id
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'field_group', p_field_group, 'target_profile_id', p_target_profile_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_submit_employee_pii TO authenticated;
```

### 3. NEW PII-gate i `send/route.ts` — IKKE 188-197

**Profile SELECT line 93 utvides:**
```diff
-.select("profile_id, display_name")
+.select("profile_id, display_name, personal_number, bank_account, address_line_1, postal_code")
```

**INSERT etter line 103, før line 125 (`frameworkBinding`):**
```ts
type MissingField = { field: string; label_no: string; section: string; tier: "lav" | "medium" | "hoy" };
const missingPii: MissingField[] = [];
if (!targetProfile.personal_number)
  missingPii.push({ field: "personal_number", label_no: "Personnummer", section: "Personalia", tier: "hoy" });
if (!targetProfile.bank_account)
  missingPii.push({ field: "bank_account", label_no: "Kontonummer", section: "Økonomi", tier: "hoy" });
if (!targetProfile.address_line_1 || !targetProfile.postal_code)
  missingPii.push({ field: "address", label_no: "Adresse", section: "Adresse", tier: "lav" });

if (missingPii.length > 0) {
  return NextResponse.json(
    {
      error: "missing_employment_data",
      user_message_no: "Ansattes profil mangler nødvendig informasjon for å sende kontrakt.",
      missing_fields: missingPii,
      blockers: [{ rule_id: "pii-completeness", message: `Mangler: ${missingPii.map(f => f.field).join(", ")}` }],
    },
    { status: 422 },
  );
}
```

### 4. NEW endpoint `/api/contracts/admin-fill-pii/route.ts`

POST body:
```ts
const AdminFillPiiBodySchema = z.object({
  target_profile_id: z.string().uuid(),
  field_group: z.enum(["identity", "banking", "address"]),
  values: z.record(z.string(), z.string()),
  high_pii_acknowledged: z.boolean().optional().default(false),
});
```

Handler: createClient → getUser → resolve actor (workspace + role check) → 401/403 → parse body → call `supabase.rpc('admin_submit_employee_pii', {...})` → catch RPC exception messages (`'High-PII'` → 422, `'cross-workspace'` → 403) → emit `payroll.admin_filled_pii` (count only, NO values) → return `{success, field_group}`.

### 5. `MissingInfoSheet.tsx` (NEW) — KOMPONENT

Props: `{open, onOpenChange, missing_fields, target_profile_id, target_display_name, workspace_id, actor_profile_id, on_filled}`.

Group inputs by `section`. Per-field validation onBlur via `validatePersonnummer` + `validateNorwegianBankAccount` fra `@smartout/utils`. Høy-tier inputs vises med `<Lock />`-icon + "Krever bekreftelse"-hint. Submit:
1. Hvis høy-PII har value → åpne `<Dialog>` confirmation:
   > "Bekreft at [target_display_name] har gitt eksplisitt tillatelse til at du legger inn følgende sensitive opplysninger på vegne av dem. Dette logges i audit-trail."
   > [Avbryt] [Bekreft og lagre]
2. Bekreft → POST per field_group til `/api/contracts/admin-fill-pii` med `high_pii_acknowledged: true` for høy-tier
3. Etter alle saved → `on_filled()`

**⚠️ BLOCKER:** `<Sheet>` nested i `<Sheet>` (drawer) kan gi z-index stacking-issues. **Fallback: bruk `<Dialog>` for nested surface** (sikrere for nested).

### 6. `ContractDispatchDrawer.tsx` integrasjon

**handleSend line 421** — utvid err-type:
```ts
const err = (await res.json()) as {
  error?: string;
  user_message_no?: string;
  missing_fields?: Array<{ field: string; label_no: string; section: string; tier: string }>;
};
```

**Etter line 422, før return:**
```ts
if (err.error === "missing_employment_data" && err.missing_fields?.length) {
  setMissingFields(err.missing_fields);
  setMissingInfoSheetOpen(true);
  return;
}
```

State + JSX `<MissingInfoSheet on_filled={() => { setMissingInfoSheetOpen(false); emit('contract.send_retry_after_fill'); handleSend(); }} />`.

### 7. ADR-0077 amendment

**File:** `docs/decisions/0077-contract-intake-pii-handling.md` (append etter line 176, IKKE overwrite).

Tier-tabell:
| Group | Fields | Tier | Condition |
|---|---|---|---|
| identity | personal_number | Høy | UI ack + audit-trail mandatory |
| banking | bank_account | Høy | UI ack + audit-trail mandatory |
| address | address_line_1, postal_code, city | Lav | No ack required |
| employment | reserved | Medium | Not implemented |

Lovsen prod-flag: høy-PII admin-fill = gråsone Personopplysningsloven §10. Krever advokat sign-off før prod (technical enforcement is in place; legal approval separate).

Legal basis: GDPR Art. 6(1)(b) + Pol. §10 + Aml. §14-6.

### 8. Telemetry registry

`packages/telemetry/src/registry.ts`:

**Interfaces (etter line 6337):** `ContractSendBlockedMissingFields`, `PayrollAdminFilledPii`, `ContractSendRetryAfterFill`.

**Union (line 7148+):** add 3 union members.

**EVENT_META (før line 11058):**
```ts
"contract.send_blocked.missing_fields": { destinations: ["posthog", "logger", "activity_trail"], category: "contracts" },
"payroll.admin_filled_pii": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "contracts" },
"contract.send_retry_after_fill": { destinations: ["posthog", "logger"], category: "contracts" },
```

`payroll.admin_filled_pii` = 4 destinations (compliance event, engine_event for downstream onboarding reactions per ADR-0004).

### 9. Conflict zones — UPDATED

| SMA | Zone | Pre-edit lines |
|---|---|---|
| SMA-303 (A) | SendBodySchema + resolved_html? | 31-36 + 77 |
| SMA-305 (B) | Profile SELECT extend (line 93) + NEW PII gate INSERT after line 103 | NEW insertion ~104 |
| SMA-307 (C) | Walt fallback gate | 343-394 |

**SMA-305 inserts ~15 lines etter 104** → SMA-307 lines 343-394 shifter til ~358-409.
SMA-303 lines 31-36 påvirkes ikke (over insertion).

**Merge order revised:** SMA-307 first (bottom isolated, no drift) → SMA-305 (insert ~104) → SMA-303 (top schema 31-36 + service files + bridge in send/route Zone B).

### 10. Backward-compat note for SMA-305

Eksisterende `submit_own_pii` (employee self-fill) IKKE påvirket — admin RPC er parallel surface. Ingen migration drift.
