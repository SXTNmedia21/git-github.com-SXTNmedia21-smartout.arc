# SMARTOUT — Shared Packages Architecture

> **Status:** Decided
> **Updated:** February 26, 2026
> **Scope:** Contents and conventions for all shared packages in the monorepo
> **Rule:** Shared packages live in `packages/`. Both `apps/web` and `apps/mobile` import from them. No platform-specific code in packages.

---

## 1. Package Overview

```
packages/
├── types/              → TypeScript types (entities, enums, governance)
├── supabase/           → Supabase client, queries, TanStack Query hooks
├── i18n/               → Translation files, locale config, RTL detection
├── tailwind-config/    → Shared design tokens (colors, typography, spacing)
└── utils/              → Pure utility functions (formatting, validation)
```

All packages use TypeScript strict mode. Named exports only. Barrel exports via `index.ts`.

---

## 2. packages/types

The type system for the entire application. Every entity, enum, and API shape lives here.

```
packages/types/
├── src/
│   ├── core.ts            — User, Company, CompanyMember, Workspace, Profile
│   ├── structure.ts       — Department, Location, Zone, Asset, Position, Team, Season
│   ├── governance.ts      — Policy, Protocol, Procedure, Routine, Runbook, ControlList, KnowledgeTest, Confirmation
│   ├── operations.ts      — DepartmentSession, SessionHook, SessionTask, SessionNote
│   ├── scheduling.ts      — Shift, ShiftTemplate, Punch, AvailabilityRequest
│   ├── communication.ts   — ChatChannel, ChatMessage, Notification, Announcement
│   ├── training.ts        — ProtocolAssignment, ProcedureCompletion, TestAttempt
│   ├── enums.ts           — All option sets as union types
│   ├── api.ts             — API request/response shapes, error types
│   └── index.ts           — Barrel export
├── package.json
└── tsconfig.json
```

### Conventions

- Use `type` over `interface` for data shapes
- Use union types for enums (not TypeScript `enum`)
- Every type matches its database table snake_case → camelCase
- Database-generated fields (`id`, `created_at`, `updated_at`) are optional on create types
- Separate `Create`, `Update`, and `Row` variants where needed

```typescript
// Example from core.ts
export type ProfileRole = "employee" | "manager" | "admin" | "owner";
export type ProfileStatus = "trainee" | "active" | "inactive" | "offboarding";

export type Profile = {
  profileId: string;
  userId: string;
  workspaceId: string;
  role: ProfileRole;
  status: ProfileStatus;
  departmentId: string | null;
  preferredLanguage: string;
  notificationPref: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
};

export type CreateProfile = Omit<
  Profile,
  "profileId" | "createdAt" | "updatedAt"
>;
```

---

## 3. packages/supabase

The data layer. Supabase client, raw query functions, and TanStack Query hooks — all in one package.

```
packages/supabase/
├── src/
│   ├── client.ts          — createBrowserClient(), createServerClient()
│   ├── middleware.ts       — Next.js middleware for Supabase Auth session
│   ├── types.ts           — Generated database types (supabase gen types)
│   │
│   ├── queries/           — Raw Supabase query functions
│   │   ├── departments.ts
│   │   ├── locations.ts
│   │   ├── profiles.ts
│   │   ├── shifts.ts
│   │   ├── sessions.ts
│   │   └── index.ts
│   │
│   ├── hooks/             — TanStack Query wrappers
│   │   ├── useDepartments.ts
│   │   ├── useLocations.ts
│   │   ├── useProfiles.ts
│   │   ├── useShifts.ts
│   │   ├── useSessions.ts
│   │   └── index.ts
│   │
│   ├── realtime/          — Supabase Realtime subscription helpers
│   │   ├── useWorkspaceChannel.ts
│   │   └── index.ts
│   │
│   └── index.ts           — Barrel export
├── package.json
└── tsconfig.json
```

### Why Hooks Live Here (Not in a Separate Package)

The original recommendation suggested `packages/api` for shared hooks. We keep hooks in `packages/supabase` instead because:

1. Hooks are thin wrappers around queries — they belong together
2. Both share the same cache keys and invalidation logic
3. Avoids a fourth package that duplicates concerns
4. One import path: `import { useDepartments } from '@smartout/supabase'`

