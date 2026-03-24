---
title: Session Log
status: in_progress
updated: 2026-03-24
created: 2026-03-02
---

## Last Session

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Date    | 2026-03-24                                 |
| Branch  | `development` (main repo, no worktree)     |
| Feature | Mobile app — auth/login + design inventory |
| Status  | paused                                     |

### What was done

- **Expo startup fixes:** Removed `@config-plugins/react-native-webrtc` from app.json (Expo 55 peer dep mismatch), wrapped LiveKit `registerGlobals()` in Platform.OS check (crashes on web), created 1Password `GitHub` item for `.env.template`
- **Welcome screen redesigned:** Uses `lightColors`, `spacing`, `typography`, `radius`, `shadows` from `@/theme` (design tokens). Smartout logo. 4 paths: invitation, code, search, login
- **Login screen built:** Email + password form (matches web login), Google SSO button, "Glemt passord?" link, "Opprett konto" footer. Design tokens throughout. Flow param differentiates login vs verify
- **Auth flow fix:** Manual `router.replace("/(auth)/workspace-select")` after successful `signInWithPassword` — AuthProvider doesn't redirect because verify is in post-auth flow list. Back button uses `navigation.canGoBack()` fallback
- **Design spec inventory:** Found 3 key mobile specs in `docs/superpowers/specs/` + 36 HTML demos in `.superpowers/brainstorm/`

### Where we stopped

- Welcome + login screens work but have **React 19 + react-native-web `removeChild` bug** on route transitions (web only — native would work fine)
- Uncommitted changes in: `welcome.tsx`, `verify.tsx`, `_layout.tsx` (LiveKit guard), `app.json` (removed webrtc plugin)
- User wants to implement the 3 key specs next (home screen phases, ShiftClock, Payroll UI)

### Files changed (uncommitted)

- `apps/mobile/app/(auth)/welcome.tsx` — Redesigned with design tokens
- `apps/mobile/app/(auth)/verify.tsx` — Login form added (email+password+Google)
- `apps/mobile/app/_layout.tsx` — LiveKit registerGlobals Platform guard
- `apps/mobile/app.json` — Removed @config-plugins/react-native-webrtc

### Known blockers / errors

- **React 19 + expo-router web:** `removeChild` DOM error on route transitions. `react-native-reanimated` + `react-native-safe-area-context` conflict. Causes infinite loop crash on web. Test on native device/emulator instead.
- **Expo 55 + @config-plugins/react-native-webrtc:** Peer dep mismatch (plugin wants Expo 54). Removed from app.json. Needed for native builds — will need resolution.

### Pending decisions

- [ ] Should mobile auth use email+password (like web) or SMS OTP (phone-first) as primary?
- [ ] Which spec to implement first: ShiftClock (punchklokke) or Payroll UI?
- [ ] Commit current welcome/login/layout changes? Working but untested on native

### Key specs for next session

1. **Mobile Employee App** (`docs/superpowers/specs/2026-03-18-mobile-employee-app-design.md`) — Full V1: vaktløkka, 4-phase home, offline, chat, push, task modal
2. **ShiftClock** (`docs/superpowers/specs/2026-03-24-shift-clock-design.md`) — Fullscreen punch clock: GPS, breaks, supplements, chat, voice, gamification
3. **Mobile Payroll UI** (`docs/superpowers/specs/2026-03-22-mobile-payroll-ui-design.md`) — 6 screens: PayrollHomeCard, absence, timebank, supplements, payslips

### Previous session (fix-invitation-flow)

- Audited full user management + invitation flow (3 entry paths)
- Identified 5 gaps: company_member, listUsers, RLS, resend, expiry cleanup
- wt-7 created, plan being written, implementation not started
