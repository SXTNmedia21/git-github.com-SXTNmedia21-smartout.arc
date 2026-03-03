---
title: "User Journeys — DailyCloseEngine"
status: done
updated: 2026-03-04
created: 2026-03-04
module: operations
tags: [daily-close, reconciliation, settlement, ocr, engine, journeys]
---

# User Journeys — DailyCloseEngine

> Feature branch: `feat/daily-standup` | ADR: ADR-0043

---

## Journey: Employee — Complete Daily Close-Out

**Precondition:** Employee has a scheduled shift that is ending. Department session exists for today with status `active` or `pending_signoff`. A `daily_reconciliation` record exists for the department+date with status `open`.

1. Employee navigates to `/dashboard/close` --> System loads the `CloseOutFlow` component with a 4-step stepper (Sjekkliste, Oppgjorsbilder, Gjennomgang, Send inn) --> Employee sees step 1 active, all other steps grayed out
2. Employee completes closing checklist items (micka, lock cash, check fridge temp, security) --> System tracks completion state locally --> ChecklistSection shows green checkmarks for each completed item
3. Employee clicks "Neste" (Next) when checklist is complete --> System enables step 2 --> Employee sees the `ImageUpload` component
4. Employee selects source type (POS-rapport, Terminal-oppgjor) and uploads settlement images via file picker or camera capture --> System uploads file to Supabase Storage at `{workspace_id}/settlements/{date}/`, creates `settlement_image` row, triggers `process-settlement-image` Edge Function --> Employee sees upload progress, then green checkmark with OCR confidence when done
5. Employee uploads minimum 2 images (POS + terminal required) --> System validates both types are present and marks images as ready --> "Neste" button becomes enabled
6. Employee clicks "Neste" to reach step 3 (Gjennomgang/Review) --> System shows `GatekeeperStatus` with 5 conditions: closing checklist complete, settlement images uploaded (min. 2), OCR validated or manually confirmed, critical deviations commented, reconciliation ready for submission --> Employee sees green/red indicators for each condition
7. If critical deviations exist (high/critical severity), employee sees them listed below the gatekeeper status --> Employee must acknowledge/comment on deviations before proceeding
8. Employee clicks "Neste" to reach step 4 (Send inn/Submit) --> System shows a submit confirmation screen with a "Send inn dagsstenging" button
9. Employee clicks "Send inn dagsstenging" --> System calls `useSubmitReconciliation` mutation which updates `daily_reconciliation.status` to `submitted` and sets `settled_by` and `settled_at` --> Employee sees a green checkmark with "Avstemming innsendt" confirmation message

**Postcondition:** `daily_reconciliation.status` = `submitted`. Settlement images have OCR data stored. All closing checklist items completed. Engine state progresses to `wait_for_event` (step 7), waiting for admin action.

**Error paths:**
- If no active department session exists for today: Image upload step shows "Ingen aktiv avstemming funnet for dagens dato"
- If image upload fails: Image card shows red error icon with error message, employee can retry or remove and re-upload
- If OCR extraction fails or returns low confidence: System falls back to manual input, employee can proceed
- If critical deviations are unresolved: Gatekeeper blocks submission (red indicators), employee cannot advance to submit step
- If submit mutation fails: Submit button shows error state, employee can retry
- If employee tries to check out before all gates pass: `lock_checkout` engine step blocks punch-out

---

## Journey: Employee — Upload Settlement Images with OCR Processing

**Precondition:** Employee is on step 2 of the close-out flow. A `daily_reconciliation` record exists.

