---
title: Employee-Contract Telemetry Verification
date: 2026-05-05
branch-verified: feat/services-employee-contract (merged ~2026-04-28)
auditor: chore/telemetry-verification-2026-05-05
---

# Employee-Contract Telemetry Verification — 2026-05-05

Verification of 17 telemetry events introduced by feat/services-employee-contract (the prompt
listed "16 events" but the enumeration contains 17; all 17 are verified below).

---

## 1. Per-Event Registry Table

All checks performed against `packages/telemetry/src/registry.ts`.

| Event | Interface | Union | Routing (non-empty destinations) | Callers |
|---|---|---|---|---|
| `contracts.template.viewed` | ✅ L2248 (`ContractTemplateViewed`) | ✅ L7064 | ✅ L8578 — posthog, logger, activity_trail | 1 |
| `contracts.template.html_copied` | ✅ L2261 (`ContractTemplateHtmlCopied`) | ✅ L7065 | ✅ L8582 — posthog, logger, activity_trail | 1 |
| `contracts.template.opened_in_admin` | ✅ L2272 (`ContractTemplateOpenedInAdmin`) | ✅ L7066 | ✅ L8586 — posthog, logger, activity_trail | 1 |
| `contracts.template.cloned` | ✅ L2282 (`ContractTemplateCloned`) | ✅ L7067 | ✅ L8590 — posthog, logger, activity_trail, engine_event | 1 |
| `contracts.detail.viewed` | ✅ L2356 (`ContractDetailViewed`) | ✅ L7068 | ✅ L8594 — posthog, logger, activity_trail | 2 |
| `contracts.resend.submitted` | ✅ L2299 (`ContractResendSubmitted`) | ✅ L7069 | ✅ L8598 — posthog, logger, activity_trail, engine_event | 1 |
| `contracts.cancel.dialog_opened` | ✅ L2310 (`ContractCancelDialogOpened`) | ✅ L7070 | ✅ L8602 — posthog, logger, activity_trail | 1 |
| `contracts.cancel.confirmed` | ✅ L2322 (`ContractCancelConfirmed`) | ✅ L7071 | ✅ L8606 — posthog, logger, activity_trail, engine_event | 1 |
| `contracts.cancel.aborted` | ✅ L2334 (`ContractCancelAborted`) | ✅ L7072 | ✅ L8610 — posthog, logger, activity_trail | 1 |
| `contracts.cancel.failed` | ✅ L2345 (`ContractCancelFailed`) | ✅ L7073 | ✅ L8614 — posthog, logger, activity_trail | 1 |
| `contracts.send.submitted` | ✅ L2393 (`ContractSendSubmitted`) | ✅ L7076 | ✅ L8626 — posthog, logger, activity_trail, engine_event | 1 |
| `contracts.bulk.submitted` | ✅ L2407 (`ContractBulkSubmitted`) | ✅ L7077 | ✅ L8630 — posthog, logger, activity_trail, engine_event | 1 |
| `contracts.compose.opened` | ✅ L2191 (`ContractComposeOpened`) | ✅ L7078 | ✅ L8634 — posthog, logger, activity_trail, engine_event | 1 |
| `contracts.compose.submitted` | ✅ L2204 (`ContractComposeSubmitted`) | ✅ L7079 | ✅ L8638 — posthog, logger, activity_trail, engine_event | 1 |
| `forms.unsaved_guard.shown` | ✅ L2423 (`FormsUnsavedGuardShown`) | ✅ L7080 | ✅ L8644 — posthog, logger, activity_trail | 3 |
| `forms.unsaved_guard.discarded` | ✅ L2433 (`FormsUnsavedGuardDiscarded`) | ✅ L7081 | ✅ L8648 — posthog, logger, activity_trail | 3 |
| `forms.unsaved_guard.kept` | ✅ L2443 (`FormsUnsavedGuardKept`) | ✅ L7082 | ✅ L8652 — posthog, logger, activity_trail | 3 |

