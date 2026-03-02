---
title: Auth Screens Redesign — Login, Signup, Reset Password
status: approved
updated: 2026-03-02
created: 2026-03-02
module: auth
tags: [auth, login, design, reset-password, ui]
---

# Auth Screens Redesign

## Summary

Redesign all auth pages (login, signup, reset-password) with a unified split-screen layout, animated gradient mesh brand panel, and modern form styling. Fix the broken reset-password flow. Add missing update-password page.

## Design Decisions

- **Theme:** Light/dark adaptive using CSS variable tokens (not hardcoded dark)
- **Layout:** Split-screen (brand panel left, form right) — collapses to form-only on mobile
- **Visual style:** Modern, trendy, "popping" — animated gradient mesh, bold typography, micro-animations
- **Brand accent:** `--brand-orange` (oklch(0.65 0.22 40)) for focus rings, CTA button, glow effects

## Scope

### Pages (5)

| Page             | Route               | Status                    |
| ---------------- | ------------------- | ------------------------- |
| Login            | `/login`            | Redesign                  |
| Sign up          | `/signup`           | Redesign                  |
| Forgot password  | `/reset-password`   | Redesign + fix auth logic |
| Update password  | `/update-password`  | New page                  |
| Select workspace | `/select-workspace` | Redesign to match         |

### Shared Components

- `(auth)/layout.tsx` — route group layout with split-screen grid
- `AuthBrandPanel.tsx` — left side brand panel (reusable)
- `AuthFormWrapper.tsx` — right side form container (centered, max-w-sm)

## Brand Panel Design

**Background:** Animated CSS gradient mesh

- Light mode: soft warm gradient (orange-100 → amber-50 → rose-50)
- Dark mode: deep saturated gradient (orange-900/30 → amber-950/20 → background)
- CSS `@property` animation for smooth color shifts (8s cycle)

**Content:**

- SmartOut logo (Building2 icon + wordmark) — top-left
- Tagline: "Klar fra dag en." — text-4xl font-black tracking-tight
- 3 feature bullets with icons (Sparkles, Users, Shield)
- 3-4 floating decorative circles with CSS `animate-float`
- Ambient glow blob (radial gradient, brand-orange at 8% opacity)

## Form Panel Design

**Input styling:**

- h-12 (48px), rounded-xl
- Orange focus ring: focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange
- Label above, text-sm font-medium text-muted-foreground
- Password toggle (Eye/EyeOff)

**CTA Button:**

- h-12 rounded-xl w-full font-semibold
- bg-brand-orange hover:bg-brand-orange-light text-white
- Loading spinner state
- Shadow: shadow-lg shadow-brand-orange/20

**Links:**

- "Glemt passord?" — right-aligned under password field
- "Ny bruker? Opprett konto" / "Har en konto? Logg inn" — bottom

## Reset Password Flow (Fix)

### Current state (broken)

- `/reset-password` has a setTimeout stub instead of real Supabase call
- No `/update-password` page exists
- No link from login to reset-password

### Fixed flow

1. User clicks "Glemt passord?" on login → navigates to `/reset-password`
2. User enters email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/api/auth/callback?next=/update-password' })`
3. User receives email with magic link
4. Click link → `/api/auth/callback` exchanges code → redirects to `/update-password`
5. `/update-password` page: new password + confirm → `supabase.auth.updateUser({ password })`
6. Success → redirect to `/login` with toast "Passord oppdatert"

## Responsive Behavior

| Breakpoint | Layout                                                    |
| ---------- | --------------------------------------------------------- |
| < lg       | Single column. Brand panel hidden. Small logo above form. |
| >= lg      | Two-column grid. Brand panel left, form right.            |

## Animations

- Gradient mesh: CSS-only, 8s cycle
- Floating circles: CSS keyframes with staggered delays
- Form entrance: Framer Motion fadeIn + translateY (300ms)
- Error/success: animate-in slide transitions
- Page transitions: cross-fade between auth pages

## Language

Norwegian copy throughout. i18n keys where system supports it, hardcoded Norwegian where existing pages already do.
