---
title: User Journey — bulk_import Sortie 0 — Attachment Routing
status: done
updated: 2026-05-23
created: 2026-05-23
module: stage-engine
tags: [bulk-import, sortie-0, attachment-routing, journey, system-journey]
---

# User Journey — bulk_import Sortie 0 — Attachment Routing

> **Note:** Sortie 0 is infrastructure-only. There is no user-visible outcome yet (no parsed data, no DB row created, no import confirmation). The journey below documents the SYSTEM path from attachment drop to dispatch acknowledgement. User-visible outcomes arrive in Sortie A.

---

## Journey: Admin Attaches Spreadsheet in BotssonChat

**Role:** Admin (or Owner) — `toolAuthPattern: direct_admin`
**Surface:** Web dashboard — BotssonChat composer (`apps/web`)
**Precondition:** User is authenticated, workspace is active, BotssonChat is mounted.

### Happy Path

1. User clicks the attachment icon in BotssonChat composer (or drags a file onto the composer area).
   - System shows a file-picker dialog filtered to `.xlsx`, `.xls`, `.csv`.
2. User selects a `.xlsx` or `.csv` file (≤ 10 MB).
   - Client calls `POST /api/botsson/imports/upload` with `multipart/form-data`.
   - Request includes `workspaceId` (from context) + the file binary.
3. BFF (`apps/web/src/app/api/botsson/imports/upload/route.ts`) receives the request:
   - Validates session via `getUser()` → 401 if unauthenticated.
   - Resolves `workspaceId` from body — 400 if missing.
   - Validates MIME type against allowlist (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv`, etc.) via `botsson-imports.ts` helper — 400 if invalid MIME.
   - Validates file size ≤ 10 MB (`file_size_limit` from bucket config) — 400 if oversized.
   - Calls Supabase Storage `upload()` to `botsson-imports/{workspaceId}/{uuid}.{ext}`.
   - Calls `createSignedUrl()` (60-minute TTL) for the uploaded object.
   - Returns `200 { signedUrl, path, filename }`.
4. Client receives the signed URL and constructs an `Attachment` object `{ signedUrl, filename, mimeType }`.
5. User types an optional message ("please review") and clicks Send.
   - Client calls `POST /api/emma/chat` with `{ message, userMessageAttachments: [{ signedUrl, filename, mimeType }] }`.
6. BFF (`/api/emma/chat`) forwards `attachments` array to stage-engine `POST /agent/chat`.
7. Stage-engine `chatSchema` validates the payload — `attachments` field is `z.array(AttachmentSchema).optional()`.
8. `routeAgentMessage()` calls `resolveCapabilityFromAttachments(attachments)` FIRST, before intent-classifier:
   - `attachment-dispatch.ts` checks each attachment's `mimeType`.
   - `.xlsx` / `.xls` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → match.
   - `.csv` → `text/csv` → match.
   - Returns `{ capability: 'bulk_import', source: 'deterministic_attachment' }`.
9. Agent-router short-circuits LLM intent classification (no OpenRouter roundtrip).
   - Emits `attachment.routed` telemetry event → PostHog + logger destinations.
   - Telemetry payload: `{ capability: 'bulk_import', source: 'deterministic_attachment', filename, attachment_count: 1 }`.
10. `bulk_import` capability is invoked. In Sortie 0, the tools array is empty — capability returns a skeletal acknowledgement response: `"I've received your file. Import processing will be available in the next release."` (placeholder).
11. User sees the acknowledgement message in BotssonChat.

**Postcondition:** File is stored in `botsson-imports/{workspaceId}/{uuid}.ext` in Supabase Storage. `attachment.routed` event fired. No `import_run` row exists yet (Sortie A). User is informed the feature is in progress.

---

## Error Path 1: Wrong MIME Type (file bypasses MIME dispatch, falls through to intent classifier)

**Trigger:** User uploads a `.pdf`, `.docx`, or `.png` — a file type not in the spreadsheet MIME allowlist.

1. Client calls `POST /api/botsson/imports/upload`.
2. BFF `botsson-imports.ts` helper validates MIME against allowlist — no match.
3. BFF returns `400 { error: "Unsupported file type. Only .xlsx, .xls, and .csv files are accepted." }`.
4. Client displays error toast. File is NOT uploaded to Storage. No signed URL generated.

Alternatively, if a file with incorrect MIME metadata slips through:
3b. BFF allows upload (MIME check passed).
4b. Stage-engine `resolveCapabilityFromAttachments()` does not match — returns `null`.
5b. Agent-router falls through to normal intent-classifier LLM path.
6b. Intent classifier sees no matching intent for raw file reference — returns generic `null_intent` or `operations` fallback.
7b. User receives a generic "I'm not sure what to do with this" response. No `attachment.routed` event fired (source would not be `deterministic_attachment`).

**Postcondition:** File may be in Storage but capability dispatch did not fire. No data processed.

---

## Error Path 2: File Too Large (> 10 MB)

**Trigger:** User selects a file over 10 MB.

1. Client calls `POST /api/botsson/imports/upload`.
2. BFF receives the multipart upload; `botsson-imports.ts` size validation fires before Storage write:
   - Checks `file.size > 10 * 1024 * 1024` → true.
3. BFF returns `400 { error: "File too large. Maximum size is 10 MB." }`.
4. Client displays error toast. File is NOT written to Storage.

**Postcondition:** Nothing written to Storage. No telemetry event. No capability invocation.

---

## Out of Scope for Sortie 0 (Sortie A Journeys)

The following journeys are NOT documented here — they belong to Sortie A:

- Admin sees import progress (import_run row status)
- Admin views row-level validation errors (import_row.error_message)
- Admin confirms and applies parsed import data
- Admin cancels an in-flight import
- Admin retries a failed import
