---
title: Mobile Auth Flow
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, auth, authentication, flow, sitemap]
---

# Auth Flow

## Auth Provider

`apps/mobile/src/providers/auth-provider.tsx` — wraps all app screens. Watches `supabase.auth.onAuthStateChange()`. On session detected → routes to `/(auth)/workspace-select`. On session removed → routes to `/(auth)/welcome`.

The root `app/index.tsx` unconditionally redirects to `/(auth)/welcome`; `AuthProvider` overrides this with actual session routing.

## Route Tree

```
/(auth)/welcome
  ├── Path 1 — Invite deep link
  │     /(auth)/invite/[token]          validate token vs invitation table
  │       → /(auth)/invite/confirm      confirm/edit name + email
  │           → /(auth)/verify?flow=invite
  │               → /(auth)/workspace-select
  │
  ├── Path 2 — Workspace search (join request)
  │     /(auth)/verify?flow=search      search + send join request
  │       → /(auth)/pending             wait for admin approval
  │           → (realtime: approved)
  │           → /(auth)/workspace-select
  │
  └── Path 3 — Direct login
        /(auth)/verify?flow=login       email+password, Google SSO, or OTP
          → /(auth)/workspace-select
```

## Workspace Select Logic (`(auth)/workspace-select.tsx`)

1. Fetch all active `profile` rows for `auth.uid()`.
2. 0 profiles → `router.replace("/(auth)/pending")`.
3. 1 profile → `setSelectedProfile(profile.profile_id)` + `router.replace("/(app)/(home)")`.
4. >1 profiles → render picker list; on selection: `setSelectedProfile` + `router.replace("/(app)/(home)")`.

**Context:** `workspace-select` redirects to `/(app)/(home)`, NOT `/(app)`. This means the initial route is the Hjem tab, which aligns with `initialRouteName: "(home)"` in `(app)/_layout.tsx`.

## Pending Screen (`(auth)/pending.tsx`)

Subscribes to Supabase Realtime channel `invitation:user_id=eq.${user.id}`. On `UPDATE` event where status becomes accepted:
- `router.replace("/(auth)/workspace-select")`

Also has a manual "Sjekk status" button that calls `fetchProfiles()` directly. Cancel button:
- `router.replace("/(auth)/welcome")`

## Verify Screen (`(auth)/verify.tsx`)

Dual-purpose screen parameterized by `flow`:

| flow param | Purpose | Success path |
|-----------|---------|-------------|
| `login` | Email+password, Google SSO, OTP | `router.replace("/(auth)/workspace-select")` |
| `invite` | SMS OTP or magic link for invite flow | `router.replace("/(auth)/workspace-select")` |
| `search` | OTP for workspace search/join | `router.replace("/(auth)/pending")` or workspace-select |

On cancel: `router.replace("/(auth)/welcome")`.

## Invite Token Flow (`(auth)/invite/[token].tsx`)

Validates token against Supabase `invitation` table. Shows workspace name + logo. Two outcomes:
- Token valid → `router.push("/(auth)/invite/confirm")` with pre-filled name/email params
- Token invalid → `router.replace("/(auth)/welcome")`

## Session Persistence

`useWorkspaceStore` (Zustand + MMKV) persists `selectedProfileId` across sessions. On next app open, `AuthProvider` + `workspace-select` will use the persisted `selectedProfileId` to auto-route.

## Protected Routes

No explicit route guards in Expo Router config. Protection is enforced by:
1. `AuthProvider` — redirects to `/(auth)/welcome` on session removal
2. All app screens depend on `useMyProfile` / `useWorkspaceStore` — missing `selectedProfileId` produces empty data (not a hard error)
