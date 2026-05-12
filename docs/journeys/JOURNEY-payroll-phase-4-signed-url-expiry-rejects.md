---
title: "Journey — Signed URL expiry rejects stale access"
feature: payroll-phase-4
journey: signed-url-expiry-rejects
status: verified
verified_at: 2026-05-08
e2e_test: Manual test only (requires time-based expiry or policy override — see MANUAL-TEST-payroll-phase-4.md Flow 4)
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-4, signed-url, expiry, security, storage]
---

# Journey: Signed URL expiry rejects stale access

**Role:** employee OR admin

**Precondition:**
- A `payroll.export_event` row with `export_format='pdf'` exists
- A signed URL was previously fetched (via `/api/payroll/lonnsgrunnlag-url` or BFF returns)
- The signed URL has expired (>1h for employee URL, >24h for admin URL) OR URL was manually invalidated for testing

## Happy Path (expiry handled correctly)

1. Client (web or mobile) holds a previously-fetched signed URL in state
2. `isUrlExpired(expiresAt)` check detects expiry with 1-minute buffer:
   - Mobile: `lonnsgrunnlag-detail.tsx:68-70` — `new Date(expiresAt).getTime() < Date.now() + 60_000`
   - Mobile: `expired=true` state variable set at render time
3. Mobile "Oppdater og åpne" button appears in place of "Last ned" button label when `expired=true` (`lonnsgrunnlag-detail.tsx:284`)
4. User taps "Oppdater og åpne" OR "Oppdater" (refresh button) → `refetch()` called
   - `useLonnsgrunnlagUrl` re-fires GET `/api/payroll/lonnsgrunnlag-url?lonnsgrunnlagId=...&profileId=...`
   - BFF delegates to `viewLonnsgrunnlag.execute()` → fresh `createSignedUrl` call
   - Storage issues new signed URL with fresh expiry window
   - `payroll.lonnsgrunnlag_url_granted` emitted again (audit trail for re-issue)
5. New signed URL returned with new `expires_at`
6. `isUrlExpired` check passes (fresh URL) → "Last ned" / "Last ned og åpne" button activates
7. User opens PDF successfully

**Postcondition:**
- Stale URL discarded; new signed URL in client state
- `activity_trail` has second `payroll.lonnsgrunnlag_url_granted` event (each grant is audited)

## Error Path — expired URL presented directly to storage

If a user bypasses the app and presents an expired signed URL directly to Supabase Storage:

1. Browser or client issues GET request to expired Supabase Storage signed URL
2. Supabase Storage validates JWT embedded in URL — token is expired
3. Storage returns HTTP 403 Forbidden
4. Web page or mobile app shows error state (if the URL was fetched from state and re-used beyond its TTL)

There is no server-side "check-before-issue" gate on the storage layer — expiry is enforced cryptographically by Supabase Storage's JWT validation. The client-side `isUrlExpired()` check is a UX guard only; Storage enforcement is the authoritative gate.

## URL Expiry Configuration

| Actor | Expiry | Where set |
|-------|--------|-----------|
| Employee (self) | 1h (3600s) | `generate-pdf-single/route.ts:329` + `view_lonnsgrunnlag` tool |
| Admin (bundle) | 24h (86400s) | `generate-pdf-bundle/route.ts:274` |
| Admin (single) | 24h (86400s) | `generate-pdf-single/route.ts:329` |

## Verification

- [x] isUrlExpired() computes `expiresAt < now + 60s` buffer (mobile, lonnsgrunnlag-detail.tsx:68-70)
- [x] expired=true state variable triggers "Oppdater og åpne" label on primary button (lonnsgrunnlag-detail.tsx:284)
- [x] handleOpen() calls refetch() when expired (lonnsgrunnlag-detail.tsx:119)
- [x] useLonnsgrunnlagUrl refetch triggers fresh GET to BFF
- [x] BFF → viewLonnsgrunnlag.execute() → fresh createSignedUrl call each time
- [x] payroll.lonnsgrunnlag_url_granted emitted on each signed URL grant (ADR-0134)
- [x] Supabase Storage enforces expiry via JWT; expired URL → 403 from storage layer
- [x] Employee URL 1h, Admin URL 24h (role-split at generate-pdf-single/route.ts:329)

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 2 — isUrlExpired check | `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx:68-70` |
| Step 2 — expired state variable | `lonnsgrunnlag-detail.tsx:112` |
| Step 3 — "Oppdater og åpne" label when expired | `lonnsgrunnlag-detail.tsx:284` |
| Step 4 — handleOpen refetch on expired | `lonnsgrunnlag-detail.tsx:119` |
| Step 4 — handleRefresh (manual Oppdater button) | `lonnsgrunnlag-detail.tsx:139-143` |
| Step 4 — BFF GET lonnsgrunnlag-url | `apps/web/src/app/api/payroll/lonnsgrunnlag-url/route.ts` |
| Step 4 — viewLonnsgrunnlag createSignedUrl call | `packages/ai/src/capabilities/payroll/tools.ts` (view_lonnsgrunnlag tool) |
| Step 4 — emit lonnsgrunnlag_url_granted (re-grant) | inside viewLonnsgrunnlag.execute() |
| Warning block for expired URL | `lonnsgrunnlag-detail.tsx:247-253` |
| Admin expiry 24h (bundle) | `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts:274` |
| Admin/Employee expiry split (single) | `apps/web/src/app/api/payroll/generate-pdf-single/route.ts:329` |