### Caller locations

| Event | Caller file(s) |
|---|---|
| `contracts.template.viewed` | `_components/MalerTab.tsx:913` |
| `contracts.template.html_copied` | `_components/MalerTab.tsx:956` |
| `contracts.template.opened_in_admin` | `_components/MalerTab.tsx:981` |
| `contracts.template.cloned` | `_components/MalerTab.tsx:376` |
| `contracts.detail.viewed` | `_components/contracts-data-table.tsx:294`, `contracts/[id]/page.tsx:119` |
| `contracts.resend.submitted` | `_components/contracts-data-table.tsx:327` |
| `contracts.cancel.dialog_opened` | `_components/contracts-data-table.tsx:353` |
| `contracts.cancel.confirmed` | `_components/contracts-data-table.tsx:478` |
| `contracts.cancel.aborted` | `_components/contracts-data-table.tsx:379` |
| `contracts.cancel.failed` | `_components/contracts-data-table.tsx:498` |
| `contracts.send.submitted` | `_components/contract-send-drawer.tsx:285` |
| `contracts.bulk.submitted` | `src/components/contracts/BulkSendDrawer.tsx:172` |
| `contracts.compose.opened` | `contracts/page.tsx:90` |
| `contracts.compose.submitted` | `_hooks/use-employment-contracts.ts:109` |
| `forms.unsaved_guard.shown` | `BulkSendDrawer.tsx:113`, `CompositionDrawer.tsx:177`, `contract-send-drawer.tsx:146` |
| `forms.unsaved_guard.discarded` | `BulkSendDrawer.tsx:225`, `CompositionDrawer.tsx:320`, `contract-send-drawer.tsx:386` |
| `forms.unsaved_guard.kept` | `BulkSendDrawer.tsx:212`, `CompositionDrawer.tsx:307`, `contract-send-drawer.tsx:373` |

All paths under `apps/web/src/app/dashboard/contracts/` unless otherwise noted.

---

## 2. Actor-ID Integrity Check — `use-employment-contracts.ts`

File: `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts`

| Check | Result | Evidence |
|---|---|---|
| `actor_profile_id` is REQUIRED in `ComposeInput` | **PASS** | L69: `actor_profile_id: string;` — no `?` |
| `emit()` uses `variables.actor_profile_id` with no `?? variables.profile_id` fallback | **PASS** | L111: `actor_id: nonEmpty(variables.actor_profile_id, "actor_id")` — no fallback, will throw on empty |
| Event name is `'contracts.compose.submitted'` (dot-notation, no legacy string) | **PASS** | L109: `event: "contracts.compose.submitted"` |

Note: `useSendContract` (L153–184) deliberately does NOT emit `contracts.send.submitted` from the
client hook — the comment at L174 states the server route owns that emit to guarantee
workspace_id correctness. The client-side emit is separately handled in `contract-send-drawer.tsx:285`
which has the actor context from the component. This is intentional — not a gap.

---

## 3. Orphan Registry Entries

**Zero orphans.** Every registered event has at least one call site in `apps/web/src`.

---

## 4. Count Discrepancy Note

The task prompt states "16 events" but enumerates 17 (contracts.template.viewed through
forms.unsaved_guard.kept). All 17 were verified. No event was skipped.

---

## 5. Verdict

**GREEN**

- All 17 events have an exported TypeScript interface extending `BaseEvent` with the correct event-name literal string.
- All 17 are members of the `SmartoutEvent` union type.
- All 17 have an entry in `EVENT_ROUTING` with a non-empty `destinations` array (minimum 3 destinations each).
- All 17 have at least one `emit()` call site in `apps/web/src`.
- `actor_profile_id` in `ComposeInput` is required (not optional), used without fallback, and the event name matches the registry. Actor-ID integrity is sound.
- No orphan registry entries detected.
