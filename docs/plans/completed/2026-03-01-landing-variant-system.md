---
title: "Landing Variant System"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# Landing Variant System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full landing variant system with 4 variants (A/default, B/action, C/sen, D/restaurant), URL-based routing, DB-driven industry content, admin content management with section placement, visitor session tracking, and a website analytics dashboard in platform-admin.

**Architecture:** URL-based variant routing via `[variantSlug]/page.tsx` catch-all. General variants (A, B, C) are standalone components. Industry variants (D+) share a template component fed by `landing_config.config_json`. PostHog handles session recording + custom events. Own database tables (`landing_visitor_session`, `landing_visitor_event`) provide a lightweight visitor log for the admin dashboard. Config flows down (admin → landing), analytics flows up (landing → admin).

**Tech Stack:** Next.js 16 App Router, React 19, Framer Motion, PostHog (EU), Supabase (`landing_config` + visitor tables), `@smartout/telemetry` package, Zod validation, Recharts (admin charts).

---

## Phase 1 — Foundation (Routing & Registry)

### Task 1: Rewrite variant registry

**Files:**

- Modify: `apps/landing/src/lib/landing-variant.ts`
- Modify: `apps/landing/src/env.ts`

**Step 1: Rewrite landing-variant.ts to registry-based system**

```typescript
import type { ComponentType } from "react";

export type VariantCode = "A" | "B" | "C" | "D";
export type VariantType = "general" | "sen" | "industry";

export interface VariantEntry {
  code: VariantCode;
  slug: string;
  label: string;
  type: VariantType;
  vertical?: string;
}

export const VARIANT_REGISTRY: VariantEntry[] = [
  { code: "A", slug: "default", label: "Standard", type: "general" },
  { code: "B", slug: "action", label: "Action", type: "general" },
  { code: "C", slug: "sen", label: "SEN", type: "sen" },
  { code: "D", slug: "restaurant", label: "Restaurant", type: "industry", vertical: "restaurant" },
];

export function getVariantBySlug(slug: string): VariantEntry | undefined {
  return VARIANT_REGISTRY.find((v) => v.slug === slug);
}

export function getVariantByCode(code: string): VariantEntry | undefined {
  return VARIANT_REGISTRY.find((v) => v.code === code);
}

const ADMIN_STORAGE_KEY = "landing_admin_mode";

export function isAdminMode(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  return localStorage.getItem(ADMIN_STORAGE_KEY) === "true";
}

export function activateAdminMode(secret: string): boolean {
  if (typeof window === "undefined") return false;
  const expected = process.env.NEXT_PUBLIC_LANDING_ADMIN_SECRET;
  if (!expected || secret !== expected) return false;
  localStorage.setItem(ADMIN_STORAGE_KEY, "true");
  return true;
}
```

**Step 2: Update env.ts — expand variant enum, add admin secret**

In `apps/landing/src/env.ts`, change the client section:

```typescript
// Replace:
NEXT_PUBLIC_LANDING_VARIANT: z.enum(["B", "E"]).default("B"),

// With:
NEXT_PUBLIC_LANDING_VARIANT: z.enum(["A", "B", "C", "D"]).default("A"),
NEXT_PUBLIC_LANDING_ADMIN_SECRET: z.string().optional(),
```

Add to `experimental__runtimeEnv`:

```typescript
NEXT_PUBLIC_LANDING_ADMIN_SECRET: process.env.NEXT_PUBLIC_LANDING_ADMIN_SECRET,
```

**Step 3: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS (page.tsx will have import errors — that's expected, we fix it next task)

**Step 4: Commit**

```bash
git add apps/landing/src/lib/landing-variant.ts apps/landing/src/env.ts
git commit -m "refactor(landing): rewrite variant registry with codes, slugs, types"
```

---

### Task 2: Rename VariantELanding to VariantActionLanding

**Files:**

- Rename: `apps/landing/src/components/landing/VariantELanding.tsx` → `apps/landing/src/components/landing/VariantActionLanding.tsx`
- Modify: `apps/landing/src/app/page.tsx`

**Step 1: Rename file**

```bash
cd apps/landing/src/components/landing
git mv VariantELanding.tsx VariantActionLanding.tsx
```

**Step 2: Update component name inside the file**

In `VariantActionLanding.tsx`, change:

```typescript
// From:
export default function VariantELanding() {
// To:
export default function VariantActionLanding() {
```

**Step 3: Update page.tsx — clean up variant switching, always render A**

Replace the variant-related imports and logic in `apps/landing/src/app/page.tsx`:

Remove these imports:

```typescript
import VariantELanding from "../components/landing/VariantELanding";
import { getEnvVariant, getDevOverride } from "../lib/landing-variant";
```

Remove `useEffect` import (if no longer needed elsewhere in the file — check first).

Remove these lines from the component body:

```typescript
const [variant, setVariant] = useState(getEnvVariant);
// ...
useEffect(() => {
  const override = getDevOverride();
  if (override && override !== variant) setVariant(override);
}, []);

if (variant === "E") return <VariantELanding />;
```

The root `/` page now always renders Variant A (the existing landing). Variant routing moves to `[variantSlug]/page.tsx` in the next task.

**Step 4: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(landing): rename VariantE to VariantAction, clean page.tsx to always render A"
```

---

### Task 3: Create [variantSlug] catch-all route

**Files:**

- Create: `apps/landing/src/app/[variantSlug]/page.tsx`

**Step 1: Create the dynamic route page**

```typescript
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getVariantBySlug } from "../../lib/landing-variant";
import type { VariantCode } from "../../lib/landing-variant";

const variantComponents: Record<string, ReturnType<typeof dynamic>> = {
  B: dynamic(() => import("../../components/landing/VariantActionLanding")),
  // C and D added in Phase 2
};

interface PageProps {
  params: Promise<{ variantSlug: string }>;
}

export default async function VariantPage({ params }: PageProps) {
  const { variantSlug } = await params;

  // "default" slug redirects to root
  if (variantSlug === "default") notFound();

  const entry = getVariantBySlug(variantSlug);
  if (!entry) notFound();

  const Component = variantComponents[entry.code];
  if (!Component) notFound();

  return <Component />;
}

export function generateStaticParams() {
  return [{ variantSlug: "action" }];
}
```

**Step 2: Run dev server and verify**

Run: `SKIP_ENV_VALIDATION=1 pnpm --filter landing dev`

- Visit `http://localhost:3055/` → Variant A (existing landing) renders
- Visit `http://localhost:3055/action` → Variant B (action landing) renders
- Visit `http://localhost:3055/bogus` → 404

**Step 3: Run build**

Run: `SKIP_ENV_VALIDATION=1 pnpm --filter landing build`
Expected: PASS, `/action` appears in static routes

**Step 4: Commit**

```bash
git add apps/landing/src/app/\[variantSlug\]/page.tsx
git commit -m "feat(landing): add [variantSlug] catch-all route with registry lookup"
```

---

## Phase 2 — New Variants

### Task 4: Create shared section components

**Files:**

- Create: `apps/landing/src/components/landing/sections/HeroSection.tsx`
- Create: `apps/landing/src/components/landing/sections/PainPointsSection.tsx`
- Create: `apps/landing/src/components/landing/sections/TestimonialSection.tsx`
- Create: `apps/landing/src/components/landing/sections/FaqSection.tsx`

These are configurable section components used by the industry template. Each accepts props matching the config_json shape.

**Step 1: Create HeroSection.tsx**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WEB_APP_LINKS } from "../../../lib/web-app-url";

interface HeroSectionProps {
  badge: string;
  headline: string;
  subhead: string;
  onCtaClick?: () => void;
}

