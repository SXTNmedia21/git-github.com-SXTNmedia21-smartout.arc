# Landing Page Production Polish — Design, Mobile, and Button Audit

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the landing page production-ready by fixing all broken buttons/links, adding mobile navigation, redesigning off-brand pages, and polishing mobile responsiveness across every page.

**Architecture:** Systematic audit and fix of the existing `apps/landing/` Next.js app. No new dependencies needed. All changes are component-level — CSS, markup, and link targets. The shared `Navigation` component gets a mobile hamburger menu. Dead-end pages get redirected to real destinations. Off-brand pages (login, signup) get redesigned to match the dark theme.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, Lucide icons

---

## Production Review (2026-02-28, verified against live site)

### Review Scope

- Live pages reviewed: `/`, `/login`, `/signup`, `/blog`, `/blog/story-0`, `/waitlist`, `/onboarding`, `/dashboard`, `/concepts/daily-session`
- Source reviewed in parallel: `apps/landing/src/components/navigation.tsx` and affected route files in `apps/landing/src/app/**`

### Findings (ordered by severity)

1. **Primary CTA destination is broken in production** (Critical)
   - Multiple CTAs resolve to landing-local `/onboarding` and `/dashboard`, both 404 in production.
   - Root cause: URL construction depends on `NEXT_PUBLIC_WEB_APP_URL`; when empty, links become local (`/onboarding`, `/dashboard`).
   - Impact: Top-funnel conversion path is broken.

2. **`/waitlist` is still a hard 404** (Critical)
   - Linked from `/concepts/daily-session`.
   - Confirmed both in live route and source (`Link href="/waitlist"`).

3. **Auth pages are off-brand and non-functional** (Critical)
   - `/login` and `/signup` remain light-mode English forms with `action="#"`.
   - No real auth handoff, inconsistent with product brand and locale.

4. **Mobile navigation still has no menu** (Critical)
   - Nav links are hidden on mobile (`hidden md:block`) with no hamburger replacement.
   - Mobile users effectively lose page navigation.

5. **Blog cards still link to missing story routes** (High)
   - `/blog/story-0` through `/blog/story-5` are still 404.

6. **Language consistency regressions persist** (Medium)
   - `/concepts/lokations` still contains English-only labels.
   - `/concepts/daily-session` includes mixed language labels (for example: "Waitlist", "Tasks Completed", "Overdue", "Staff Checked In").

7. **SEO metadata still missing for most routes** (Medium)
   - Only root layout and docs layout export metadata; most marketing routes still rely on generic metadata.

8. **Plan scope mismatch: footer refactor is overestimated** (Low)
   - Footer duplication currently appears in a subset of marketing pages (not all feature/concept pages).
   - A shared footer is still recommended, but expected touch set should be narrowed.

### Suggested Plan Adjustments

#### Add new Task 0 (before Task 1): External URL hardening

Implement a single helper for web-app destination links (onboarding/login/dashboard) and fail-safe behavior:

- Create `apps/landing/src/lib/web-app-url.ts`:
  - Resolve origin from `NEXT_PUBLIC_WEB_APP_URL`.
  - Fallback to a safe, explicit production web app URL (or fail closed by rendering disabled CTA + telemetry warning).
  - Normalize slashes so path joins are deterministic.
- Replace ad-hoc string concatenation in nav and pages with helper.
- Add a smoke test checklist item: no CTA may resolve to `smartout-landing.vercel.app/onboarding` or `/dashboard`.

#### Re-prioritize execution phases

Use this order for production impact:

1. **Task 0 (new): URL hardening**
2. **Task 5: `/waitlist` resolution**
3. **Task 6: auth page redesign/redirect**
4. **Task 1 + Task 2: mobile nav + CTA correction**
5. **Task 4: blog 404 links**
6. **Task 8: metadata**
7. **Task 7: language consistency sweep (expand beyond `lokations`)**
8. **Task 3: shared footer refactor (narrowed file set)**
9. QA + build verification

#### Tighten Task 3 (Footer) file scope

Start with pages that actually contain inline `<footer>` blocks now:

- `apps/landing/src/app/page.tsx`
- `apps/landing/src/app/pricing/page.tsx`
- `apps/landing/src/app/om-oss/page.tsx`
- `apps/landing/src/app/blog/page.tsx`