### Pattern: Query + Hook

```typescript
// queries/departments.ts — raw query function
import { SupabaseClient } from "@supabase/supabase-js";

export async function getDepartments(
  client: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await client
    .from("department")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createDepartment(
  client: SupabaseClient,
  dept: { workspace_id: string; name: string; color?: string; icon?: string },
) {
  const { data, error } = await client
    .from("department")
    .insert(dept)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

```typescript
// hooks/useDepartments.ts — TanStack Query wrapper
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseClient } from "../client";
import { getDepartments, createDepartment } from "../queries/departments";

export const departmentKeys = {
  all: (workspaceId: string) => ["departments", workspaceId] as const,
};

export function useDepartments(workspaceId: string) {
  const client = useSupabaseClient();
  return useQuery({
    queryKey: departmentKeys.all(workspaceId),
    queryFn: () => getDepartments(client, workspaceId),
  });
}

export function useCreateDepartment(workspaceId: string) {
  const client = useSupabaseClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dept: { name: string; color?: string; icon?: string }) =>
      createDepartment(client, { workspace_id: workspaceId, ...dept }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: departmentKeys.all(workspaceId),
      });
    },
  });
}
```

### Cache Key Convention

All query keys follow: `[entity, workspaceId, ...filters]`

```typescript
["departments", workspaceId][("departments", workspaceId, departmentId)][
  ("shifts", workspaceId, { week: "2026-W09" })
][("sessions", workspaceId, { date: "2026-02-26", departmentId })];
```

This ensures workspace-scoped invalidation: `queryClient.invalidateQueries({ queryKey: ['departments', workspaceId] })` clears all department queries for that workspace.

---

## 4. packages/i18n

Translation files and locale configuration shared between web and mobile.

```
packages/i18n/
├── locales/
│   ├── nb/                — Norwegian Bokmål (primary)
│   │   ├── common.json    — Shared UI strings (buttons, labels, errors)
│   │   ├── auth.json      — Login, signup, password
│   │   ├── onboarding.json
│   │   ├── scheduling.json
│   │   ├── operations.json
│   │   ├── haccp.json
│   │   └── training.json
│   ├── en/                — English (same file structure)
│   │   └── ...
│   ├── sv/                — Swedish
│   ├── da/                — Danish
│   ├── pl/                — Polish
│   ├── ar/                — Arabic (RTL)
│   ├── so/                — Somali
│   └── fi/                — Finnish
│
├── src/
│   ├── config.ts          — Supported locales, default locale, fallback chain
│   ├── rtl.ts             — RTL locale detection + helpers
│   └── index.ts           — Barrel export
├── package.json
└── tsconfig.json
```

### Platform Wiring

```typescript
// packages/i18n/src/config.ts
export const defaultLocale = "nb" as const;
export const supportedLocales = [
  "nb",
  "en",
  "sv",
  "da",
  "pl",
  "ar",
  "so",
  "fi",
] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const RTL_LOCALES: SupportedLocale[] = ["ar"];
export const fallbackLocale = "nb" as const;
```

```typescript
// apps/web — wires into next-intl
import { getRequestConfig } from "next-intl/server";
import { supportedLocales, defaultLocale } from "@smartout/i18n";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`@smartout/i18n/locales/${locale}/common.json`))
    .default,
}));
```

```typescript
// apps/mobile — wires into i18next + react-i18next
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { defaultLocale, supportedLocales } from "@smartout/i18n";
import nb from "@smartout/i18n/locales/nb/common.json";
import en from "@smartout/i18n/locales/en/common.json";

i18n.use(initReactI18next).init({
  lng: getLocales()[0]?.languageCode ?? defaultLocale,
  fallbackLng: defaultLocale,
  resources: { nb: { translation: nb }, en: { translation: en } },
});
```

### Translation Key Convention

Namespace by module, use dot-separated paths:

```json
{
  "departments": {
    "title": "Avdelinger",
    "create": "Opprett avdeling",
    "empty": "Ingen avdelinger ennå"
  },
  "common": {
    "save": "Lagre",
    "cancel": "Avbryt",
    "delete": "Slett",
    "confirm": "Bekreft"
  }
}
```

Usage: `t('departments.create')` — identical in both web and mobile.

---

## 5. packages/tailwind-config

Shared design tokens. Single source of truth for colors, typography, spacing, and component theming.

```
packages/tailwind-config/
├── src/
│   ├── preset.ts          — Tailwind preset with all Smartout tokens
│   └── index.ts
├── package.json
└── tsconfig.json
```

### How It's Consumed

```typescript
// apps/web/tailwind.config.ts
import smartoutPreset from "@smartout/tailwind-config";

