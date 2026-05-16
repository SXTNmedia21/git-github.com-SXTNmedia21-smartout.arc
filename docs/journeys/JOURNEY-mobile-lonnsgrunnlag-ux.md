---
title: Mobile Lønnsgrunnlag UX — User Journeys
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: payroll-mobile
tags: [mobile, payroll, lønnsgrunnlag, journey, witness-only]
---

# User Journeys: Mobile Lønnsgrunnlag UX

ADR-0133 constraint: mobile is WITNESS-only for payroll. All journeys are
read-only — no generate, no admin, no authoring.

---

## J1: Employee opens lønnsgrunnlag list

**Precondition:**
- Employee is authenticated in the mobile app
- At least one approved/exported payroll period exists in `payroll.period`
- At least one completed PDF export event exists in `payroll.export_event`

**Happy path:**

1. Employee opens "Lønn & Arbeid" hub (payroll index screen)
   → System shows payroll hub with primary card, bento grid, and lønnsgrunnlag section
2. Employee scrolls to the "Lønnsgrunnlag" section
   → System renders `FlashList` with period items, each showing:
      - Period label (e.g. "Lønnsgrunnlag — Mai 2026") in bold
      - Date range in monospace text
      - Status badge (colour-coded: draft/locked/paid)
3. Employee taps a list item
   → `accessibilityRole="button"`, label = "Lønnsgrunnlag for Mai 2026"
   → Scale press feedback (Reanimated withSpring 0.97)
   → Haptic selection feedback
   → Navigation to `lonnsgrunnlag-detail` with `eventId`, `periodLabel`, `exportedAt`

**Empty state path:**

1. Employee opens hub with no PDF exports available
   → System shows centred `FileText` icon at opacity 0.4
   → Text: "Ingen lønnsgrunnlag ennå"

**Error path:**

1. List fetch fails
   → `useMyLonnsgrunnlagList` isError state
   → Hub shows fallback ActivityIndicator; list section remains empty (no crash)

**Postcondition:**
Employee can see all available lønnsgrunnlag periods and navigate to any detail view.

---

## J2: Employee opens lønnsgrunnlag detail with loading skeleton

**Precondition:**
- Employee has tapped a list item from J1
- `eventId`, `periodLabel`, `exportedAt` passed as route params
- Profile context resolving (async) — signed URL not yet available

**Happy path (skeleton phase):**

1. Screen mounts with `lonnsgrunnlag-detail` route
   → Header shows period label immediately (from route param)
   → Document card renders (static — period label + exported date from params)
   → 3-row skeleton appears below document card while `isLoading && !urlData`
      - Row 1: wide skeleton bar (simulates button placeholder)
      - Row 2: medium skeleton bar
      - Row 3: narrow skeleton bar
      - All rows pulse via Reanimated `useSharedValue` opacity between 0.3 and 0.8
      - Spring: `nativeTheme.motion.springAmbient` (low stiffness, unhurried)
      - ONLY opacity animated (GPU compositor rule — no layout animations)

**Happy path (URL resolved):**

2. Profile context resolves → signed URL fetch begins
3. Signed URL arrives → skeleton unmounts, action buttons render with FadeIn
   → Primary button: "Del / Åpne" with Share icon
   → Secondary button: "Oppdater"

**URL expired path:**

4. URL fetch returns expired URL (< 60s to expiry)
   → Warning block: "Tilgangen til dokumentet er utløpt. Trykk Oppdater for ny tilgang."
   → Primary button: "Oppdater og åpne"

**Error path:**

5. URL fetch fails
   → Error block with error message
   → Retry button: "Prøv igjen"

**Postcondition:**
Employee sees document information and action buttons without layout shift during load.

---

## J3: Employee shares / opens PDF via native system

**Precondition:**
- Employee is on `lonnsgrunnlag-detail`
- Signed URL is resolved and not expired
- `expo-sharing` is available on device

**Happy path (sharing):**

1. Employee taps "Del / Åpne" button
   → `accessibilityRole="button"`, `accessibilityLabel="Del eller åpne lønnsgrunnlag"`
   → `ActivityIndicator` replaces Share icon while fetching
   → `Sharing.shareAsync(signedUrl)` called with content-type `application/pdf`
   → System sheet appears: AirDrop, Files, Mail, etc.
2. Employee selects destination (e.g. Files app, email, AirDrop)
   → OS handles the transfer
   → Share sheet dismisses
3. Screen returns to normal state

**Fallback path (sharing not available on device):**

1. Employee taps "Del / Åpne" — device does not support `Sharing.shareAsync`
   → Fall back to `Linking.openURL(signedUrl)`
   → System browser / PDF viewer opens

**Error path:**

1. `Sharing.shareAsync` throws
   → `openError` state set
   → Error block renders: "Kunne ikke åpne PDF."

**Postcondition:**
PDF is accessible via the native sharing / viewing system without leaving a WebView
or triggering an insecure browser context.

**ADR-0133 verification:**
No generate button, no admin actions, no authoring. Witness-only — tap to view/share.