Then optionally roll out to feature/concept pages if design calls for it, but do not assume they all already contain duplicate footer markup.

## Critical Issues Found (Audit Summary)

| #   | Issue                                                                                         | Severity | Pages Affected              |
| --- | --------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| 1   | **No mobile menu** — nav links hidden on mobile, no hamburger                                 | Critical | ALL pages                   |
| 2   | **Blog story links are 404s** — `/blog/story-0` through `story-5` don't exist                 | Critical | `/blog`                     |
| 3   | **`/waitlist` page doesn't exist** — linked from Daily Session                                | Critical | `/concepts/daily-session`   |
| 4   | **Login/Signup are completely off-brand** — light mode, English, indigo, no SmartOut branding | Critical | `/login`, `/signup`         |
| 5   | **Login/Signup forms submit to nowhere** — `action="#"`                                       | Critical | `/login`, `/signup`         |
| 6   | **Nav CTA says "Gå til Dashboard"** — wrong for unauthenticated visitors                      | High     | ALL pages                   |
| 7   | **Footer has zero navigation links** — just logo + copyright                                  | High     | ALL pages                   |
| 8   | **`/concepts/lokations` has English-only text** — breaks Norwegian consistency                | Medium   | `/concepts/lokations`       |
| 9   | **No page-level metadata/SEO** — only root layout has metadata                                | Medium   | ALL non-root pages          |
| 10  | **Mobile text overflow risk** — `text-7xl` headings on small screens                          | Medium   | Home, Pricing, Blog, Om Oss |
| 11  | **Inconsistent page backgrounds** — mix of `bg-[#050505]`, `bg-zinc-950`, `bg-gray-50`        | Low      | Various                     |

---

## Task 1: Add Mobile Hamburger Menu to Navigation

**Files:**

- Modify: `apps/landing/src/components/navigation.tsx`

**Why:** On mobile (<768px), all 5 nav links are `hidden md:block`. Users only see the logo and "Gå til Dashboard" button. There is zero navigation on mobile. This is the single biggest mobile issue.

**Step 1: Convert Navigation to client component and add mobile state**

