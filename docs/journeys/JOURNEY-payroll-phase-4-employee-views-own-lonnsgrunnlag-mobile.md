---
title: "Journey — Employee views own lønnsgrunnlag on mobile"
feature: payroll-phase-4
journey: employee-views-own-lonnsgrunnlag-mobile
status: verified
verified_at: 2026-05-08
e2e_test: Manual test only (mobile PWA on port 8083) — no Playwright spec for this journey
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-4, employee, mobile, lonnsgrunnlag, signed-url, expo-linking]
---

# Journey: Employee views own lønnsgrunnlag on mobile

**Role:** employee

**Precondition:**
- An admin has already generated a PDF for this employee's profile (via bundle or single-PDF flow)
- A `payroll.export_event` row exists with `export_format='pdf'` and the employee's profile_id
- Employee logged in on mobile (PWA port 8083)
- `employee_payroll_profile` exists for this profile (so a PDF was generated successfully)

## Happy Path

1. Employee navigates to `(me)/payroll/` tab in the mobile app → `index.tsx` renders list of available lønnsgrunnlag entries (fetched from `payroll.export_event` filtered by `exported_by = profileId`)
2. Employee taps a lønnsgrunnlag item for a locked period → navigates to `(me)/payroll/lonnsgrunnlag-detail.tsx` with route params `{ eventId, periodLabel, exportedAt }`
3. Screen mounts → `getProfileContext()` resolves session `profileId` server-side (ADR-0151): `lonnsgrunnlag-detail.tsx:82-97`
4. `useLonnsgrunnlagUrl(eventId, profileId)` query fires when `profileId.length > 0 && eventId.length > 0` (guard: `use-lonnsgrunnlag.ts:246`)
   - GET `/api/payroll/lonnsgrunnlag-url?longsgrunnlagId=<eventId>&profileId=<profileId>`
   - BFF: `rejectCrossOrigin` → `resolvePayrollAuth` → construct synthetic `AgentToolContext` (channel forced to "chat", ADR-0078)
   - BFF delegates to `viewLonnsgrunnlag.execute({ lonnsgrunnlag_id, profile_id }, ctx)`
   - Tool verifies export_event belongs to workspace (ADR-0151); verifies employee is accessing own profile (L-0177)
   - Tool creates signed URL with 1h expiry (3600s) for employee role
   - Tool emits `payroll.lonnsgrunnlag_url_granted` with non-null workspaceId + actorId (ADR-0134)
   - BFF returns `{ ok: true, signed_url, expires_at, profile_id, period_id }`
5. Screen renders document card with `FileText` icon, period label, generated date, "Signert dokument" badge
6. "Last ned" button becomes active (urlData available, not expired)
7. Employee taps "Last ned" → `handleOpen()` fires:
   - `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` for tactile feedback
   - `Linking.canOpenURL(signed_url)` → true (Supabase storage HTTPS URL)
   - `Linking.openURL(signed_url)` → system hands URL to iOS Files app / Android Downloads / system browser
8. PDF opens in the OS native viewer (not inline in the app — expected behaviour per Wave D design)
9. Employee can read lønnsgrunnlag: name, personnummer, bankkonto, hours, brutto total, footer disclaimer
10. Employee returns to the app → "Oppdater" button triggers `refetch()` if a fresh URL is needed

**Postcondition:**
- Employee has viewed their lønnsgrunnlag in the OS native PDF viewer
- `payroll.lonnsgrunnlag_url_granted` event in `activity_trail` (audit-ready)
- No new data written — this is a read-only witness journey (ADR-0133)

## Error Paths

- **Profile not yet resolved:** `getProfileContext()` throws → `profileError` state → "Autentiseringsfeil" screen with back button (`lonnsgrunnlag-detail.tsx:146-159`)
- **Missing eventId route param:** Empty state → "Manglende data" screen (`lonnsgrunnlag-detail.tsx:162-175`)
- **BFF returns access_denied (another employee's PDF):** Tool returns `{ ok: false, reason: "access_denied" }` → BFF maps to HTTP 403 → `isError=true` → error block with "Prøv igjen" button (`lonnsgrunnlag-detail.tsx:235-244`)
- **Signed URL expired:** `isUrlExpired(urlData.expires_at)` → `expired=true` → "Tilgangen til dokumentet er utløpt. Trykk Oppdater for ny tilgang." warning block (`lonnsgrunnlag-detail.tsx:247-253`)
- **Cannot open URL (`Linking.canOpenURL` returns false):** `setOpenError("Kan ikke åpne PDF på denne enheten.")` (`lonnsgrunnlag-detail.tsx:128-130`)
- **BFF returns not_found:** Export event not in workspace → 404 → error block

## Verification

- [x] getProfileContext() resolves profileId from session (never from route params — ADR-0151)
- [x] useLonnsgrunnlagUrl disabled until profileId.length > 0 (guard at use-longsgrunnlag.ts:246)
- [x] BFF lonnsgrunnlag-url delegates entirely to viewLonnsgrunnlag.execute() (single source of logic)
- [x] BFF constructs synthetic AgentToolContext with channel="chat" (ADR-0078)
- [x] Tool verifies employee accesses only their own profile (L-0177 employee cross-profile guard)
- [x] Signed URL expiry 1h for employee (3600s) via view_lonnsgrunnlag tool
- [x] emit(payroll.lonnsgrunnlag_url_granted) inside tool execute() with non-null IDs (ADR-0134)
- [x] expo-linking used (no react-native-webview dependency — Wave D trade-off)
- [x] Expired URL surfaced with warning block + refetch option
- [x] Screen is WITNESS-only — no generate/override/admin actions (ADR-0133)
- [x] Disclaimer text "Dette er et lønnsgrunnlag — ikke en lønnsslipp" in screen footer

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 1 — mobile payroll list route | `apps/mobile/app/(app)/(me)/payroll/index.tsx` |
| Step 2 — screen file | `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx` |
| Step 3 — getProfileContext resolution | `lonnsgrunnlag-detail.tsx:85-97` |
| Step 4 — useLonnsgrunnlagUrl call | `lonnsgrunnlag-detail.tsx:107` |
| Step 4 — enabled guard | `apps/mobile/src/hooks/queries/use-lonnsgrunnlag.ts:246` |
| Step 4 — BFF GET /api/payroll/lonnsgrunnlag-url | `apps/web/src/app/api/payroll/lonnsgrunnlag-url/route.ts` |
| Step 4 — BFF synthetic AgentToolContext (channel="chat") | `lonnsgrunnlag-url/route.ts:103-110` |
| Step 4 — BFF delegates to viewLonnsgrunnlag.execute() | `lonnsgrunnlag-url/route.ts:112-118` |
| Step 5 — Document card render | `lonnsgrunnlag-detail.tsx:204-218` |
| Step 6 — "Last ned" button visible when urlData present | `lonnsgrunnlag-detail.tsx:262` |
| Step 7 — handleOpen (Haptics + Linking) | `lonnsgrunnlag-detail.tsx:114-137` |
| Step 7 — Linking.openURL | `lonnsgrunnlag-detail.tsx:131` |
| Step 9 — Footer disclaimer text | `lonnsgrunnlag-detail.tsx:317-320` |
| Step 10 — handleRefresh | `lonnsgrunnlag-detail.tsx:139-143` |
| Expired URL warning block | `lonnsgrunnlag-detail.tsx:247-253` |
| Error block (isError) | `lonnsgrunnlag-detail.tsx:235-244` |
| viewLonnsgrunnlag tool (execute body) | `packages/ai/src/capabilities/payroll/tools.ts` (view_lonnsgrunnlag tool) |