export default function HeroSection({ badge, headline, subhead, onCtaClick }: HeroSectionProps) {
  const lines = headline.split("\n");

  return (
    <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
            </span>
            <span className="text-xs font-bold tracking-wider text-orange-400 uppercase">
              {badge}
            </span>
          </div>

          <h1 className="mb-6 text-5xl leading-[1.1] font-extrabold tracking-tight lg:text-7xl">
            {lines.map((line, i) =>
              i === lines.length - 1 ? (
                <span
                  key={i}
                  className="block bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent"
                >
                  {line}
                </span>
              ) : (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ),
            )}
          </h1>

          <p className="mb-8 max-w-xl text-lg leading-relaxed text-zinc-400">{subhead}</p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={onCtaClick}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all hover:bg-orange-400 hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]"
            >
              Kom I Gang Nå <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="#features"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-700 hover:bg-zinc-800"
            >
              Se Funksjoner
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Create PainPointsSection.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import { AlertCircle, Clock, Users, type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  alert: AlertCircle,
  clock: Clock,
  users: Users,
};

interface PainPoint {
  title: string;
  value: string;
  desc: string;
  icon: string;
}

interface PainPointsSectionProps {
  headline?: string;
  subhead?: string;
  items: PainPoint[];
}

export default function PainPointsSection({
  headline = "Hvor mye koster kaoset?",
  subhead,
  items,
}: PainPointsSectionProps) {
  return (
    <section className="relative overflow-hidden bg-zinc-950 px-6 py-32" data-section="pain-points">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/5 blur-[120px]" />
      <div className="relative z-10 mx-auto max-w-7xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">
            {headline.includes("kaoset") ? (
              <>
                {headline.split("kaoset")[0]}
                <span className="text-red-500">kaoset?</span>
              </>
            ) : (
              headline
            )}
          </h2>
          {subhead && <p className="mx-auto mb-16 max-w-2xl text-xl text-zinc-400">{subhead}</p>}
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((stat, idx) => {
            const Icon = ICON_MAP[stat.icon] ?? AlertCircle;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="rounded-3xl border border-red-500/10 bg-zinc-900/50 p-8 text-left transition-colors hover:border-red-500/30"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                  <Icon className="h-5 w-5 text-red-500" />
                </div>
                <div className="mb-2 text-4xl font-black text-white">{stat.value}</div>
                <div className="mb-2 text-lg font-bold text-zinc-200">{stat.title}</div>
                <p className="text-sm leading-relaxed text-zinc-500">{stat.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Create TestimonialSection.tsx**

```tsx
"use client";

import { Users } from "lucide-react";

interface TestimonialSectionProps {
  quote: string;
  name: string;
  role: string;
  company: string;
  stats?: { label: string; value: string; color?: string }[];
}

export default function TestimonialSection({
  quote,
  name,
  role,
  company,
  stats,
}: TestimonialSectionProps) {
  return (
    <section
      className="relative z-10 overflow-hidden border-t border-zinc-900 bg-zinc-950 px-6 py-40"
      data-section="testimonial"
    >
      <div className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-orange-500/5 blur-[120px]" />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
          <Users className="h-6 w-6 text-zinc-500" />
        </div>

        <h2 className="mb-8 text-3xl leading-tight font-black md:text-5xl">&quot;{quote}&quot;</h2>

        <div>
          <div className="text-lg font-bold">{name}</div>
          <div className="mt-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
            {role}, {company}
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-lg grid-cols-2 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className={`mb-1 text-3xl font-black ${stat.color ?? "text-orange-400"}`}>
                  {stat.value}
                </div>
                <div className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

**Step 4: Create FaqSection.tsx**

```tsx
"use client";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqSectionProps {
  headline?: string;
  subhead?: string;
  items: FaqItem[];
  onFaqOpen?: (index: number, question: string) => void;
}

export default function FaqSection({
  headline = "Vanlige Spørsmål",
  subhead,
  items,
  onFaqOpen,
}: FaqSectionProps) {
  return (
    <section className="border-t border-zinc-800 bg-zinc-900/30 px-6 py-24" data-section="faq">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-extrabold md:text-5xl">{headline}</h2>
          {subhead && <p className="mx-auto max-w-xl text-zinc-400">{subhead}</p>}
        </div>

        <div className="space-y-4">
          {items.map((faq, idx) => (
            <details
              key={idx}
              className="group rounded-2xl border border-zinc-800 bg-zinc-950 transition-colors hover:border-zinc-700"
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open && onFaqOpen) {
                  onFaqOpen(idx, faq.q);
                }
              }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-bold text-zinc-200">
                <span>{faq.q}</span>
                <span className="transition group-open:rotate-45">
                  <svg
                    fill="none"
                    height="24"
                    width="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                </span>
              </summary>
              <div className="px-6 pt-0 pb-6 text-sm leading-relaxed text-zinc-500">{faq.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 5: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/landing/src/components/landing/sections/
git commit -m "feat(landing): add shared configurable section components for industry variants"
```

---

### Task 5: Create VariantSenLanding component

**Files:**

- Create: `apps/landing/src/components/landing/VariantSenLanding.tsx`

**Step 1: Create the SEN variant**

This variant is soft, empathetic, focused on employee readiness. It uses warm language, calmer animations, and centers the employee journey. The component follows the same structure as VariantActionLanding but with different energy: softer gradients, emphasis on learning/confidence, SEN-specific messaging.

Create `apps/landing/src/components/landing/VariantSenLanding.tsx` — a full page component using:

- Shared `Navigation` and `Footer` components
- `WEB_APP_LINKS` for all CTAs
- `Link` from `next/link` for routing
- Framer Motion for subtle (not aggressive) animations
- `data-section` attributes on each section for analytics

**Design direction:**

- Hero: "Gjør hver ansatt trygg fra dag én" — confidence, readiness, not urgency
- Color accent: softer orange/amber, touches of emerald for progress/completion
- Pain points: frame as "challenges" not "chaos" — empathetic tone
- Features: focus on onboarding, training, daily support, knowledge tests
- Testimonial: employee perspective (not manager)
- CTA: "Start Opplæringen" instead of "Kom I Gang Nå"

The full component is ~600-800 lines. Build it by adapting the structure from VariantActionLanding.tsx but rewriting all copy, adjusting visual energy, and using the softer design tokens.

**Step 2: Register in [variantSlug]/page.tsx**

Add to the `variantComponents` map:

```typescript
C: dynamic(() => import("../../components/landing/VariantSenLanding")),
```

Add to `generateStaticParams`:

```typescript
return [{ variantSlug: "action" }, { variantSlug: "sen" }];
```

**Step 3: Verify**

Run: `SKIP_ENV_VALIDATION=1 pnpm --filter landing dev`

- Visit `http://localhost:3055/sen` → SEN variant renders
- Visit `http://localhost:3055/action` → Action variant still works
- Visit `http://localhost:3055/` → Default still works

**Step 4: Commit**

```bash
git add apps/landing/src/components/landing/VariantSenLanding.tsx apps/landing/src/app/\[variantSlug\]/page.tsx
git commit -m "feat(landing): add SEN variant (C) with soft, employee-readiness messaging"
```

---

### Task 6: Create landing config schema and fetch helper

**Files:**

- Create: `apps/landing/src/lib/landing-config.ts`

**Step 1: Create Zod schemas and fetch helper**

```typescript
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const painPointSchema = z.object({
  title: z.string(),
  value: z.string(),
  desc: z.string(),
  icon: z.string().default("alert"),
});

const testimonialSchema = z.object({
  quote: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        color: z.string().optional(),
      }),
    )
    .optional(),
});

const faqSchema = z.object({
  q: z.string(),
  a: z.string(),
});

const featureSchema = z.object({
  title: z.string(),
  desc: z.string(),
  icon: z.string(),
});

const industryContentSchema = z.object({
  hero: z.object({
    badge: z.string(),
    headline: z.string(),
    subhead: z.string(),
  }),
  painPoints: z.array(painPointSchema).optional(),
  painPointsHeadline: z.string().optional(),
  painPointsSubhead: z.string().optional(),
  features: z.array(featureSchema).optional(),
  testimonial: testimonialSchema.optional(),
  faq: z.array(faqSchema).optional(),
  faqHeadline: z.string().optional(),
  faqSubhead: z.string().optional(),
});

export const configJsonSchema = z.discriminatedUnion("variant_type", [
  z.object({
    variant_type: z.literal("general"),
    variant_code: z.string(),
    component: z.string(),
  }),
  z.object({
    variant_type: z.literal("sen"),
    variant_code: z.string(),
    component: z.string(),
  }),
  z.object({
    variant_type: z.literal("industry"),
    variant_code: z.string(),
    component: z.literal("industry"),
    vertical: z.string(),
    content: industryContentSchema,
  }),
]);

export type IndustryConfig = z.infer<typeof industryContentSchema>;
export type LandingConfigJson = z.infer<typeof configJsonSchema>;

export async function fetchPublishedConfig(slug: string): Promise<LandingConfigJson | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("landing_config")
    .select("config_json, published_json, status")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data) return null;

  const json = data.published_json ?? data.config_json;
  const parsed = configJsonSchema.safeParse(json);
  if (!parsed.success) {
    console.error(`Invalid config for slug "${slug}":`, parsed.error.flatten());
    return null;
  }

  return parsed.data;
}
```

**Step 2: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/landing/src/lib/landing-config.ts
git commit -m "feat(landing): add Zod schemas and fetch helper for landing_config"
```

---

### Task 7: Create VariantIndustryLanding template component

**Files:**

- Create: `apps/landing/src/components/landing/VariantIndustryLanding.tsx`

**Step 1: Create the industry template component**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Clock,
  CheckCircle2,
  Sparkles,
  Zap,
  BarChart3,
  Building,
  TrendingUp,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import HeroSection from "./sections/HeroSection";
import PainPointsSection from "./sections/PainPointsSection";
import TestimonialSection from "./sections/TestimonialSection";
import FaqSection from "./sections/FaqSection";
import type { IndustryConfig } from "../../lib/landing-config";

interface VariantIndustryLandingProps {
  config: IndustryConfig;
}

const DEFAULT_FEATURES = [
  {
    title: "Smart Vaktplanlegging",
    desc: "La AI bygge den optimale planen basert på historisk data og prognoser.",
    icon: <Clock className="h-5 w-5 text-zinc-300" />,
  },
  {
    title: "Live Lønnsprognoser",
    desc: "Se nøyaktig hva dagen koster før den starter.",
    icon: <TrendingUp className="h-5 w-5 text-zinc-300" />,
  },
  {
    title: "Automatisk Compliance",
    desc: "Få varsler før overtidsbrudd eller brudd på hviletid skjer.",
    icon: <Shield className="h-5 w-5 text-zinc-300" />,
  },
  {
    title: "Arbeidsgiver Hub",
    desc: "Sentraliserte kontrakter, dokumenter og kommunikasjon.",
    icon: <Building className="h-5 w-5 text-zinc-300" />,
  },
];

const DEFAULT_PAIN_POINTS = [
  {
    title: "Overtidsbrudd",
    value: "+18%",
    desc: "Dyrere personalkostnad på grunn av manglende varsling og oversikt over timer.",
    icon: "alert",
  },
  {
    title: "Administrasjon",
    value: "40 t",
    desc: "Tapt per måned pr enhet på manuell vaktplanlegging og lønnskjøring.",
    icon: "clock",
  },
  {
    title: "Turnover",
    value: "3x",
    desc: "Høyere sjanse for at ansatte slutter når kommunikasjonen er uforutsigbar.",
    icon: "users",
  },
];

const DEFAULT_FAQ = [
  {
    q: "Hvor lang tid tar det å komme i gang?",
    a: "En enhet med 30 ansatte kan være i full drift innen 48 timer fra onboarding.",
  },
  {
    q: "Integrerer dere med vårt nåværende system?",
    a: "Vi integrerer med markedets ledende aktører for sanntids data direkte inn i vaktplanleggeren.",
  },
  {
    q: "Krever det mye opplæring?",
    a: "Appen er designet for å være like intuitiv som sosiale medier. Ansatte forstår basisfunksjoner uten opplæring.",
  },
  {
    q: "Er det bindingstid?",
    a: "Måned for måned, eller årlig med 20% rabatt. Ingen bindingstid.",
  },
];

export default function VariantIndustryLanding({ config }: VariantIndustryLandingProps) {
  const painPoints = config.painPoints ?? DEFAULT_PAIN_POINTS;
  const faq = config.faq ?? DEFAULT_FAQ;

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-orange-500/30">
      <Navigation />

      {/* Configurable Hero */}
      <HeroSection
        badge={config.hero.badge}
        headline={config.hero.headline}
        subhead={config.hero.subhead}
      />

      {/* Configurable Pain Points */}
      <PainPointsSection
        headline={config.painPointsHeadline}
        subhead={config.painPointsSubhead}
        items={painPoints}
      />

      {/* Features — shared section, uses defaults or config overrides */}
      <section
        id="features"
        className="relative z-10 border-y border-zinc-800 bg-zinc-900/30 py-40"
        data-section="features"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-extrabold md:text-5xl">
              Alt du trenger for å skalere.
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-400">
              Erstatter 5 forskjellige verktøy med ett sammenhengende operativsystem.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {DEFAULT_FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 transition-colors hover:bg-zinc-900"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Three Steps — shared */}
      <section
        className="relative overflow-hidden border-t border-zinc-900 bg-zinc-950 px-6 py-40"
        data-section="three-steps"
      >
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-24 text-center">
            <h2 className="mb-6 text-4xl font-black tracking-tight text-white md:text-6xl">
              Tre steg til fred i{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                sinnet.
              </span>
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Smartout Lærer",
                desc: "Vi tygger gjerne i oss dine historiske data, værmeldinger og bookinger.",
                icon: <BarChart3 className="h-6 w-6" />,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
              },
              {
                step: "2",
                title: "AI Magi",
                desc: "Vår algoritme skreddersyr en lovlig, optimal vaktplan på sekunder.",
                icon: <Zap className="h-6 w-6" />,
                color: "text-orange-400",
                bg: "bg-orange-500/10",
                border: "border-orange-500/20",
              },
              {
                step: "3",
                title: "Sømløs Synk",
                desc: "Godkjente timer spretter direkte inn i ditt eksisterende lønnssystem.",
                icon: <ArrowRight className="h-6 w-6" />,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring", bounce: 0.4, delay: idx * 0.1 }}
                className="relative rounded-[2.5rem] border border-zinc-800 bg-zinc-900/40 p-10 text-center shadow-xl transition-colors hover:bg-zinc-900"
              >
                <div className="absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 font-black shadow-md">
                  <span className={item.color}>{item.step}</span>
                </div>
                <div
                  className={`mx-auto h-20 w-20 ${item.bg} mb-8 flex items-center justify-center rounded-[2rem] border shadow-inner ${item.border}`}
                >
                  <div className={item.color}>{item.icon}</div>
                </div>
                <h3 className="mb-4 text-2xl font-bold text-white">{item.title}</h3>
                <p className="leading-relaxed font-medium text-zinc-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Configurable Testimonial */}
      {config.testimonial && (
        <TestimonialSection
          quote={config.testimonial.quote}
          name={config.testimonial.name}
          role={config.testimonial.role}
          company={config.testimonial.company}
          stats={config.testimonial.stats}
        />
      )}

      {/* Security — shared */}
      <section className="relative z-10 bg-zinc-950 px-6 py-40" data-section="security">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
              <Shield className="h-8 w-8 text-zinc-100" />
            </div>
            <h2 className="mb-6 text-3xl font-black tracking-tight md:text-5xl">
              Bygget for trygghet.
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-zinc-400">
              GDPR-sertifisert, automatisk AML-validering, og bank-grad sikkerhet med RBAC og full
              revisjonslogg.
            </p>
            <div className="space-y-4">
              {["GDPR-Sertifisert", "Arbeidsmiljøloven (AML)", "Bank-grad Sikkerhet"].map(
                (item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-zinc-500" />
                    <span className="font-medium text-zinc-300">{item}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Configurable FAQ */}
      <FaqSection headline={config.faqHeadline} subhead={config.faqSubhead} items={faq} />

      {/* CTA — shared */}
      <section className="px-6 py-24" data-section="cta">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-10 text-center md:p-20">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-orange-500/10 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" />
          <h2 className="relative z-10 mb-6 text-4xl font-extrabold md:text-6xl">
            Klar til å transformere driften?
          </h2>
          <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={WEB_APP_LINKS.onboarding}
              className="w-full rounded-xl bg-white px-8 py-4 text-center text-lg font-black text-zinc-950 transition-colors hover:bg-zinc-200 sm:w-auto"
            >
              Start Gratis Prøveperiode
            </Link>
            <Link
              href="/pricing"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-8 py-4 text-center text-lg font-bold text-white transition-colors hover:bg-zinc-700 sm:w-auto"
            >
              Kontakt Salg
            </Link>
          </div>
          <p className="relative z-10 mt-6 text-sm text-zinc-500">
            Ingen kredittkort påkrevd. 14 dagers gratis prøveperiode.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
```

**Step 2: Wire industry variant into [variantSlug]/page.tsx**

Update `apps/landing/src/app/[variantSlug]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getVariantBySlug } from "../../lib/landing-variant";
import { fetchPublishedConfig } from "../../lib/landing-config";
import type { LandingConfigJson } from "../../lib/landing-config";
import VariantIndustryLanding from "../../components/landing/VariantIndustryLanding";

const variantComponents: Record<string, ReturnType<typeof dynamic>> = {
  B: dynamic(() => import("../../components/landing/VariantActionLanding")),
  C: dynamic(() => import("../../components/landing/VariantSenLanding")),
};

interface PageProps {
  params: Promise<{ variantSlug: string }>;
}

export default async function VariantPage({ params }: PageProps) {
  const { variantSlug } = await params;

  if (variantSlug === "default") notFound();

  const entry = getVariantBySlug(variantSlug);
  if (!entry) notFound();

  // Industry variants: fetch config from DB
  if (entry.type === "industry") {
    const config = await fetchPublishedConfig(variantSlug);
    if (!config || config.variant_type !== "industry") notFound();
    return <VariantIndustryLanding config={config.content} />;
  }

  // General/SEN variants: render component directly
  const Component = variantComponents[entry.code];
  if (!Component) notFound();
  return <Component />;
}

export function generateStaticParams() {
  return [{ variantSlug: "action" }, { variantSlug: "sen" }];
}
```

**Step 3: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/landing/src/components/landing/VariantIndustryLanding.tsx apps/landing/src/app/\[variantSlug\]/page.tsx
git commit -m "feat(landing): add industry template variant with DB-driven content"
```

---

### Task 8: Seed restaurant config in landing_config

**Files:**

- Create: `supabase/seed-restaurant-config.sql` (or run via `execute_sql`)

**Step 1: Insert a published landing_config row for restaurant**

Execute this SQL against local Supabase (or via the admin API):

```sql
INSERT INTO landing_config (slug, name, locale, status, config_json, published_json, version, published_at)
VALUES (
  'restaurant',
  'Restaurant Landing',
  'no',
  'published',
  '{
    "variant_type": "industry",
    "variant_code": "D",
    "component": "industry",
    "vertical": "restaurant",
    "content": {
      "hero": {
        "badge": "Bygget for restaurantbransjen",
        "headline": "Intelligent\nVaktplanlegging.",
        "subhead": "Slutt å drive restauranten i skjøre regneark. Smartout orkestrerer hele driften din – fra kontrakter til live lønnsprognoser – i én intelligent plattform."
      },
      "painPointsHeadline": "Hvor mye koster kaoset?",
      "painPointsSubhead": "Regneark, Facebook-grupper og gule lapper. Det er ikke bare utmattende – det er et massivt inntektstap.",
      "painPoints": [
        { "title": "Overtidsbrudd", "value": "+18%", "desc": "Dyrere personalkostnad på grunn av manglende varsling.", "icon": "alert" },
        { "title": "Administrasjon", "value": "40 t", "desc": "Tapt per måned per restaurant på manuell lønnskjøring.", "icon": "clock" },
        { "title": "Turnover", "value": "3x", "desc": "Høyere sjanse for at ansatte slutter med uforutsigbare vakter.", "icon": "users" }
      ],
      "testimonial": {
        "quote": "Smartout forandret alt. Vi sparer 40 timer i måneden kun på vaktplanlegging, og personalet elsker appen.",
        "name": "Sofia Lindström",
        "role": "Driftssjef",
        "company": "Urban Deli",
        "stats": [
          { "label": "Admin per måned", "value": "-40t", "color": "text-orange-400" },
          { "label": "Team Tilfredshet", "value": "100%", "color": "text-emerald-400" }
        ]
      },
      "faqHeadline": "Vanlige Spørsmål",
      "faqSubhead": "Svar på det restaurantledere oftest lurer på.",
      "faq": [
        { "q": "Hvor lang tid tar det å komme i gang?", "a": "En restaurant på 30 ansatte kan være i full drift innen 48 timer." },
        { "q": "Integrerer dere med vårt POS-system?", "a": "Vi integrerer med Zettle, Trivec, Lightspeed og flere for sanntids salgsdata." },
        { "q": "Krever det mye opplæring?", "a": "Appen er like intuitiv som sosiale medier. Ingen opplæring nødvendig." },
        { "q": "Er det bindingstid?", "a": "Nei. Måned for måned, eller årlig med 20% rabatt." }
      ]
    }
  }'::jsonb,
  '{
    "variant_type": "industry",
    "variant_code": "D",
    "component": "industry",
    "vertical": "restaurant",
    "content": {
      "hero": {
        "badge": "Bygget for restaurantbransjen",
        "headline": "Intelligent\nVaktplanlegging.",
        "subhead": "Slutt å drive restauranten i skjøre regneark. Smartout orkestrerer hele driften din – fra kontrakter til live lønnsprognoser – i én intelligent plattform."
      },
      "painPointsHeadline": "Hvor mye koster kaoset?",
      "painPointsSubhead": "Regneark, Facebook-grupper og gule lapper. Det er ikke bare utmattende – det er et massivt inntektstap.",
      "painPoints": [
        { "title": "Overtidsbrudd", "value": "+18%", "desc": "Dyrere personalkostnad på grunn av manglende varsling.", "icon": "alert" },
        { "title": "Administrasjon", "value": "40 t", "desc": "Tapt per måned per restaurant på manuell lønnskjøring.", "icon": "clock" },
        { "title": "Turnover", "value": "3x", "desc": "Høyere sjanse for at ansatte slutter med uforutsigbare vakter.", "icon": "users" }
      ],
      "testimonial": {
        "quote": "Smartout forandret alt. Vi sparer 40 timer i måneden kun på vaktplanlegging, og personalet elsker appen.",
        "name": "Sofia Lindström",
        "role": "Driftssjef",
        "company": "Urban Deli",
        "stats": [
          { "label": "Admin per måned", "value": "-40t", "color": "text-orange-400" },
          { "label": "Team Tilfredshet", "value": "100%", "color": "text-emerald-400" }
        ]
      },
      "faqHeadline": "Vanlige Spørsmål",
      "faqSubhead": "Svar på det restaurantledere oftest lurer på.",
      "faq": [
        { "q": "Hvor lang tid tar det å komme i gang?", "a": "En restaurant på 30 ansatte kan være i full drift innen 48 timer." },
        { "q": "Integrerer dere med vårt POS-system?", "a": "Vi integrerer med Zettle, Trivec, Lightspeed og flere for sanntids salgsdata." },
        { "q": "Krever det mye opplæring?", "a": "Appen er like intuitiv som sosiale medier. Ingen opplæring nødvendig." },
        { "q": "Er det bindingstid?", "a": "Nei. Måned for måned, eller årlig med 20% rabatt." }
      ]
    }
  }'::jsonb,
  1,
  now()
);
```

**Step 2: Verify**

Run local Supabase, then visit `http://localhost:3055/restaurant` — should render the industry template with restaurant content.

**Step 3: Commit**

```bash
git commit -m "feat(landing): seed restaurant industry config in landing_config"
```

---

## Phase 3 — Admin Switcher

### Task 9: Create VariantSwitcher footer component

**Files:**

- Create: `apps/landing/src/components/landing/VariantSwitcher.tsx`
- Modify: `apps/landing/src/components/footer.tsx`

**Step 1: Create VariantSwitcher.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { VARIANT_REGISTRY, isAdminMode, activateAdminMode } from "../../lib/landing-variant";

export default function VariantSwitcher() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check admin mode
    if (isAdminMode()) {
      setVisible(true);
      return;
    }

    // Check for secret param in production
    const params = new URLSearchParams(window.location.search);
    const secret = params.get("admin");
    if (secret && activateAdminMode(secret)) {
      setVisible(true);
      // Clean URL
      params.delete("admin");
      const clean = params.toString();
      window.history.replaceState({}, "", pathname + (clean ? `?${clean}` : ""));
    }
  }, [pathname]);

  if (!visible) return null;

  // Determine current variant from pathname
  const currentSlug = pathname === "/" ? "default" : pathname.replace("/", "");

  return (
    <div className="mt-8 border-t border-zinc-800 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
          Variant
        </span>
        {VARIANT_REGISTRY.map((entry) => {
          const href = entry.slug === "default" ? "/" : `/${entry.slug}`;
          const isActive = entry.slug === currentSlug;
          return (
            <button
              key={entry.code}
              onClick={() => router.push(href)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                isActive
                  ? "bg-orange-500 text-white"
                  : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              {entry.code} — {entry.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Add VariantSwitcher to footer.tsx**

In `apps/landing/src/components/footer.tsx`, add the import and render it at the bottom of the footer container, before the closing `</div>` of the outer wrapper:

```typescript
// Add import at top:
import VariantSwitcher from "./landing/VariantSwitcher";

// Add inside the footer, after the copyright/legal row div:
<VariantSwitcher />
```

**Step 3: Verify**

- Dev mode (`localhost:3055`): switcher visible in footer, clicking pills navigates between variants
- Prod simulation: set `NODE_ENV=production`, visit without `?admin` — no switcher
- Prod simulation: visit with `?admin=<secret>` — switcher appears

**Step 4: Commit**

```bash
git add apps/landing/src/components/landing/VariantSwitcher.tsx apps/landing/src/components/footer.tsx
git commit -m "feat(landing): add admin variant switcher in footer"
```

---

## Phase 4 — Analytics

### Task 10: Add PostHog provider to landing app

**Files:**

- Create: `apps/landing/src/providers/posthog-provider.tsx`
- Modify: `apps/landing/src/app/layout.tsx`

**Step 1: Create posthog-provider.tsx**

Follow the pattern from `apps/web/src/components/providers/posthog-provider.tsx`:

```tsx
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = `${window.location.origin}${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: false,
      },
    });
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
```

**Step 2: Wrap layout.tsx with PostHogProvider**

In `apps/landing/src/app/layout.tsx`:

```typescript
// Add import:
import { Suspense } from "react";
import PostHogProvider from "../providers/posthog-provider";

// Wrap {children} in the body:
<body className={...}>
  <PostHogProvider>
    <Suspense>{children}</Suspense>
  </PostHogProvider>
  <Analytics />
  <SpeedInsights />
</body>
```

**Step 3: Run typecheck and verify**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/landing/src/providers/posthog-provider.tsx apps/landing/src/app/layout.tsx
git commit -m "feat(landing): add PostHog provider with session recording to landing app"
```

---

### Task 11: Add landing events to telemetry registry

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

**Step 1: Add landing event types to the registry**

Add these interfaces after the existing event types:

```typescript
// ── Landing ──────────────────────────────────────────────
export interface LandingPageViewedEvent extends BaseEvent {
  event: "landing page_viewed";
  properties: {
    variant_code: string;
    variant_slug: string;
    variant_type: string;
    vertical?: string;
  };
}

export interface LandingCtaClickedEvent extends BaseEvent {
  event: "landing cta_clicked";
  properties: {
    variant_code: string;
    cta_id: string;
  };
}

export interface LandingSectionViewedEvent extends BaseEvent {
  event: "landing section_viewed";
  properties: {
    variant_code: string;
    section_id: string;
  };
}

export interface LandingFaqOpenedEvent extends BaseEvent {
  event: "landing faq_opened";
  properties: {
    variant_code: string;
    faq_index: number;
    faq_question: string;
  };
}

export interface LandingSessionEndEvent extends BaseEvent {
  event: "landing session_end";
  properties: {
    variant_code: string;
    duration_seconds: number;
    max_scroll_percent: number;
    cta_count: number;
  };
}
```

Add to the `SmartoutEvent` union type:

```typescript
| LandingPageViewedEvent
| LandingCtaClickedEvent
| LandingSectionViewedEvent
| LandingFaqOpenedEvent
| LandingSessionEndEvent
```

Add to `EVENT_ROUTING`:

```typescript
"landing page_viewed": { destinations: ["posthog"], category: "landing" },
"landing cta_clicked": { destinations: ["posthog"], category: "landing" },
"landing section_viewed": { destinations: ["posthog"], category: "landing" },
"landing faq_opened": { destinations: ["posthog"], category: "landing" },
"landing session_end": { destinations: ["posthog"], category: "landing" },
```

**Step 2: Run typecheck**

Run: `cd packages/telemetry && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add landing_* event definitions to registry"
```

---

### Task 12: Create useLandingAnalytics hook

**Files:**

- Create: `apps/landing/src/lib/landing-analytics.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";

interface LandingAnalyticsConfig {
  variantCode: string;
  variantSlug: string;
  variantType: string;
  vertical?: string;
}

export function useLandingAnalytics(config: LandingAnalyticsConfig) {
  const startTime = useRef(Date.now());
  const maxScroll = useRef(0);
  const ctaCount = useRef(0);

  // Fire page_viewed on mount
  useEffect(() => {
    posthog.capture("landing page_viewed", {
      variant_code: config.variantCode,
      variant_slug: config.variantSlug,
      variant_type: config.variantType,
      vertical: config.vertical,
    });
  }, [config.variantCode, config.variantSlug, config.variantType, config.vertical]);

  // Track section visibility via IntersectionObserver
  useEffect(() => {
    const sections = document.querySelectorAll("[data-section]");
    if (sections.length === 0) return;

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionId = (entry.target as HTMLElement).dataset.section;
          if (!sectionId || seen.has(sectionId)) return;
          seen.add(sectionId);
          posthog.capture("landing section_viewed", {
            variant_code: config.variantCode,
            section_id: sectionId,
          });
        });
      },
      { threshold: 0.3 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [config.variantCode]);

  // Track max scroll percentage
  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      if (pct > maxScroll.current) maxScroll.current = pct;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fire session_end on unload
  useEffect(() => {
    function onEnd() {
      const duration = Math.round((Date.now() - startTime.current) / 1000);
      posthog.capture("landing session_end", {
        variant_code: config.variantCode,
        duration_seconds: duration,
        max_scroll_percent: maxScroll.current,
        cta_count: ctaCount.current,
      });
    }

    window.addEventListener("beforeunload", onEnd);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onEnd();
    });

    return () => {
      window.removeEventListener("beforeunload", onEnd);
    };
  }, [config.variantCode]);

  const trackCta = useCallback(
    (ctaId: string) => {
      ctaCount.current += 1;
      posthog.capture("landing cta_clicked", {
        variant_code: config.variantCode,
        cta_id: ctaId,
      });
    },
    [config.variantCode],
  );

  const trackFaqOpen = useCallback(
    (index: number, question: string) => {
      posthog.capture("landing faq_opened", {
        variant_code: config.variantCode,
        faq_index: index,
        faq_question: question,
      });
    },
    [config.variantCode],
  );

  return { trackCta, trackFaqOpen };
}
```

**Step 2: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/landing/src/lib/landing-analytics.ts
git commit -m "feat(landing): add useLandingAnalytics hook for session tracking"
```

---

### Task 13: Wire analytics into all variant components

**Files:**

- Modify: `apps/landing/src/components/landing/VariantActionLanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantSenLanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantIndustryLanding.tsx`
- Modify: `apps/landing/src/app/page.tsx` (Variant A)

**Step 1: Wire into each variant**

Add to the top of each variant component:

```typescript
import { useLandingAnalytics } from "../../lib/landing-analytics";
```

Then inside the component function, add the hook call:

**VariantActionLanding.tsx (Variant B):**

```typescript
const { trackCta, trackFaqOpen } = useLandingAnalytics({
  variantCode: "B",
  variantSlug: "action",
  variantType: "general",
});
```

**VariantSenLanding.tsx (Variant C):**

```typescript
const { trackCta, trackFaqOpen } = useLandingAnalytics({
  variantCode: "C",
  variantSlug: "sen",
  variantType: "sen",
});
```

**VariantIndustryLanding.tsx (Variant D+):**
The hook config comes from the parent — add a `variantCode` and `variantSlug` prop:

```typescript
interface VariantIndustryLandingProps {
  config: IndustryConfig;
  variantCode: string;
  variantSlug: string;
  vertical: string;
}

// Inside component:
const { trackCta, trackFaqOpen } = useLandingAnalytics({
  variantCode,
  variantSlug,
  variantType: "industry",
  vertical,
});
```

Update `[variantSlug]/page.tsx` to pass those props:

```typescript
return (
  <VariantIndustryLanding
    config={config.content}
    variantCode={entry.code}
    variantSlug={variantSlug}
    vertical={entry.vertical ?? variantSlug}
  />
);
```

**page.tsx (Variant A):**

```typescript
import { useLandingAnalytics } from "../lib/landing-analytics";

// Inside SmartoutLandingPage:
const { trackCta } = useLandingAnalytics({
  variantCode: "A",
  variantSlug: "default",
  variantType: "general",
});
```

**Step 2: Add `data-section` attributes to sections in all variants**

Add `data-section="hero"`, `data-section="features"`, `data-section="faq"` etc. to the major `<section>` elements in each variant. The IntersectionObserver in the hook picks these up automatically.

**Step 3: Wire trackCta to CTA buttons**

On primary CTA buttons, add: `onClick={() => trackCta("hero_primary")}`
On secondary CTAs: `onClick={() => trackCta("cta_secondary")}`
On footer CTA: `onClick={() => trackCta("footer_start")}`

**Step 4: Wire trackFaqOpen to FAQ sections**

Pass `onFaqOpen={trackFaqOpen}` to FaqSection components, or wire directly in inline FAQ `<details>` elements:

```typescript
onToggle={(e) => {
  if ((e.target as HTMLDetailsElement).open) trackFaqOpen(idx, faq.q);
}}
```

**Step 5: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 6: Verify in PostHog**

Run dev, visit each variant, click CTAs, scroll, open FAQs. Check PostHog dashboard for:

- `landing page_viewed` events with correct variant properties
- `landing section_viewed` events as you scroll
- `landing cta_clicked` events on button clicks
- `landing faq_opened` events on FAQ toggle
- `landing session_end` event on page leave

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(landing): wire useLandingAnalytics into all variant components"
```

---

## Phase 5 — Database: Visitor Session Tracking

### Task 14: Create landing_visitor_session and landing_visitor_event tables

**Files:**

- Create: `supabase/migrations/00017_landing_visitor_tracking.sql`

**Step 1: Write the migration**

```sql
-- ─── Landing Visitor Session Tracking ─────────────────────────
-- Platform-admin only tables (no RLS, service role access).
-- Stores lightweight visitor session data for the admin dashboard.
-- PostHog handles heavy analytics (session replay, heatmaps, funnels).
-- These tables give us an independent "recent visitors" view.

CREATE TABLE public.landing_visitor_session (
  session_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Visitor fingerprint (anonymous, no PII)
  anonymous_id      text NOT NULL,              -- PostHog distinct_id or generated UUID
  -- Variant info
  variant_code      text NOT NULL,              -- A, B, C, D, etc.
  variant_slug      text NOT NULL,              -- default, action, sen, restaurant
  variant_type      text NOT NULL,              -- general, sen, industry
  vertical          text,                       -- restaurant, hotel, etc. (industry only)
  -- Traffic source
  referrer          text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  -- Device info
  device_type       text,                       -- desktop, mobile, tablet
  browser           text,
  os                text,
  country           text,
  -- Session metrics (updated on session end)
  duration_seconds  integer,
  max_scroll_pct    integer,
  cta_clicks        integer DEFAULT 0,
  sections_viewed   integer DEFAULT 0,
  -- Lifecycle
  started_at        timestamptz DEFAULT now() NOT NULL,
  ended_at          timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER set_landing_visitor_session_updated_at
  BEFORE UPDATE ON public.landing_visitor_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.landing_visitor_event (
  event_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.landing_visitor_session(session_id),
  -- Event data
  event_type        text NOT NULL,              -- page_view, cta_click, section_view, faq_open, scroll_milestone
  event_data        jsonb DEFAULT '{}'::jsonb,  -- { cta_id, section_id, faq_question, scroll_pct, etc. }
  created_at        timestamptz DEFAULT now() NOT NULL
);

-- Indexes for admin dashboard queries
CREATE INDEX idx_lvs_started_at ON public.landing_visitor_session (started_at DESC);
CREATE INDEX idx_lvs_variant ON public.landing_visitor_session (variant_slug, started_at DESC);
CREATE INDEX idx_lvs_anonymous ON public.landing_visitor_session (anonymous_id, started_at DESC);
CREATE INDEX idx_lve_session ON public.landing_visitor_event (session_id, created_at);
CREATE INDEX idx_lve_type ON public.landing_visitor_event (event_type, created_at DESC);
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Tables created, no errors.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/00017_landing_visitor_tracking.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add landing_visitor_session and landing_visitor_event tables"
```

---

### Task 15: Create daily aggregate function for visitor stats

**Files:**

- Create: `supabase/migrations/00018_landing_visitor_aggregates.sql`

**Step 1: Write the aggregate helper function**

This SQL function powers the admin dashboard KPI cards and charts without scanning every row.

```sql
-- ─── Landing Visitor Aggregates ───────────────────────────────
-- Called by the admin dashboard API to get pre-computed stats.

CREATE OR REPLACE FUNCTION public.get_landing_visitor_stats(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  stat_date         date,
  total_sessions    bigint,
  unique_visitors   bigint,
  avg_duration_sec  numeric,
  avg_scroll_pct    numeric,
  total_cta_clicks  bigint,
  bounce_count      bigint,
  variant_slug      text
) LANGUAGE sql STABLE AS $$
  SELECT
    (s.started_at AT TIME ZONE 'Europe/Oslo')::date AS stat_date,
    count(*)                                         AS total_sessions,
    count(DISTINCT s.anonymous_id)                   AS unique_visitors,
    round(avg(s.duration_seconds)::numeric, 1)       AS avg_duration_sec,
    round(avg(s.max_scroll_pct)::numeric, 1)         AS avg_scroll_pct,
    coalesce(sum(s.cta_clicks), 0)                   AS total_cta_clicks,
    count(*) FILTER (WHERE coalesce(s.duration_seconds, 0) < 10
                       AND coalesce(s.sections_viewed, 0) <= 1)
                                                     AS bounce_count,
    s.variant_slug
  FROM public.landing_visitor_session s
  WHERE s.started_at >= now() - make_interval(days => p_days)
  GROUP BY stat_date, s.variant_slug
  ORDER BY stat_date DESC, s.variant_slug
$$;
```

**Step 2: Apply migration**

Run: `npx supabase migration up`
Expected: Function created.

**Step 3: Commit**

```bash
git add supabase/migrations/00018_landing_visitor_aggregates.sql
git commit -m "feat(db): add get_landing_visitor_stats aggregate function"
```

---

## Phase 6 — Landing: Session API

### Task 16: Create session-start API route in landing app

**Files:**

- Create: `apps/landing/src/app/api/session/route.ts`

**Step 1: Create the POST endpoint**

This is called once per page load to create a visitor session row.

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SessionStartSchema = z.object({
  anonymous_id: z.string().min(1),
  variant_code: z.string(),
  variant_slug: z.string(),
  variant_type: z.string(),
  vertical: z.string().optional(),
  referrer: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  device_type: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
});

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = SessionStartSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("landing_visitor_session")
    .insert(body.data)
    .select("session_id")
    .single();

  if (error) {
    console.error("Failed to create visitor session:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ session_id: data.session_id });
}
```

**Step 2: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/landing/src/app/api/session/route.ts
git commit -m "feat(landing): add POST /api/session endpoint for visitor session creation"
```

---

### Task 17: Create session-end beacon endpoint

**Files:**

- Create: `apps/landing/src/app/api/session/end/route.ts`

**Step 1: Create the POST endpoint**

Called via `navigator.sendBeacon()` on page unload. Updates the session with end metrics and batch-inserts events.

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SessionEndSchema = z.object({
  session_id: z.string().uuid(),
  duration_seconds: z.number().int().min(0),
  max_scroll_pct: z.number().int().min(0).max(100),
  cta_clicks: z.number().int().min(0),
  sections_viewed: z.number().int().min(0),
  events: z
    .array(
      z.object({
        event_type: z.string(),
        event_data: z.record(z.unknown()).default({}),
        created_at: z.string().optional(),
      }),
    )
    .default([]),
});

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = SessionEndSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { session_id, events, ...metrics } = body.data;

  // Update session with end metrics
  const { error: updateError } = await supabase
    .from("landing_visitor_session")
    .update({
      ...metrics,
      ended_at: new Date().toISOString(),
    })
    .eq("session_id", session_id);

  if (updateError) {
    console.error("Failed to update visitor session:", updateError.message);
  }

  // Batch insert events
  if (events.length > 0) {
    const rows = events.map((e) => ({
      session_id,
      event_type: e.event_type,
      event_data: e.event_data,
      ...(e.created_at && { created_at: e.created_at }),
    }));

    const { error: eventError } = await supabase.from("landing_visitor_event").insert(rows);

    if (eventError) {
      console.error("Failed to insert visitor events:", eventError.message);
    }
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/landing/src/app/api/session/end/route.ts
git commit -m "feat(landing): add POST /api/session/end beacon endpoint for session metrics"
```

---

### Task 18: Wire session tracking into useLandingAnalytics

**Files:**

- Modify: `apps/landing/src/lib/landing-analytics.ts`

**Step 1: Add session creation and beacon logic to the hook**

Update `useLandingAnalytics` to:

1. On mount: call `POST /api/session` to create a session row, store `session_id` in a ref
2. Collect events in an array ref as they happen (section views, CTA clicks, FAQ opens)
3. On unload: call `POST /api/session/end` via `navigator.sendBeacon()` with session metrics + buffered events

Add this helper at the top of the file:

```typescript
function getDeviceType(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function getBrowser(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Edg")) return "edge";
  if (ua.includes("Chrome")) return "chrome";
  if (ua.includes("Safari")) return "safari";
  return "other";
}

function getOS(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "windows";
  if (ua.includes("Mac")) return "macos";
  if (ua.includes("Linux")) return "linux";
  if (/iPhone|iPad/.test(ua)) return "ios";
  if (ua.includes("Android")) return "android";
  return "other";
}
```

Add a `sessionId` ref and an `eventBuffer` ref:

```typescript
const sessionId = useRef<string | null>(null);
const eventBuffer = useRef<
  { event_type: string; event_data: Record<string, unknown>; created_at: string }[]
>([]);
```

In the mount `useEffect`, after the PostHog `page_viewed` capture, add session creation:

```typescript
const anonymousId = posthog.get_distinct_id?.() ?? crypto.randomUUID();
const params = new URLSearchParams(window.location.search);

fetch("/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    anonymous_id: anonymousId,
    variant_code: config.variantCode,
    variant_slug: config.variantSlug,
    variant_type: config.variantType,
    vertical: config.vertical,
    referrer: document.referrer || undefined,
    utm_source: params.get("utm_source") || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    device_type: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
  }),
})
  .then((r) => r.json())
  .then((d) => {
    sessionId.current = d.session_id;
  })
  .catch(() => {
    /* fail silently — analytics should never break the page */
  });
```

Update the `trackCta`, `trackFaqOpen`, and section observer to also push to `eventBuffer`:

```typescript
// In trackCta callback, after posthog.capture:
eventBuffer.current.push({
  event_type: "cta_click",
  event_data: { cta_id: ctaId },
  created_at: new Date().toISOString(),
});

// In trackFaqOpen callback, after posthog.capture:
eventBuffer.current.push({
  event_type: "faq_open",
  event_data: { faq_index: index, faq_question: question },
  created_at: new Date().toISOString(),
});

// In the IntersectionObserver, after posthog.capture:
eventBuffer.current.push({
  event_type: "section_view",
  event_data: { section_id: sectionId },
  created_at: new Date().toISOString(),
});
```

Update the `onEnd` function to use `sendBeacon`:

```typescript
function onEnd() {
  if (!sessionId.current) return;
  const duration = Math.round((Date.now() - startTime.current) / 1000);
  const payload = JSON.stringify({
    session_id: sessionId.current,
    duration_seconds: duration,
    max_scroll_pct: maxScroll.current,
    cta_clicks: ctaCount.current,
    sections_viewed: sectionsViewed.current,
    events: eventBuffer.current,
  });
  navigator.sendBeacon("/api/session/end", new Blob([payload], { type: "application/json" }));

  // Also fire PostHog event (existing behavior)
  posthog.capture("landing session_end", {
    variant_code: config.variantCode,
    duration_seconds: duration,
    max_scroll_percent: maxScroll.current,
    cta_count: ctaCount.current,
  });
}
```

Add a `sectionsViewed` ref that increments in the IntersectionObserver.

**Step 2: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 3: Verify**

Visit a landing variant, click around, then navigate away. Check Supabase local dashboard:

- `landing_visitor_session` should have 1 row with metrics filled
- `landing_visitor_event` should have events for section views, CTA clicks, etc.

**Step 4: Commit**

```bash
git add apps/landing/src/lib/landing-analytics.ts
git commit -m "feat(landing): wire session tracking (create + beacon end) into analytics hook"
```

---

## Phase 7 — Admin: Content Editor

### Task 19: Expand config_json schema with section definitions

**Files:**

- Modify: `apps/landing/src/lib/landing-config.ts`

**Step 1: Add section placement schema**

Add section definition types to the config schema. This lets admin control which sections appear and in what order.

Add before `industryContentSchema`:

```typescript
const sectionPlacementSchema = z.object({
  type: z.enum([
    "hero",
    "pain_points",
    "features",
    "three_steps",
    "testimonial",
    "security",
    "faq",
    "cta",
  ]),
  order: z.number().int().min(0),
  enabled: z.boolean().default(true),
});

export type SectionPlacement = z.infer<typeof sectionPlacementSchema>;
```

Add `sections` to `industryContentSchema`:

```typescript
const industryContentSchema = z.object({
  hero: z.object({
    badge: z.string(),
    headline: z.string(),
    subhead: z.string(),
  }),
  painPoints: z.array(painPointSchema).optional(),
  painPointsHeadline: z.string().optional(),
  painPointsSubhead: z.string().optional(),
  features: z.array(featureSchema).optional(),
  testimonial: testimonialSchema.optional(),
  faq: z.array(faqSchema).optional(),
  faqHeadline: z.string().optional(),
  faqSubhead: z.string().optional(),
  sections: z.array(sectionPlacementSchema).optional(), // NEW: section order + toggle
});
```

Export the section types:

```typescript
export type IndustryConfig = z.infer<typeof industryContentSchema>;
export const DEFAULT_SECTION_ORDER: SectionPlacement[] = [
  { type: "hero", order: 0, enabled: true },
  { type: "pain_points", order: 1, enabled: true },
  { type: "features", order: 2, enabled: true },
  { type: "three_steps", order: 3, enabled: true },
  { type: "testimonial", order: 4, enabled: true },
  { type: "security", order: 5, enabled: true },
  { type: "faq", order: 6, enabled: true },
  { type: "cta", order: 7, enabled: true },
];
```

**Step 2: Update VariantIndustryLanding to render sections by order**

In `VariantIndustryLanding.tsx`, import `DEFAULT_SECTION_ORDER` and `SectionPlacement`:

```typescript
import { DEFAULT_SECTION_ORDER, type SectionPlacement } from "../../lib/landing-config";
```

Replace the hardcoded section ordering with a dynamic renderer:

```typescript
const sectionOrder = config.sections ?? DEFAULT_SECTION_ORDER;
const sorted = [...sectionOrder]
  .filter((s) => s.enabled)
  .sort((a, b) => a.order - b.order);

// In the return, replace the hardcoded sections with:
{sorted.map((section) => {
  switch (section.type) {
    case "hero":
      return <HeroSection key="hero" badge={config.hero.badge} headline={config.hero.headline} subhead={config.hero.subhead} onCtaClick={() => trackCta("hero_primary")} />;
    case "pain_points":
      return <PainPointsSection key="pain_points" headline={config.painPointsHeadline} subhead={config.painPointsSubhead} items={painPoints} />;
    case "features":
      return <FeaturesSection key="features" />;  // Extract current features into its own component
    case "three_steps":
      return <ThreeStepsSection key="three_steps" />;  // Extract
    case "testimonial":
      return config.testimonial ? <TestimonialSection key="testimonial" {...config.testimonial} /> : null;
    case "security":
      return <SecuritySection key="security" />;  // Extract
    case "faq":
      return <FaqSection key="faq" headline={config.faqHeadline} subhead={config.faqSubhead} items={faq} onFaqOpen={trackFaqOpen} />;
    case "cta":
      return <CtaSection key="cta" onCtaClick={() => trackCta("cta_primary")} />;  // Extract
    default:
      return null;
  }
})}
```

Note: Extract `FeaturesSection`, `ThreeStepsSection`, `SecuritySection`, and `CtaSection` from the current inline JSX in `VariantIndustryLanding.tsx` into `apps/landing/src/components/landing/sections/`. Follow the same pattern as the existing shared section components.

**Step 3: Run typecheck**

Run: `cd apps/landing && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/landing/src/lib/landing-config.ts apps/landing/src/components/landing/VariantIndustryLanding.tsx apps/landing/src/components/landing/sections/
git commit -m "feat(landing): add section placement schema and dynamic section rendering"
```

---

### Task 20: Create content config editor page in platform-admin

**Files:**

- Create: `apps/web/src/app/platform-admin/content/[slug]/page.tsx`
- Create: `apps/web/src/app/platform-admin/content/[slug]/_components/config-editor.tsx`

**Step 1: Create the server page**

```typescript
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { ConfigEditor } from "./_components/config-editor";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ConfigEditorPage({ params }: PageProps) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { slug } = await params;
  const admin = createAdminClient();
  const { data: config, error } = await admin
    .from("landing_config")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !config) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{config.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Slug: <code className="font-mono text-xs">{config.slug}</code> &middot; Version {config.version}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ConfigEditor
          slug={config.slug}
          configJson={config.config_json as Record<string, unknown>}
          status={config.status}
          version={config.version}
        />
      </div>
    </div>
  );
}
```

**Step 2: Create the client config editor**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { GripVertical, Eye, EyeOff, Save, Upload, ExternalLink } from "lucide-react";

interface SectionItem {
  type: string;
  order: number;
  enabled: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  pain_points: "Pain Points",
  features: "Features",
  three_steps: "Three Steps",
  testimonial: "Testimonial",
  security: "Security",
  faq: "FAQ",
  cta: "Call to Action",
};

const DEFAULT_SECTIONS: SectionItem[] = [
  { type: "hero", order: 0, enabled: true },
  { type: "pain_points", order: 1, enabled: true },
  { type: "features", order: 2, enabled: true },
  { type: "three_steps", order: 3, enabled: true },
  { type: "testimonial", order: 4, enabled: true },
  { type: "security", order: 5, enabled: true },
  { type: "faq", order: 6, enabled: true },
  { type: "cta", order: 7, enabled: true },
];

interface ConfigEditorProps {
  slug: string;
  configJson: Record<string, unknown>;
  status: string;
  version: number;
}

export function ConfigEditor({ slug, configJson, status, version }: ConfigEditorProps) {
  const router = useRouter();
  const content = configJson as Record<string, unknown> & { content?: Record<string, unknown> };
  const initialSections = (content.content as Record<string, unknown>)?.sections as
    | SectionItem[]
    | undefined;
  const [sections, setSections] = useState<SectionItem[]>(initialSections ?? DEFAULT_SECTIONS);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const toggleSection = (type: string) => {
    setSections((prev) => prev.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s)));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newSections.length) return;
    [newSections[index], newSections[target]] = [newSections[target], newSections[index]];
    setSections(newSections.map((s, i) => ({ ...s, order: i })));
  };

  const handleSave = async () => {
    setSaving(true);
    const updatedConfig = {
      ...configJson,
      content: {
        ...(content.content as Record<string, unknown>),
        sections,
      },
    };

    await fetch(`/api/platform-admin/content/configs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_json: updatedConfig }),
    });
    setSaving(false);
    router.refresh();
  };

  const handlePublish = async () => {
    setPublishing(true);
    await fetch(`/api/platform-admin/content/configs/${slug}/publish`, {
      method: "POST",
    });
    setPublishing(false);
    router.refresh();
  };

  const statusColor: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    published: "bg-green-500/10 text-green-400 border-green-500/20",
    archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3055";

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={`text-xs capitalize ${statusColor[status] || ""}`}>
          {status}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`${landingUrl}/${slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-3 w-3" /> Preview
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-3 w-3" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing}>
            <Upload className="mr-2 h-3 w-3" /> {publishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {/* Section order editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Section Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sections
            .sort((a, b) => a.order - b.order)
            .map((section, idx) => (
              <div
                key={section.type}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  section.enabled
                    ? "border-border bg-background"
                    : "border-border/50 bg-muted/30 opacity-60"
                }`}
              >
                <GripVertical className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="flex-1 text-sm font-medium">
                  {SECTION_LABELS[section.type] ?? section.type}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => moveSection(idx, "up")}
                    disabled={idx === 0}
                  >
                    &uarr;
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => moveSection(idx, "down")}
                    disabled={idx === sections.length - 1}
                  >
                    &darr;
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleSection(section.type)}
                  >
                    {section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Raw JSON editor (for power users) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Raw Config JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(configJson, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Add link from content list to editor**

In `apps/web/src/app/platform-admin/content/page.tsx`, wrap the config name cell in a Link:

```typescript
// Add import:
import Link from "next/link";

// Replace the name <td>:
<td className="px-4 py-3 font-medium">
  <Link href={`/platform-admin/content/${config.slug}`} className="hover:underline">
    {config.name}
  </Link>
</td>
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/content/
git commit -m "feat(admin): add content config editor with section placement controls"
```

---

## Phase 8 — Admin: Website Visitor Dashboard

### Task 21: Create website dashboard API routes

**Files:**

- Create: `apps/web/src/app/api/platform-admin/website/stats/route.ts`
- Create: `apps/web/src/app/api/platform-admin/website/sessions/route.ts`

**Step 1: Create stats endpoint**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_landing_visitor_stats", { p_days: days });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

**Step 2: Create sessions endpoint**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const variant = searchParams.get("variant");

  const admin = createAdminClient();
  let query = admin
    .from("landing_visitor_session")
    .select(
      "session_id, anonymous_id, variant_code, variant_slug, variant_type, vertical, referrer, device_type, browser, os, duration_seconds, max_scroll_pct, cta_clicks, sections_viewed, started_at, ended_at",
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (variant) {
    query = query.eq("variant_slug", variant);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/website/
git commit -m "feat(admin): add website visitor stats and sessions API routes"
```

---

### Task 22: Create website dashboard page

**Files:**

- Create: `apps/web/src/app/platform-admin/website/page.tsx`
- Create: `apps/web/src/app/platform-admin/website/_components/website-dashboard-client.tsx`

**Step 1: Create the server page**

```typescript
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { WebsiteDashboardClient } from "./_components/website-dashboard-client";

export default async function WebsiteDashboardPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Today's date boundaries (Oslo timezone)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch KPIs in parallel
  const [
    { count: todaySessions },
    { count: weekSessions },
    { count: monthSessions },
    { data: todayUnique },
    { data: avgDuration },
    { data: recentSessions },
    { data: dailyStats },
  ] = await Promise.all([
    admin
      .from("landing_visitor_session")
      .select("*", { count: "exact", head: true })
      .gte("started_at", todayStart.toISOString()),
    admin
      .from("landing_visitor_session")
      .select("*", { count: "exact", head: true })
      .gte("started_at", sevenDaysAgo.toISOString()),
    admin
      .from("landing_visitor_session")
      .select("*", { count: "exact", head: true })
      .gte("started_at", thirtyDaysAgo.toISOString()),
    // Unique visitors today (distinct anonymous_id)
    admin
      .from("landing_visitor_session")
      .select("anonymous_id")
      .gte("started_at", todayStart.toISOString()),
    // Average session duration (last 7 days)
    admin
      .from("landing_visitor_session")
      .select("duration_seconds")
      .gte("started_at", sevenDaysAgo.toISOString())
      .not("duration_seconds", "is", null),
    // Recent sessions for the table
    admin
      .from("landing_visitor_session")
      .select("session_id, anonymous_id, variant_code, variant_slug, referrer, device_type, duration_seconds, max_scroll_pct, cta_clicks, sections_viewed, started_at")
      .order("started_at", { ascending: false })
      .limit(50),
    // Daily aggregate stats for chart
    admin.rpc("get_landing_visitor_stats", { p_days: 14 }),
  ]);

  const uniqueToday = new Set(todayUnique?.map((r) => r.anonymous_id)).size;
  const avgDur = avgDuration && avgDuration.length > 0
    ? Math.round(avgDuration.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / avgDuration.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Website</h1>
        <p className="text-muted-foreground mt-1 text-sm">Landing page visitor analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Today" value={todaySessions ?? 0} icon="TrendingUp" />
        <KpiCard label="Unique Today" value={uniqueToday} icon="Users" />
        <KpiCard label="7 Days" value={weekSessions ?? 0} icon="TrendingUp" />
        <KpiCard label="30 Days" value={monthSessions ?? 0} icon="TrendingUp" />
        <KpiCard label="Avg Duration" value={`${avgDur}s`} icon="PlayCircle" />
      </div>

      {/* Client sections: chart + sessions table */}
      <WebsiteDashboardClient
        recentSessions={recentSessions ?? []}
        dailyStats={dailyStats ?? []}
      />
    </div>
  );
}
```

**Step 2: Create the client component**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VisitorSession {
  session_id: string;
  anonymous_id: string;
  variant_code: string;
  variant_slug: string;
  referrer: string | null;
  device_type: string | null;
  duration_seconds: number | null;
  max_scroll_pct: number | null;
  cta_clicks: number | null;
  sections_viewed: number | null;
  started_at: string;
}

interface DailyStat {
  stat_date: string;
  total_sessions: number;
  unique_visitors: number;
  avg_duration_sec: number | null;
  avg_scroll_pct: number | null;
  total_cta_clicks: number;
  bounce_count: number;
  variant_slug: string;
}

interface WebsiteDashboardClientProps {
  recentSessions: VisitorSession[];
  dailyStats: DailyStat[];
}

const variantColors: Record<string, string> = {
  A: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  B: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  C: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  D: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("no-NO", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WebsiteDashboardClient({
  recentSessions,
  dailyStats,
}: WebsiteDashboardClientProps) {
  // Aggregate daily stats across variants for the chart
  const dailyTotals = new Map<string, { sessions: number; visitors: number; clicks: number }>();
  dailyStats.forEach((s) => {
    const existing = dailyTotals.get(s.stat_date) ?? { sessions: 0, visitors: 0, clicks: 0 };
    existing.sessions += s.total_sessions;
    existing.visitors += s.unique_visitors;
    existing.clicks += s.total_cta_clicks;
    dailyTotals.set(s.stat_date, existing);
  });

  const chartData = Array.from(dailyTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // Variant distribution
  const variantCounts = new Map<string, number>();
  recentSessions.forEach((s) => {
    variantCounts.set(s.variant_slug, (variantCounts.get(s.variant_slug) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      {/* Variant distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Variant Distribution (last 50 sessions)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {Array.from(variantCounts.entries()).map(([slug, count]) => (
              <div key={slug} className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-muted-foreground text-xs capitalize">{slug}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily visits bar (simple, no chart library dependency) */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Visits (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {chartData.map((d) => {
                const max = Math.max(...chartData.map((c) => c.sessions), 1);
                const height = Math.max((d.sessions / max) * 100, 4);
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-muted-foreground text-[9px]">{d.sessions}</span>
                    <div
                      className="w-full rounded-sm bg-orange-500/70"
                      style={{ height: `${height}%` }}
                      title={`${d.date}: ${d.sessions} sessions, ${d.visitors} unique`}
                    />
                    <span className="text-muted-foreground text-[9px]">
                      {new Date(d.date).getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent sessions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Scroll</th>
                  <th className="px-4 py-3">CTAs</th>
                  <th className="px-4 py-3">Sections</th>
                  <th className="px-4 py-3">Referrer</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr key={session.session_id} className="border-border border-b last:border-0">
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {formatTime(session.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${variantColors[session.variant_code] ?? ""}`}
                      >
                        {session.variant_code}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs capitalize">
                      {session.device_type ?? "--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatDuration(session.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {session.max_scroll_pct != null ? `${session.max_scroll_pct}%` : "--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{session.cta_clicks ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-xs">{session.sections_viewed ?? 0}</td>
                    <td className="text-muted-foreground max-w-[200px] truncate px-4 py-3 text-xs">
                      {session.referrer ?? "direct"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/website/
git commit -m "feat(admin): add website visitor dashboard with KPIs, chart, and sessions table"
```

---

### Task 23: Add Website to sidebar nav

**Files:**

- Modify: `apps/web/src/components/platform-admin/sidebar-nav.tsx`

**Step 1: Add the nav entry**

Add after the `Content` entry:

```typescript
// Add import:
import { Globe } from "lucide-react";

// Add to navItems array, after Content:
{ href: "/platform-admin/website", label: "Website", icon: Globe },
```

Also add `Globe` to the existing lucide-react import.

**Step 2: Verify**

Visit `/platform-admin` — "Website" should appear in the sidebar between "Content" and "Contracts".

**Step 3: Commit**

```bash
git add apps/web/src/components/platform-admin/sidebar-nav.tsx
git commit -m "feat(admin): add Website nav entry to platform-admin sidebar"
```

---

### Task 24: Add link from content list to editor (clickable rows)

**Files:**

- Modify: `apps/web/src/app/platform-admin/content/page.tsx`

**Step 1: Make config names clickable**

Add `import Link from "next/link"` and wrap the name cell:

```typescript
<td className="px-4 py-3 font-medium">
  <Link
    href={`/platform-admin/content/${config.slug}`}
    className="hover:text-foreground hover:underline"
  >
    {config.name}
  </Link>
</td>
```

**Step 2: Verify**

Visit `/platform-admin/content` — clicking a config name navigates to the editor page.

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/content/page.tsx
git commit -m "feat(admin): make content list names clickable to open config editor"
```

---

## Summary

| Phase                        | Tasks | What ships                                                                     |
| ---------------------------- | ----- | ------------------------------------------------------------------------------ |
| 1 — Foundation               | 1-3   | Registry rewrite, rename, URL routing (`/action` works)                        |
| 2 — New Variants             | 4-8   | Shared sections, SEN variant, industry template, restaurant config             |
| 3 — Admin Switcher           | 9     | Footer variant pills (dev + secret param)                                      |
| 4 — Analytics                | 10-13 | PostHog session recording, custom events on all variants                       |
| 5 — DB: Visitor Tracking     | 14-15 | `landing_visitor_session` + `landing_visitor_event` tables, aggregate function |
| 6 — Landing: Session API     | 16-18 | Session create/end endpoints, beacon integration in analytics hook             |
| 7 — Admin: Content Editor    | 19-20 | Section placement schema, config editor page with reorder/toggle               |
| 8 — Admin: Website Dashboard | 21-24 | Visitor KPIs, daily chart, sessions table, sidebar nav entry                   |

**Parallel tracks:** Phases 5-8 can be developed in parallel:

- Track 1 (DB): Tasks 14-15 — no dependencies
- Track 2 (Landing API): Tasks 16-18 — depends on Track 1 (tables must exist)
- Track 3 (Admin Content): Tasks 19-20 — depends on Phase 2 (industry template)
- Track 4 (Admin Dashboard): Tasks 21-24 — depends on Track 1 (tables must exist)

Each phase is independently deployable. Each task has a commit.