1. Employee selects a source type from the pill buttons (POS-rapport, Terminal-oppgjor, Z-rapport, Kontanttelling, Annet) --> System sets the active source type for the next upload
2. Employee clicks "Velg fil" (choose file) or "Ta bilde" (take photo) --> System opens file picker or device camera (via `capture="environment"`) --> Employee selects/captures an image
3. Alternatively, employee drags and drops an image onto the drop zone --> System detects the drop event and starts upload
4. System uploads the file to Supabase Storage at the path `{workspace_id}/settlements/{date}/{filename}` --> Creates a `settlement_image` row with `source_type`, `storage_path`, `uploaded_by` --> Image appears in the list with "uploading" spinner
5. After upload completes, system invokes the `process-settlement-image` Edge Function with the `image_id` --> Edge Function downloads image from Storage, encodes to base64, sends to Google Vision API for TEXT_DETECTION --> Returns raw OCR text
6. Edge Function runs Norwegian financial parser on raw text with regex patterns for: TOTAL/TOTALT/SUM/OMSETNING, KORT/CARD/VISA, KONTANT/CASH, MVA/VAT, ANTALL/TRANSAKSJONER --> Extracts: total_sales, card_total, cash_total, vat_amount, transaction_count (handles comma decimal separator and NOK/kr prefix)
7. Edge Function calculates confidence score (number of extracted fields / total fields) --> Updates `settlement_image` row with `ocr_raw_text`, `ocr_parsed` (JSON), `ocr_confidence` (0.0-1.0), `ocr_processed_at` --> Image card updates to show green checkmark
8. Once both POS and terminal images are successfully uploaded --> "Required indicators" show green checkmarks for both --> `onImagesReady(true)` callback enables the "Neste" button

**Postcondition:** Two or more `settlement_image` rows exist with OCR parsed data. Both POS and terminal types present and processed.

**Error paths:**
- Google Vision API key not configured: Edge Function returns 503 "OCR not configured"
- Image not found in database: Edge Function returns 404
- Image download from Storage fails: Edge Function returns 500
- OCR returns no text (bad image quality): `ocr_parsed` has all null fields, confidence = 0.0, system flags for manual review
- File type not accepted: Browser file picker filters to `image/*` only

---

## Journey: Admin — Review and Approve Daily Reconciliation

**Precondition:** Admin/manager is logged in with role `admin`, `owner`, or `manager`. At least one `daily_reconciliation` exists with status `submitted` or `awaiting_approval`.

1. Admin navigates to `/dashboard/reconciliation` --> System loads `ReconciliationPage` with a split layout: DayList on the left, DayApproval on the right
2. Admin sees a list of days in `DayList` with traffic light status indicators: gray circle (open), amber clock (submitted), amber alert (awaiting_approval), green check (approved), lock (locked), red alert (unreconciled) --> Each row shows date, department name, status badge, and revenue total
3. Admin clicks on a day row --> System loads `DayApproval` for that reconciliation_id via `useReconciliationDetail` --> Admin sees the date header, status badge, revenue total
4. Admin sees precondition warnings if applicable: "X blokkerende avvik ma loses for godkjenning" (red card) and "X vakter venter pa godkjenning" (amber card)
5. Admin views the **Revenue tab** (default) --> `RevenueSection` shows: total revenue, card total, cash total, VAT, transaction count, revenue source (OCR/manual), and uploaded settlement images with OCR confidence
6. Admin can tap settlement images to view originals and verify OCR accuracy
7. Admin switches to **Shifts tab** --> `ShiftApprovalSection` shows: list of shift approvals with punch-in/out times, planned vs calculated vs approved hours, status badges (Venter/Godkjent/Redigert/Bestridt), and summary totals at the top
8. For each pending shift, admin can click the check icon to approve calculated hours OR the edit icon to modify hours with required justification
9. Admin switches to **Deviations tab** --> `DeviationSection` shows: list of deviations grouped by domain (Sikkerhet/Kunde/Prosedyre/System/Materiell) with severity badges, status, and blocking indicators
10. Admin can expand a deviation to see description, cost impact, and resolution notes
11. If a deviation is open, admin can write resolution notes and click "Marker som lost" to resolve it
12. Once all preconditions are met (no blocking deviations open, no pending shifts), the "Godkjenn dagen" button becomes enabled
13. Admin optionally writes approval notes in the textarea --> Clicks "Godkjenn dagen" --> System calls `useApproveReconciliation` mutation which updates `daily_reconciliation.status` to `approved`, sets `approved_by`, `approved_at`, `approval_notes`, and fires `reconciliation.approved` engine event --> Green confirmation card appears: "Dagen er godkjent"