The `Navigation` component is currently a server component. Add `"use client"` and a `useState` for mobile menu toggle. Add a hamburger button (`Menu`/`X` from lucide) visible only on mobile (`md:hidden`).

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ArrowRight, Menu, X } from "lucide-react";

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const webAppOrigin = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "";
  const onboardingHref = `${webAppOrigin}/onboarding`;

  const links = [
    { href: "/om-oss", label: "Om Oss" },
    { href: "/pricing", label: "Priser" },
    { href: "/blog", label: "Kundehistorier" },
    { href: "/docs", label: "Dokumentasjon" },
    { href: "/#features", label: "Funksjoner" },
  ];

  return (
    <nav className="fixed top-0 left-0 z-40 w-full border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-3xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500" />
          <span className="text-xl font-black tracking-tighter text-white">SmartOut</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold transition-colors hover:text-white ${
                pathname === link.href ? "text-white" : "text-zinc-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={onboardingHref}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-colors hover:bg-zinc-200"
          >
            Kom i gang <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href={onboardingHref}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-950"
          >
            Kom i gang <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-400 transition-colors hover:text-white"
            aria-label={mobileOpen ? "Lukk meny" : "Åpne meny"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#0a0a0c]/95 backdrop-blur-3xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/5 ${
                  pathname === link.href ? "bg-white/5 text-white" : "text-zinc-400"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
```

**Step 2: Run dev server and test**

Run: `pnpm --filter landing dev`
Test on mobile viewport (375px):

- Hamburger icon visible
- Tapping opens dropdown with all 5 links
- Tapping a link closes the menu
- "Kom i gang" CTA visible next to hamburger
- Desktop (>768px): normal horizontal nav, no hamburger

**Step 3: Commit**

```bash
git add apps/landing/src/components/navigation.tsx
git commit -m "feat(landing): add mobile hamburger menu to navigation

Converts Navigation to client component with mobile menu toggle.
All 5 nav links now accessible on mobile via dropdown."
```

---

## Task 2: Fix Navigation CTA — "Kom i gang" instead of "Gå til Dashboard"

**Files:**

- Modify: `apps/landing/src/components/navigation.tsx` (already done in Task 1)

**Context:** The nav CTA says "Gå til Dashboard" and links to `/dashboard`. This is for logged-in users. Landing page visitors should see "Kom i gang" linking to `/onboarding` on the web app. This is already incorporated in the Task 1 code above — both desktop and mobile CTAs now say "Kom i gang" and point to `onboardingHref`.

**Step 1: Verify the change from Task 1**

Check that:

- Desktop CTA reads "Kom i gang" (not "Gå til Dashboard")
- Links to `${NEXT_PUBLIC_WEB_APP_URL}/onboarding`
- Mobile CTA also reads "Kom i gang"

If Task 1 is already committed, this is just a verification step.

---

## Task 3: Fix Footer — Add Navigation Links

**Files:**

- Create: `apps/landing/src/components/footer.tsx`
- Modify: Every page that has an inline `<footer>`:
  - `apps/landing/src/app/page.tsx`
  - `apps/landing/src/app/pricing/page.tsx`
  - `apps/landing/src/app/om-oss/page.tsx`
  - `apps/landing/src/app/blog/page.tsx`
  - All feature pages (`shiftplanner`, `communications`, `task-rutines`, `staff-training`, `haccp-complience`, `punchclock-timetracking`)
  - All concept pages (`daily-session`, `seasons`, `procedures`, `lokations`)

**Why:** Every page has a minimal footer with just logo + copyright. A production landing page needs footer navigation (company links, product links, legal).

**Step 1: Create shared Footer component**

```tsx
import Link from "next/link";
import { Building2 } from "lucide-react";

const footerLinks = {
  Produkt: [
    { label: "Funksjoner", href: "/#features" },
    { label: "Priser", href: "/pricing" },
    { label: "Dokumentasjon", href: "/docs" },
  ],
  Selskap: [
    { label: "Om Oss", href: "/om-oss" },
    { label: "Kundehistorier", href: "/blog" },
  ],
  Ressurser: [
    { label: "Kom i gang", href: "/docs/kom-i-gang" },
    { label: "Onboarding", href: "/docs/onboarding" },
    { label: "API", href: "/docs/api" },
  ],
};

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-zinc-900 bg-zinc-950 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              <span className="text-lg font-black tracking-tighter text-white">SmartOut</span>
            </Link>
            <p className="text-sm leading-relaxed text-zinc-500">
              AI-drevet workforce management for den norske serveringsbransjen.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="mb-4 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                {heading}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-8 md:flex-row">
          <p className="text-sm text-zinc-600">
            &copy; 2026 SmartOut AS. Helt bygget for fremtiden.
          </p>
          <div className="flex gap-6 text-sm text-zinc-600">
            <span>Personvern</span>
            <span>Vilkår</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Replace inline footers in all pages**

In every page file, replace the inline `<footer>...</footer>` block with:

```tsx
import Footer from "../../components/footer"; // adjust relative path
// ...
<Footer />;
```

Do this for all ~13 pages that have inline footers.

**Step 3: Run dev server and verify**

- Footer shows 4 columns on desktop, 2 on mobile
- All links work and navigate correctly
- Consistent across every page

**Step 4: Commit**

```bash
git add apps/landing/src/components/footer.tsx apps/landing/src/app/
git commit -m "feat(landing): add shared Footer component with navigation links

Replaces minimal logo-only footer on all pages with structured footer
containing Produkt, Selskap, and Ressurser link columns."
```

---

## Task 4: Fix Blog Story Links (404s)

**Files:**

- Modify: `apps/landing/src/app/blog/page.tsx`

**Why:** Blog cards link to `/blog/story-0` through `/blog/story-5`. None of these pages exist. Users clicking any story card get a 404.

**Decision:** Since these are mock customer stories (not real content), convert the cards from links to non-clickable showcase cards. Add a "Kommer snart" (Coming soon) indicator. When real stories are written, these can become links again.

**Step 1: Convert Link cards to div cards**

In `blog/page.tsx`, change the story card from `<Link href={...}>` to a `<div>` with the same styling. Add a small "Kommer snart" badge to each card.

```tsx
// BEFORE:
<Link href={`/blog/story-${i}`} key={i} className="group relative rounded-[32px] ...">

// AFTER:
<div key={i} className="group relative rounded-[32px] bg-[#0a0a0c]/40 border border-white/5 transition-all duration-500 overflow-hidden backdrop-blur-2xl shadow-2xl flex flex-col p-8">
  <span className="absolute top-6 right-6 rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border border-white/5">
    Kommer snart
  </span>
  {/* ...rest of card content unchanged, remove hover effects... */}
</div>
```

**Step 2: Verify no 404 links remain on blog page**

**Step 3: Commit**

```bash
git add apps/landing/src/app/blog/page.tsx
git commit -m "fix(landing): replace broken blog story links with static cards

Story pages don't exist yet. Cards are now non-clickable with
'Kommer snart' badge until real content is added."
```

---

## Task 5: Fix `/waitlist` — Redirect to Onboarding

**Files:**

- Create: `apps/landing/src/app/waitlist/page.tsx`

**Why:** The Daily Session concept page has a "Sett meg på venteliste" button linking to `/waitlist`, but no page exists. Rather than build a full waitlist page, redirect to the onboarding flow since that's the actual signup path.

**Step 1: Create a simple redirect page**

```tsx
import { redirect } from "next/navigation";

export default function WaitlistPage() {
  const webAppOrigin = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "";
  redirect(`${webAppOrigin}/onboarding`);
}
```

**Alternative approach:** If the `NEXT_PUBLIC_WEB_APP_URL` might be empty, create a small intermediate page that links to onboarding instead:

```tsx
import Link from "next/link";
import { Building2, ArrowRight, Sparkles } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";

export const metadata = {
  title: "Venteliste — SmartOut",
  description: "Kom i gang med SmartOut — AI-drevet workforce management.",
};

export default function WaitlistPage() {
  const webAppOrigin = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "";
  const onboardingHref = `${webAppOrigin}/onboarding`;

  return (
    <div className="relative min-h-screen bg-[#050505] text-white selection:bg-orange-500/30">
      <Navigation />
      <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        <div className="text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-500/20 bg-orange-500/10">
            <Sparkles className="h-10 w-10 text-orange-400" />
          </div>
          <h1 className="mb-4 text-4xl font-black tracking-tighter md:text-5xl">
            Klar for å komme i gang?
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-lg text-zinc-400">
            SmartOut er nå åpen for nye kunder. Start din onboarding i dag.
          </p>
          <Link
            href={onboardingHref}
            className="inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-lg font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(255,255,255,0.25)]"
          >
            Kom i gang <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

**Step 2: Test that `/waitlist` loads and CTA works**

**Step 3: Commit**

```bash
git add apps/landing/src/app/waitlist/page.tsx
git commit -m "feat(landing): add waitlist page with onboarding redirect

Previously a 404. Now shows a branded page directing users to onboarding."
```

---

## Task 6: Redesign Login and Signup Pages to Match Dark Theme

**Files:**

- Modify: `apps/landing/src/app/login/page.tsx`
- Modify: `apps/landing/src/app/signup/page.tsx`

**Why:** These pages are completely off-brand:

- Light mode (`bg-gray-50`) while everything else is dark
- English text ("Sign in to your account") while everything is Norwegian
- Indigo accent colors while the brand uses orange
- Generic design with no SmartOut branding
- `action="#"` forms that submit to nowhere

**Decision:** These pages on the LANDING site should redirect users to the WEB APP's auth pages. The landing page is a marketing site — auth lives in `apps/web`. Replace with branded redirect pages.

**Step 1: Redesign login page as branded redirect**

```tsx
import Link from "next/link";
import { Building2, ArrowRight, LogIn } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";

export const metadata = {
  title: "Logg inn — SmartOut",
  description: "Logg inn på SmartOut dashboardet ditt.",
};

export default function LoginPage() {
  const webAppOrigin = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "";
  const loginHref = `${webAppOrigin}/login`;
  const signupHref = `${webAppOrigin}/onboarding`;

  return (
    <div className="relative min-h-screen bg-[#050505] text-white selection:bg-orange-500/30">
      <Navigation />
      <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <LogIn className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="mb-3 text-3xl font-black tracking-tighter">Logg inn</h1>
          <p className="mb-10 text-zinc-400">Gå til SmartOut dashboardet for å logge inn.</p>
          <Link
            href={loginHref}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            Gå til innlogging <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-sm text-zinc-500">
            Har du ikke konto?{" "}
            <Link href={signupHref} className="font-semibold text-orange-400 hover:text-orange-300">
              Kom i gang
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

**Step 2: Redesign signup page similarly**

Same pattern but with "Opprett konto" heading and link to onboarding. Include `UserPlus` icon instead of `LogIn`.

**Step 3: Verify both pages match the dark theme**

**Step 4: Commit**

```bash
git add apps/landing/src/app/login/page.tsx apps/landing/src/app/signup/page.tsx
git commit -m "fix(landing): redesign login/signup pages to match dark theme

Replaces off-brand light-mode English pages with branded Norwegian
redirect pages that link to the web app's actual auth flow."
```

---

## Task 7: Fix `/concepts/lokations` — Translate English Text to Norwegian

**Files:**

- Modify: `apps/landing/src/app/concepts/lokations/page.tsx`

**Why:** This page has English text throughout ("Active Locations", "Registered Zones", "Tasks Completed", etc.) while every other page is Norwegian. Also has duplicate grid class `md:grid-cols-2 md:grid-cols-4` (line 96).

**Step 1: Translate all English strings**

| English                      | Norwegian                      |
| ---------------------------- | ------------------------------ |
| Active Locations             | Aktive Lokasjoner              |
| Registered Zones             | Registrerte Soner              |
| Checkpoints                  | Kontrollpunkter                |
| Total Tasks                  | Totale Oppgaver                |
| Active Routines              | Aktive Rutiner                 |
| Procedures                   | Prosedyrer                     |
| Live Policies                | Aktive Retningslinjer          |
| Automations                  | Automatiseringer               |
| Daily Quality Score          | Daglig Kvalitetspoeng          |
| Success Rate (All Locations) | Suksessrate (Alle Lokasjoner)  |
| Tasks Completed              | Oppgaver Fullført              |
| Missed/Overdue               | Manglende/Forfalt              |
| All metrics represent...     | Alle målinger representerer... |

**Step 2: Fix the duplicate grid class**

```tsx
// BEFORE (line 96):
className = "grid grid-cols-2 md:grid-cols-2 md:grid-cols-4 gap-4";

// AFTER:
className = "grid grid-cols-2 md:grid-cols-4 gap-4";
```

**Step 3: Commit**

```bash
git add apps/landing/src/app/concepts/lokations/page.tsx
git commit -m "fix(landing): translate lokations page from English to Norwegian

Consistent with all other pages. Also fixes duplicate grid-cols class."
```

---

## Task 8: Add Page-Level Metadata (SEO)

**Files:**

- Modify: All page files that lack `export const metadata`

**Why:** Only root layout and docs layout export metadata. Every page should have its own title and description for SEO and social sharing.

**Step 1: Add metadata exports to all pages**

For `"use client"` pages, metadata must be extracted to a separate `layout.tsx` or the page must be split. Since most pages are `"use client"`, the simplest approach is to add `generateMetadata` in small layout files OR use the `<title>` tag via `next/head` — but in App Router, the correct approach is to create a thin `layout.tsx` wrapper or convert the page to a server component that wraps a client component.

**Pragmatic approach:** For pages that are `"use client"`, create a minimal `layout.tsx` sibling:

```tsx
// apps/landing/src/app/pricing/layout.tsx (example)
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Priser — SmartOut",
  description: "Enkle og forutsigbare priser. Full kontroll til en fast pris.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Pages needing metadata layouts:

| Route                               | Title                                  | Description                                                     |
| ----------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| `/pricing`                          | "Priser — SmartOut"                    | "Enkle og forutsigbare priser. Full kontroll til en fast pris." |
| `/om-oss`                           | "Om Oss — SmartOut"                    | "Drevet av lidenskap for gjestfrihet. Vår historie."            |
| `/blog`                             | "Kundehistorier — SmartOut"            | "Les om hvordan Norges beste restauranter bruker SmartOut."     |
| `/login`                            | "Logg inn — SmartOut"                  | "Logg inn på SmartOut dashboardet."                             |
| `/signup`                           | "Opprett konto — SmartOut"             | "Kom i gang med SmartOut."                                      |
| `/waitlist`                         | "Venteliste — SmartOut"                | (already has metadata if created as server component)           |
| `/features/shiftplanner`            | "Vaktlister & Lønnskjøring — SmartOut" | "AI-drevet vaktplanlegging."                                    |
| `/features/communications`          | "Kommunikasjon — SmartOut"             | "Sømløs kommunikasjon for ditt team."                           |
| `/features/task-rutines`            | "Oppgaver & Rutiner — SmartOut"        | "Digitale oppgavelister og rutiner."                            |
| `/features/staff-training`          | "HR & Opplæring — SmartOut"            | "Onboarding og opplæring av ansatte."                           |
| `/features/haccp-complience`        | "IK-Mat & Avvik — SmartOut"            | "Digitalt HACCP-system for mattrygghet."                        |
| `/features/punchclock-timetracking` | "Timeføring — SmartOut"                | "Stemplingsur og timeregistrering."                             |
| `/concepts/daily-session`           | "Den Daglige Økten — SmartOut"         | "Slik fungerer en typisk dag med SmartOut."                     |
| `/concepts/seasons`                 | "Sesonger — SmartOut"                  | "Sesongbasert drift med SmartOut."                              |
| `/concepts/procedures`              | "Prosedyrer — SmartOut"                | "Standardiserte prosedyrer for konsistent drift."               |
| `/concepts/lokations`               | "Lokasjoner — SmartOut"                | "Kapasitet og datavolum for dine lokasjoner."                   |

**Step 2: Create layout.tsx for each route that needs metadata**

Each is a 9-line file. Create them all.

**Step 3: Verify titles show in browser tab**

**Step 4: Commit**

```bash
git add apps/landing/src/app/*/layout.tsx apps/landing/src/app/*/*/layout.tsx
git commit -m "feat(landing): add page-level metadata for SEO

Every page now has a proper title and description for search engines
and social sharing."
```

---

## Task 9: Mobile Typography Fix — Prevent Text Overflow

**Files:**

- Modify: Pages with `text-7xl` headings that don't scale down for mobile

**Why:** Several headings use `text-5xl md:text-7xl` which is fine, but some use just `text-7xl` without a mobile-first smaller size. On 320px screens, these can overflow.

**Step 1: Audit and fix all headings**

Search for headings that jump directly to large sizes without mobile breakpoints:

| File                  | Current                    | Fix to                                            |
| --------------------- | -------------------------- | ------------------------------------------------- |
| `pricing/page.tsx:52` | `text-5xl ... md:text-7xl` | Already OK                                        |
| `om-oss/page.tsx:46`  | `text-5xl ... md:text-7xl` | Already OK                                        |
| `blog/page.tsx:41`    | `text-5xl md:text-7xl`     | Already OK                                        |
| Home page hero        | Check actual markup        | Verify `text-4xl sm:text-5xl md:text-7xl` pattern |

Also check that no text uses `text-7xl` without a `md:` or `lg:` prefix.

**Step 2: Test at 320px viewport width**

Run through every page at 320px width:

- No horizontal scrollbar
- No text clipping
- Touch targets >= 44px
- Cards don't break their layout

**Step 3: Fix any issues found**

Common fixes:

- Add `text-3xl sm:text-4xl md:text-5xl` progressive scaling
- Add `break-words` to long headings
- Ensure `overflow-x-hidden` is on the root div of every page
- Check `px-4 sm:px-6` padding on mobile

**Step 4: Commit**

```bash
git add apps/landing/src/app/
git commit -m "fix(landing): ensure all headings scale properly on small screens

Progressive text sizing from mobile to desktop on all pages."
```

---

## Task 10: Consistent Page Backgrounds

**Files:**

- Modify: `apps/landing/src/app/login/page.tsx` (already fixed in Task 6)
- Modify: `apps/landing/src/app/signup/page.tsx` (already fixed in Task 6)
- Verify: All other pages use `bg-[#050505]` consistently

**Why:** Login/signup use `bg-gray-50` (light). Most pages use `bg-[#050505]`. Root layout uses `bg-zinc-950`. The login/signup fix in Task 6 resolves the worst offenders. For the rest, `bg-[#050505]` and `bg-zinc-950` are visually near-identical (#050505 vs #09090b) so no action needed there.

**Step 1: Verify after Task 6 that no light-mode pages remain**

**Step 2: No additional commit needed if Task 6 covers it**

---

## Task 11: Full Button & Link Audit — Manual QA Checklist

**This is a manual testing task, not a code task.** Run the landing dev server and click every interactive element.

Run: `pnpm --filter landing dev` (port 3055)

### Home Page (`/`)

- [ ] Logo → `/` (should stay on home)
- [ ] Nav links: Om Oss, Priser, Kundehistorier, Dokumentasjon, Funksjoner → correct destinations
- [ ] "Kom i gang" nav CTA → web app onboarding
- [ ] Mobile hamburger opens/closes
- [ ] Mobile nav links all work
- [ ] Voice Assistant toggle → opens/closes voice UI
- [ ] Location cards (Sentralstasjonen, etc.) → `/concepts/lokations`
- [ ] Procedure cards → `/concepts/procedures`
- [ ] Feature cards in grid → respective `/features/*` pages
- [ ] Hero "Kom i gang" CTA → web app onboarding
- [ ] Footer links → correct destinations
- [ ] `/#features` anchor scrolls to features section

### Pricing (`/pricing`)

- [ ] "Kom i gang" (Essential) → web app onboarding
- [ ] "Velg Pro" → web app onboarding
- [ ] Footer links work

### Om Oss (`/om-oss`)

- [ ] Back button → goes back
- [ ] "Start din SmartOut i dag" CTA → web app onboarding
- [ ] Footer links work

### Blog (`/blog`)

- [ ] Story cards are NOT links (after Task 4 fix)
- [ ] "Kommer snart" badges visible
- [ ] Footer links work

### Feature Pages (x6)

For each: `/features/shiftplanner`, `communications`, `task-rutines`, `staff-training`, `haccp-complience`, `punchclock-timetracking`:

- [ ] Back button → goes back
- [ ] Interactive demo elements work (tabs, toggles, buttons)
- [ ] NextPageBanner → links to next feature page
- [ ] Footer links work

### Concept Pages (x4)

For each: `/concepts/daily-session`, `seasons`, `procedures`, `lokations`:

- [ ] Back button → goes back
- [ ] Any CTA buttons → correct destinations
- [ ] NextPageBanner → links to next concept page
- [ ] Footer links work

### Docs (`/docs` and subpages)

- [ ] Overview cards → correct doc pages
- [ ] Sidebar navigation works on desktop
- [ ] Sidebar mobile toggle works
- [ ] All doc pages render content
- [ ] "Kontakt oss" → `/pricing`

### Auth Pages

- [ ] `/login` → branded dark page with link to web app login
- [ ] `/signup` → branded dark page with link to web app onboarding

### Waitlist

- [ ] `/waitlist` → shows branded page with CTA to onboarding

### Cross-cutting

- [ ] No 404 pages reachable from any link
- [ ] No horizontal scroll on any page at 375px viewport
- [ ] All pages have correct `<title>` in browser tab
- [ ] Footer consistent across all pages

---

## Task 12: Final Commit and Build Verification

**Step 1: Run lint and typecheck**

```bash
pnpm --filter landing lint
pnpm --filter landing typecheck
```

Fix any errors.

**Step 2: Run production build**

```bash
pnpm --filter landing build
```

Verify no build errors.

**Step 3: Test production build locally**

```bash
cd apps/landing && pnpm start
```

Navigate through all pages and verify everything works in production mode.

**Step 4: Final commit if any fixes were needed**

```bash
git add apps/landing/
git commit -m "fix(landing): resolve lint/typecheck/build issues from polish pass"
```

---

## Execution Order

Tasks can be grouped for efficiency:

| Phase               | Tasks            | Dependency                       |
| ------------------- | ---------------- | -------------------------------- |
| 1 — Navigation      | Task 1 + Task 2  | None                             |
| 2 — Footer          | Task 3           | None (can parallel with Phase 1) |
| 3 — Broken Links    | Task 4 + Task 5  | None                             |
| 4 — Off-Brand Pages | Task 6           | Task 3 (needs Footer component)  |
| 5 — Content Fix     | Task 7           | None                             |
| 6 — SEO             | Task 8           | None                             |
| 7 — Mobile Polish   | Task 9 + Task 10 | After all page changes           |
| 8 — QA              | Task 11          | After all code changes           |
| 9 — Build Verify    | Task 12          | After all fixes                  |

**Parallel tracks possible:** Tasks 1-2, 3, 4-5, 7, 8 are all independent and can be worked on simultaneously by separate agents.