export default {
  presets: [smartoutPreset],
  content: ["./src/**/*.{ts,tsx}"],
};
```

```typescript
// apps/mobile — via NativeWind
// nativewind.config.ts imports the same preset
import smartoutPreset from "@smartout/tailwind-config";

export default {
  presets: [smartoutPreset],
  content: ["./src/**/*.{ts,tsx}"],
};
```

### Design Token Structure

```typescript
// src/preset.ts
export default {
  theme: {
    extend: {
      colors: {
        // Brand colors — TBD (UI Architecture Section 9, Decision 1)
        brand: {
          /* primary, secondary, accent */
        },
        // Semantic
        success: {
          /* readiness, completed tasks */
        },
        warning: {
          /* approaching deadline, low compliance */
        },
        danger: {
          /* overdue, deviation, HACCP alert */
        },
        // Department colors (admin-configurable per workspace)
        // These are defaults, overridden by workspace settings
        department: {
          kitchen: "#FF6B35",
          floor: "#2EC4B6",
          bar: "#9B5DE5",
        },
      },
      fontFamily: {
        // Typography — TBD (UI Architecture Section 9, Decision 2)
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      spacing: {
        // Consistent spacing scale
      },
      borderRadius: {
        // Component rounding — TBD (UI Architecture Section 9, Decision 5)
      },
    },
  },
};
```

---

## 6. packages/utils

Pure utility functions. No framework dependencies. No Supabase. No React.

```
packages/utils/
├── src/
│   ├── formatting.ts      — formatCurrency(), formatDate(), formatDuration()
│   ├── validation.ts      — Zod schemas shared between Edge Functions and client
│   ├── dates.ts           — Shift overlap detection, Norwegian locale helpers (date-fns)
│   ├── readiness.ts       — Readiness score calculation
│   ├── permissions.ts     — Role/status permission checks
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Key Utilities

```typescript
// dates.ts — uses date-fns with Norwegian locale
import { format, isWithinInterval } from "date-fns";
import { nb } from "date-fns/locale";

export function formatNorwegianDate(date: Date): string {
  return format(date, "EEEE d. MMMM yyyy", { locale: nb });
}

export function shiftsOverlap(a: Shift, b: Shift): boolean {
  return (
    isWithinInterval(a.startTime, { start: b.startTime, end: b.endTime }) ||
    isWithinInterval(b.startTime, { start: a.startTime, end: a.endTime })
  );
}
```

```typescript
// permissions.ts — role hierarchy check
const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  employee: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function hasMinimumRole(
  userRole: ProfileRole,
  requiredRole: ProfileRole,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
```

---

## 7. Dependency Map

Which packages depend on what:

```
packages/types       → (none — leaf package)
packages/utils       → packages/types, date-fns, zod
packages/i18n        → (none — leaf package, JSON files only)
packages/tailwind    → (none — config only)
packages/supabase    → packages/types, @supabase/supabase-js, @tanstack/react-query

apps/web             → all packages + next-intl, @supabase/ssr, shadcn/ui
apps/mobile          → all packages + expo-router, react-i18next, nativewind
```

### Package.json Names

```json
{
  "packages/types": "@smartout/types",
  "packages/supabase": "@smartout/supabase",
  "packages/i18n": "@smartout/i18n",
  "packages/tailwind-config": "@smartout/tailwind-config",
  "packages/utils": "@smartout/utils"
}
```

---

## Cross-References

- **Core Architecture v2** — Stack Overview, 11 Core Types (types package mirrors this)
- **CLAUDE.md** — Monorepo structure, code conventions
- **Rebuild Strategy** — File structure, Layered Context Architecture
- **Production Architecture** — i18n library decisions, Supabase client patterns
- **UI Architecture** — Design system tokens, component library, interaction patterns
- **BUILD_ORDER.md** — Phase 0 sets up all shared packages