**Postcondition:** `daily_reconciliation.status` = `approved`. KPIs (revenue_per_worked_hour, labor_percentage) calculated. Day is closed. Engine fires `day_closed` notification for downstream systems.

**Error paths:**
- Reconciliation not found: Detail view shows "Kunne ikke laste avstemming"
- Blocking deviations still open: "Godkjenn dagen" button remains disabled, red warning card visible
- Pending shifts not approved: "Godkjenn dagen" button remains disabled, amber warning card visible
- Network error on approve: Mutation shows loading spinner, error is handled by TanStack Query

---

## Journey: Admin — Reject Reconciliation with Reason

**Precondition:** Admin is viewing a reconciliation with status `awaiting_approval` in the `DayApproval` component.

1. Admin clicks "Avvis" (Reject) button --> System shows a textarea for rejection reason and Avvis/Avbryt buttons, hiding the approval form
2. Admin types a rejection reason in the textarea --> "Avvis" button becomes enabled (required non-empty reason)
3. Admin clicks "Avvis" --> System calls `useRejectReconciliation` mutation with reconciliation_id and reason --> Reconciliation status reverts, closing employee is notified (engine step 8: send_notification with template "reconciliation_feedback")
4. Reject form closes, admin sees the updated status

**Postcondition:** Reconciliation status changes. Closing employee receives a push notification with admin feedback. Engine loops back for re-submission.

**Error paths:**
- Empty rejection reason: "Avvis" button is disabled, admin cannot submit without reason
- Admin clicks "Avbryt": Reject form closes, approval form reappears, no mutation fired
- Network error: TanStack Query handles retry

---

## Journey: Admin — Approve/Edit Shift Hours

**Precondition:** Admin is on the Shifts tab in `DayApproval`. Shift approvals exist with status `pending`.

1. Admin sees each shift row with: punch-in/out times, planned hours, calculated hours (from punch data), current approval status
2. **Quick approve:** Admin clicks the check icon on a pending shift --> System calls `useApproveShiftHours` mutation with `approvalId`, `approvedHours` (= calculated_hours or planned_hours), and `profileId` --> Shift status changes to `approved`, approved_hours populated
3. **Edit hours:** Admin clicks the edit icon on a pending shift --> System shows inline edit form with a number input (step 0.5) pre-filled with calculated hours, and a text input for justification (obligatorisk/required)
4. Admin adjusts hours and enters justification --> Clicks "Lagre" (Save) --> System calls `useApproveShiftHours` mutation with custom hours and justification --> Shift status changes to `edited`, approved_hours reflect the admin's input
5. Admin can click "Avbryt" to cancel editing without saving

**Postcondition:** `shift_approval.status` = `approved` or `edited`. `approved_hours` is set. `approved_by` and `approved_at` recorded. If edited, `edit_justification` contains the admin's reason. Summary totals (planned/actual/approved) update.

**Error paths:**
- Edit submitted without justification: "Lagre" button is disabled (justification required)
- Edit submitted without hours: "Lagre" button is disabled
- Network error: TanStack Query handles retry, edit form remains open

---

## Journey: Admin — Resolve Deviations

**Precondition:** Admin is on the Deviations tab in `DayApproval`. Open deviations exist.

1. Admin sees deviations listed with domain icon (Shield/Users/Wrench/Monitor/Package), title, domain badge, severity badge (low/medium/high/critical with color coding), and status badge
2. Blocking deviations (blocks_day_approval = true) are highlighted with red border and background
3. Admin clicks on a deviation row to expand it --> System shows description, cost impact (formatted as NOK), and resolution notes if any
4. For open deviations, admin sees a textarea and "Marker som lost" (Mark as resolved) button
5. Admin writes resolution notes describing how the deviation was handled --> Clicks "Marker som lost" --> System calls `useResolveDeviation` mutation with `deviationId`, `profileId`, and `notes` --> Deviation status changes to `resolved`, `resolved_by` and `resolved_at` recorded
6. Expanded section collapses after resolution
7. Once all blocking deviations are resolved, the blocking count badge updates and the "Godkjenn dagen" button becomes enabled

