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
