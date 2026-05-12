---
title: "Handoff — payroll-phase-4 (PDF Lønnsgrunnlag)"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [handoff, payroll, phase-4, pdf, lonnsgrunnlag, react-pdf, signed-url, mobile, bundle]
---

# Handoff — payroll-phase-4

> Branch: `feat/payroll-payroll-phase-2` (combined Phase 2+3+4 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1`
> 15 commits since Phase 4 plan declared (7f05d1654). All typecheck green: web + @smartout/ai + @smartout/mobile + @smartout/payroll-export + @smartout/telemetry. 70 vitest tests green (55 Phase 3 + 15 new PDF golden tests).

---

## What was built

### Foundation — `@smartout/payroll-export` PDF extension

| Item | File | Status |
|------|------|--------|
| Core PDF generator | `packages/payroll-export/src/pdf.ts` | Live |
| Root PDF template | `packages/payroll-export/src/pdf/LonnsgrunnlagDocument.tsx` | Live |
| Header component | `packages/payroll-export/src/pdf/components/Header.tsx` | Live |
| EmployeeBlock | `packages/payroll-export/src/pdf/components/EmployeeBlock.tsx` | Live |
| HoursTable | `packages/payroll-export/src/pdf/components/HoursTable.tsx` | Live |
| SupplementsTable | `packages/payroll-export/src/pdf/components/SupplementsTable.tsx` | Live |
| TipsTable | `packages/payroll-export/src/pdf/components/TipsTable.tsx` | Live |
| TotalsBlock | `packages/payroll-export/src/pdf/components/TotalsBlock.tsx` | Live |
| Footer (disclaimer + SHA-256) | `packages/payroll-export/src/pdf/components/Footer.tsx` | Live |
| Golden tests (15 tests) | `packages/payroll-export/src/__tests__/pdf.test.ts` | Live, 15 green |
| Storage bucket migration | `supabase/migrations/<ts>_payroll_phase4_storage_bucket.sql` | Live |
| Telemetry (3 events) | `packages/telemetry/src/registry.ts` | Live |
| ADR-0294 | `docs/decisions/0294-payroll-pdf-library.md` | accepted |

### Capability — `@smartout/ai` extension

| Item | File | Status |
|------|------|--------|
| `export_period` extended for `format='pdf'` | `packages/ai/src/capabilities/payroll/tools.ts` | Live |
| `view_lonnsgrunnlag` read-only tool (NEW) | `packages/ai/src/capabilities/payroll/tools.ts` | Live, in readOnlyTools |

### BFF routes

| Route | Method | File | Status |
|-------|--------|------|--------|
| `/api/payroll/generate-pdf-bundle` | POST | `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts` | Live |
| `/api/payroll/generate-pdf-single` | POST | `apps/web/src/app/api/payroll/generate-pdf-single/route.ts` | Live |
| `/api/payroll/lonnsgrunnlag-url` | GET | `apps/web/src/app/api/payroll/lonnsgrunnlag-url/route.ts` | Live |

### Web UI

| Item | File | Status |
|------|------|--------|
| ExportTab — PDF lønnsgrunnlag section | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx` | Live |
| LineDrawer — "Last ned PDF" action | `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` | Live |
| My-salary list page | `apps/web/src/app/dashboard/my-salary/page.tsx` | Live |
| My-salary viewer page | `apps/web/src/app/dashboard/my-salary/[lonnsgrunnlagId]/page.tsx` | Live |
| Hook: useGenerateBundle, useGenerateSingle, useLonnsgrunnlagUrl | `_hooks/use-payroll-lonnsgrunnlag.ts` | Live |

### Mobile UI

| Item | File | Status |
|------|------|--------|
| `lonnsgrunnlag-detail.tsx` (expo-linking viewer) | `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx` | Live |
| `index.tsx` extension (lønnsgrunnlag list) | `apps/mobile/app/(app)/(me)/payroll/index.tsx` | Live |
| `use-lonnsgrunnlag.ts` hook | `apps/mobile/src/hooks/queries/use-lonnsgrunnlag.ts` | Live |

---

## Decisions

| ADR | Summary | Status |
|-----|---------|--------|
| ADR-0294 | `@react-pdf/renderer` chosen for server-side lønnsgrunnlag PDF generation. Alternatives rejected: Puppeteer (headless browser dep), pdfkit (no JSX), Remotion (video-first). SHA-256 hashes content, not PDF bytes. Footer MUST contain disclaimer. | accepted |

No additional Phase 4 ADRs. Phase 4 reused ADR-0204 (gate_action), ADR-0151 (server-side auth), ADR-0240 (cross-namespace write prohibition), ADR-0078 (channel guard for PII), ADR-0134 (telemetry), ADR-0294.

---

## Learnings

**L1 — `@react-pdf/renderer` CreationDate makes PDF bytes non-deterministic; SHA must hash content not bytes.**
`renderToBuffer()` embeds a `CreationDate` from the system clock. Identical inputs produce different byte sequences across runs, making SHA-256 of the buffer unstable. Solution: `computeFileHash` hashes a canonical JSON string of the monetary fields + period/workspace opts — stable across identical inputs. The SHA is embedded in the PDF `Keywords` metadata field and printed in the Footer. ADR-0294 documents this trade-off. Alternative if determinism is required: pass a fixed `creationDate` to the PDF template; the `@react-pdf/renderer` API does support this via Document `subject`/`author` props but not `CreationDate` natively.

**L2 — Telemetry EntityType union extension is costly; discriminator in data field is cheaper for additive events.**
Phase 3 required adding `"payroll_export_event"` to the `EntityType` union in `registry.ts`. Phase 4 reused the same entity type with `format: "pdf"` as a discriminator in the event `data` payload. This avoided another union extension and kept the registry clean. Pattern: reuse existing entity types + add a `format` or `kind` discriminator in the data payload when the new event is semantically the same entity.

**L3 — Tool-reuse from BFF via synthetic AgentToolContext requires NonEmptyString casts at the BFF/tool boundary.**
`lonnsgrunnlag-url/route.ts` constructs a synthetic `AgentToolContext` and invokes `viewLonnsgrunnlag.execute()` directly. The `workspaceId` and `profileId` fields use the `NonEmptyString` branded type from `@smartout/telemetry`. The cast `auth.workspaceId as NonEmptyString` is acceptable here because `resolvePayrollAuth` already validates both IDs are non-empty (it returns `null` otherwise). This pattern also required adding `capabilities/payroll/tools` as a named subpath export in `packages/ai/package.json` (precedent: `capabilities/legal/tools`).

**L4 — Mobile WebView absent — use Linking.openURL for PDF; the trade-off is the user leaves the app.**
`react-native-webview` is not in the mobile dependency tree. `expo-linking.openURL()` hands the signed URL to iOS/Android which opens the PDF in the native Files app, Safari, or the default PDF handler. The trade-off: no inline rendering, user momentarily leaves the app. Benefit: zero new dependencies, works offline once the OS caches the PDF, respects system PDF access-control. If inline rendering is required in a future phase, add `react-native-webview` as a dedicated Wave in Phase 5+.

**L5 — `payroll.export_event` schema gap: `exported_by` is actor, not target employee.**
The `exported_by` column records the admin who triggered the export, not the employee the PDF is for. The `my-salary` list query (`MySalaryListClient`) filters `exported_by = profileId` — this works for employee self-generated PDFs but means admin-generated per-employee PDFs do not appear in the employee's own list unless a second column (`target_profile_id`) is added. Phase 4.5 follow-up: add `target_profile_id` column to `payroll.export_event` and update the `my-salary` list query to filter by `target_profile_id = profileId`.

**L6 — Parallel Wave agents with Skill-only personas fail when BFF/package writes are needed.**
Wave D (mobile) was assigned to an agent without Bash/Write tools. The agent could not run typecheck, write files, or verify package paths. Rule: any Wave needing Read/Write/Bash (BFF routes, package files, typecheck verification) must use `botsson-harness-builder` or equivalent; never a skill-only frontend persona.

---

## Known Issues / Debt

| Issue | Impact | Suggested fix |
|-------|--------|---------------|
| **DEFERRED — `database.types.ts` regen** | `any` casts in Phase 3+4 BFF routes. TS safety reduced for `payroll.export_event` columns (`export_format`, `masked`, `file_hash`, etc.). | Run `pnpm gen:types` against local Supabase (no `op run`) before merge. Remove all `as any` casts. |
| **DEFERRED — `target_profile_id` column** | Employee cannot see admin-generated PDFs in their own `my-salary` list unless they are the `exported_by` actor. | Phase 4.5: `ALTER TABLE payroll.export_event ADD COLUMN target_profile_id UUID REFERENCES profile(profile_id)`. Update `my-salary` list query. |
| **DEFERRED — `export_event_line` per-row INSERTs** | Audit-replay requires re-running generator. Acceptable for Phase 4; revisit if Tripletex requires pre-materialized snapshot. | Phase 4.5: INSERT `AuditRow` payloads into `payroll.export_line` during PDF generation. |
| **UNMEASURED — PDF render latency for 12-employee bundle** | Acceptance criterion: <5s for 12-employee bundle. Not measured in automated e2e (no seeded locked period). | Run against populated local Supabase; time `generateBundlePdfs` directly in a unit test with 12 fixture rows. |
| **SKIPPED — E2E Group B (PDF download round-trip)** | Group B in `payroll-phase-4-pdf-bundle.spec.ts` skipped. Requires locked period + calc rows in seed + `E2E_LOCKED_PERIOD_ID` env var. | Add locked payroll period to `apps/e2e/helpers/seed.ts`. Phase 3 carry extends to Phase 4. |
| **CARRIED — Phase 2 ManualSupplementForm delete-button** | Manager cannot delete a supplement from UI. Backend route ready. | Add delete button + ConfirmModal to LineDrawer (manual_adj rows only). |
| **CARRIED — T7.2 recalc latency unmeasured (Phase 2)** | <2s target unverified. | Run `/api/payroll/_smoke/recalc-latency` against live Supabase before Phase 1.5. |

---

## Deviations from plan

- **SHA-256 = content-hash, not PDF-bytes-hash.** `@react-pdf/renderer` embeds a system-clock `CreationDate`, making PDF buffer non-deterministic. SHA computed over canonical JSON of monetary fields + period/workspace opts. Stable across identical inputs. Embedded in PDF Keywords metadata. ADR-0294 documents the trade-off.
- **EntityType reuse.** New telemetry events reuse `payroll_export_event` entity type with `format: "pdf"` discriminator in data. No new EntityType union member needed.
- **Mobile viewer is expo-linking (system browser / Files app), not WebView.** `react-native-webview` is absent from the mobile dep tree. Linking.openURL hands the signed URL to the OS. Trade-off: no inline rendering, zero new deps.
- **`payroll.export_event.exported_by` is actor (not target).** MySalaryListClient queries by `exported_by = profile_id`. Admin-generated per-employee PDFs do not appear in the employee list until a `target_profile_id` column is added (Phase 4.5 follow-up).
- **Tool-reuse for signed URL.** `lonnsgrunnlag-url` BFF delegates to `view_lonnsgrunnlag.execute()` via synthetic AgentToolContext. Required adding `capabilities/payroll/tools` subpath export to `packages/ai/package.json`.
- **`file_hash` for bundle.** Computed as `computeFileHash(pdfBundle.map(b => b.sha256).join("\n"))` — a SHA-256 of the concatenated per-file SHA strings. Stable for the same set of inputs; changes if any employee's numbers change.

---

## Next steps

1. **Phase 4 close-out:** Regen `database.types.ts`, remove `any` casts, run Group B E2E with seeded locked period + `E2E_LOCKED_PERIOD_ID`.
2. **Phase 4.5 (target_profile_id):** Add `target_profile_id` column to `payroll.export_event`; update MySalaryListClient query; enable employee to see admin-generated PDFs in their list.
3. **Phase 5 (Skatteetaten / PII reveal):** Employee self-service lønnsgrunnlag on `/dashboard/my-salary`; API call to Skatteetaten for tax data.
4. **Phase 7 (Tripletex push-sync):** Push lønnsgrunnlag data + PDF references to Tripletex via API.
5. **Phase 8 (Recalc orchestration):** Replace Pattern B sync-chain blocks with Pattern A Event Engine handlers (`engine_dispatch`).

---

## Commit SHAs (Phase 4)

| Wave | Content | SHA |
|------|---------|-----|
| Wave A | ADR-0294 | b8c575335 |
| Wave A | pdf.ts + LonnsgrunnlagDocument.tsx + 7 sub-components | 6ba53ac86 |
| Wave A | Golden tests (15 PDF tests) | b82254e21 |
| Wave A | Storage bucket migration | 76883a06f |
| Wave A | Telemetry 3 events | c5adc821b |
| Wave B | export_period extended for format='pdf' + view_lonnsgrunnlag tool | 77cc3ad3a |
| Wave B | /api/payroll/generate-pdf-single | 637437bb8 |
| Wave B | /api/payroll/lonnsgrunnlag-url | 7427919ab |
| Wave C | use-payroll-lonnsgrunnlag hook | acc71d825 |
| Wave C | ExportTab PDF section | 4cbab1736 |
| Wave C | LineDrawer "Last ned PDF" action | 9a599dc4d |
| Wave C | /dashboard/my-salary list + viewer + generate-pdf-bundle BFF | 7eef750ca |
| Wave D | use-lonnsgrunnlag hook + BFF URL helper | b9f4eec59 |
| Wave D | lonnsgrunnlag-detail.tsx (expo-linking viewer) | f02ab058e |
| Pre-existing fix | lint in payroll capability tools.ts | b4e04506a |

---

## Files changed (key paths by layer)

### L4 — AI capability
- `packages/ai/src/capabilities/payroll/tools.ts` (export_period + view_lonnsgrunnlag)
- `packages/ai/package.json` (capabilities/payroll/tools subpath export)

### L4 — Package extension
- `packages/payroll-export/src/pdf.ts`
- `packages/payroll-export/src/pdf/LonnsgrunnlagDocument.tsx`
- `packages/payroll-export/src/pdf/components/Header.tsx`
- `packages/payroll-export/src/pdf/components/EmployeeBlock.tsx`
- `packages/payroll-export/src/pdf/components/HoursTable.tsx`
- `packages/payroll-export/src/pdf/components/SupplementsTable.tsx`
- `packages/payroll-export/src/pdf/components/TipsTable.tsx`
- `packages/payroll-export/src/pdf/components/TotalsBlock.tsx`
- `packages/payroll-export/src/pdf/components/Footer.tsx`
- `packages/payroll-export/src/__tests__/pdf.test.ts` (15 golden tests)

### L2 — BFF routes
- `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts`
- `apps/web/src/app/api/payroll/generate-pdf-single/route.ts`
- `apps/web/src/app/api/payroll/lonnsgrunnlag-url/route.ts`

### L1 — Web UI
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx`
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx`
- `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-lonnsgrunnlag.ts`
- `apps/web/src/app/dashboard/my-salary/page.tsx`
- `apps/web/src/app/dashboard/my-salary/[lonnsgrunnlagId]/page.tsx`

### L1 — Mobile UI
- `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx`
- `apps/mobile/app/(app)/(me)/payroll/index.tsx`
- `apps/mobile/src/hooks/queries/use-lonnsgrunnlag.ts`

### L5 — Migrations + Telemetry
- `supabase/migrations/<ts>_payroll_phase4_storage_bucket.sql`
- `packages/telemetry/src/registry.ts` (3 Phase 4 events)

### Decisions
- `docs/decisions/0294-payroll-pdf-library.md`