**Postcondition:** `deviation.status` = `resolved`. `resolution_notes`, `resolved_by`, `resolved_at` populated. If this was the last blocking deviation, day approval is unblocked.

**Error paths:**
- Empty resolution notes: "Marker som lost" button is disabled
- Network error: TanStack Query handles retry

---

## Journey: System — Engine Dispatches Events and Progresses Process Steps

**Precondition:** The `daily_close` process definition is seeded with 10 steps and 2 triggers. The `engine-dispatch` Edge Function is deployed.

1. A department session transitions to `pending_signoff` status --> System fires event `department_session.pending_signoff` to `engine-dispatch` Edge Function
2. Engine dispatcher receives the event --> Inserts into `engine_event` table with idempotency key --> Queries `engine_trigger` for matching `event_type` where `is_active = true`
3. Dispatcher finds the `daily_close` trigger (no delay) --> Creates `engine_state` row with `process_id = 'daily_close'`, `entity_type = 'department_session'`, `entity_id = session UUID`, `status = 'pending'` --> Snapshots all 10 process steps into `steps_snapshot`
4. Dispatcher begins step execution: evaluates condition for step 1 (assign_task: complete_closing_checklist) --> Condition is null (always true) --> Resolves assignee_rule `self` to the closing employee --> Step 1 status = `active` in results
5. Steps 1-2 share `step_group = 1` (parallel) --> Both activate simultaneously: closing checklist + upload settlement images
6. Employee completes steps 1-2 via UI --> System fires events back to engine --> Steps 1-2 status = `complete`
7. Step 3 (`validate_settlement`) runs sequentially --> Engine invokes `validate-settlement` Edge Function --> Reads all `settlement_image` OCR results, cross-validates POS total vs terminal total, creates `settlement_validation` record --> If difference exceeds threshold (1% OR 50 NOK), creates `deviation` with domain `system`, subcategory `settlement_mismatch`
8. Step 4 (`create_deviation`) checks if settlement mismatch occurred --> Auto-creates deviation if needed
9. Step 5 (`lock_checkout`) evaluates 5 gatekeeper conditions --> If any fail, state stays `waiting` and employee cannot punch out
10. Step 6 (`update_entity`) marks `daily_reconciliation.status = 'submitted'` when employee submits
11. Step 7 (`wait_for_event`) sets engine state to `waiting` --> Waits for `reconciliation.admin_action` event with 72h timeout
12. If no admin action within 72h --> pg_cron job `engine-stuck-states` detects timeout --> Escalates to workspace owner
13. Admin approves/rejects --> Event fires --> Step 8 sends notification to closing employee
14. If approved: step 9 updates `daily_reconciliation.status = 'approved'`, step 10 fires `day_closed` system notification for KPI/season downstream
15. If rejected: engine loops back, employee re-submits

**Alternative trigger:** If the last employee punches out (`shift.last_checkout` event) and no close process is running, trigger 2 fires with a 5-minute delay via `engine_delayed_trigger` table. pg_cron job `engine-delayed-triggers` polls every minute for due triggers.

**Postcondition:** Engine state reaches `complete`. All 10 steps executed. `daily_reconciliation.status` = `approved` and `locked` (after policy period). KPI metrics calculated. Day fully closed.

**Error paths:**
- Duplicate event (same idempotency key): engine_event unique index prevents insertion, no duplicate processing
- Engine state already exists for entity + process (active/pending/waiting): unique index `idx_engine_state_unique_active` prevents duplicate processes
- Step execution fails: engine state sets `last_error`, increments `retry_count`, status = `failed`
- Maximum depth exceeded: engine prevents recursive process spawning beyond depth limit
- Delayed trigger already fired: `fired = true` prevents re-firing
