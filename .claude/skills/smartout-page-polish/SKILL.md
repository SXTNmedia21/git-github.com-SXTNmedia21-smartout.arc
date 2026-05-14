---
name: smartout-page-polish
description: Use when productionizing a Smartout dashboard page in apps/web/src/app/dashboard/* — symptoms include skeleton flash, layout shift between loading and ready states, missing or mismatched loading.tsx fallback, untracked mutations missing emit(), generic page header without instructions, harness tools registered without description, slow first paint, missing site-map.json entry, or a page that "works" but feels unprofessional. Covers the eight-phase polish workflow: speed-test baseline, bottleneck fix, re-test, UI/UX pass, telemetry registration, page instructions, harness tool descriptions, site-map registration.
updated: 2026-05-14
---

# Smartout Page Polish

Eight-phase workflow for taking a Smartout dashboard page from "works" to production-grade. Each phase is independently verifiable. Run them in order — speed test first means later phases (UI polish, telemetry, site-map) get measured against a real baseline.

## When To Use

Trigger symptoms (any one is enough):

- Skeleton flashes then blank then content (DOM tree remount between states)
- Layout shift on hydration (skeleton dimensions don't match real content)
- `loading.tsx` skeleton matches the wrong role (admin sees employee skeleton or vice versa)
- A mutation fires but no `engine_event` / `activity_trail` row appears
- Page header says "Schedule" with no description; empty states say "No data"
- Botsson can't operate the page because `useRegisterTools(...)` was never called or tools have empty descriptions
- Lighthouse first paint > 1.5s on warm cache

When NOT to use: feature still in active build (premature polish). Wait until journey + happy path actually works.

## Phase Map

| # | Phase | Output | Verify |
|---|-------|--------|--------|
| 1 | Speed test baseline | Recorded LCP, CLS, TTI | Lighthouse run, screenshot |
| 2 | Fix bottlenecks | Skeleton/loading/import/query fixes | Re-run phase 1, compare |
| 3 | Speed test admin page upgrade | Admin-route metrics added to baseline | Both employee + admin captured |
| 4 | UI/UX polish | Nordic Split tokens, motion via framer-motion-animator, no hardcoded zinc/gray | `smartout-nordic-split` skill checklist |
| 5 | Telemetry registry | Every mutation emits, registry entries exist | `pnpm test packages/telemetry` |
| 6 | Page instructions | Header + description + non-generic empty/error copy | Read page as a new user — does it explain itself? |
| 7 | Harness tool expectations | `useRegisterTools(pageKey, kit)` with `description` per tool | Botsson can list + invoke tools |
| 8 | Site-map registration | Entry in `apps/web/.botsson/site-map.json` (path + purpose + tools + access + tier) | `pnpm site-map:validate` (`apps/web/scripts/validate-site-map.ts`) |

## Phase 0 — Pre-Polish Capability Check

Before starting Phase 1, verify the page's data is actually available to the runtime LLM:

1. Does a relevant backend capability exist in `packages/ai/src/capabilities/`? If yes, this page's tools may overlap — name them distinctly to avoid collision.
2. Is `gate_action` seeded for the relevant workspace? (Check `engine_authority_config`.)
3. Is the telemetry registry entry written? (For any planned mutation in Phase 5.)
4. Is the data hook used by this page in `packages/` (mobile parity) or `apps/web/` (web-only)? Per ADR-0133/0134, shared logic in packages.

If any answer is "no, but planned for this polish session," ship the prerequisite first (separate commit).

## Phase 1 — Speed Test Baseline

Capture metrics BEFORE touching anything. Without baseline, "feels faster" is theatre.

1. Run dev build (`op run --env-file=.env.template -- pnpm --filter web dev`) and Lighthouse on the route both signed-out (where applicable) and signed-in.
2. Record LCP, CLS, TTI, blocking JS bundle size. Save to a scratch note (do NOT commit).
3. Open DevTools → Performance tab → record one cold load + one warm reload. Note any frame >50ms.

If the page is admin-gated, capture two profiles: admin and employee — they branch on `isAdminMode` and load different dynamic imports.

## Phase 2 — Fix Bottlenecks

Common Smartout-specific bottlenecks:

| Symptom | Likely cause | Fix |
|--------|-------------|-----|
| Skeleton flashes then blank then content | Top-level early-return for loading state remounts the entire DOM tree | Hoist outer shell + ambient orb, wrap inner content in `AnimatePresence mode="wait"` with `motion.div` per state — see "Skeleton Crossfade Pattern" below |
| Skeleton matches wrong role | `loading.tsx` is shared but the route branches on `isAdminMode` client-side | Return `null` from `loading.tsx`, move the skeleton inside each role-specific view |
| Layout shift on hydration | Skeleton dimensions don't mirror real content (bone heights / paddings differ) | Re-measure real content with DevTools, match `h-*` and `px-*` classes exactly |
| Slow first paint | Heavy synchronous import in client component | `next/dynamic(() => import(...), { ssr: false })` for views below the fold |
| TanStack query waterfall | Sequential `useQuery` chains | Move to parallel `useQueries` or pre-fetch in a Server Component above |

### Skeleton Crossfade Pattern

If `loading.tsx` is a Suspense fallback for a `"use client"` page that branches by role, the fallback can only match one branch. Returning `null` from `loading.tsx` and owning the loading UI inside each view prevents the wrong-shape flash:

```tsx
// apps/web/src/app/dashboard/loading.tsx
export default function DashboardLoading() {
  return null; // each view owns its skeleton internally
}
```

Inside the client view, never early-return a different DOM tree for loading. Hoist the outer shell:

```tsx
const stateKey = isLoading ? "loading" : !data ? "empty" : "ready";

return (
  <div className="bg-muted/30 relative flex h-full flex-col overflow-hidden">
    <AmbientOrb />
    <AnimatePresence mode="wait">
      {stateKey === "loading" && (
        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <SkeletonContent />
        </motion.div>
      )}
      {stateKey === "ready" && (
        <motion.div key="ready" /* same fade props */>
          <RealContent />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
```

Reference implementation: `apps/web/src/components/day/WebDayControl.tsx`.

## Phase 3 — Re-test + Admin Upgrade

Re-run Lighthouse + Performance recording from phase 1. Numbers should improve. If they didn't, the fix didn't land — investigate before moving on.

For admin pages, also profile the admin variant tab bar inside `DashboardShell.tsx` — variant changes call `setAdminView` which dynamic-imports the next view. Cold imports >200ms warrant a `prefetch` on hover.

## Phase 4 — UI/UX Polish

Load `smartout-nordic-split` skill — it is authoritative for tokens, fonts, OKLCH ranges, and forbidden hardcoded colors. Then:

- Replace any `zinc-*` / `gray-*` / `slate-*` with semantic tokens (`bg-muted`, `text-foreground`, `border-border`).
- Headings use `font-heading` (Instrument Serif). Data uses `font-mono` (Geist Mono).
- Motion via framer-motion: spring transitions for tab/state swaps, fade for skeleton↔content, no linear `duration` for organic motion.
- Icons: Lucide React only. No emojis.
- Empty states get an icon + heading + body + primary action — never just "Ingen data".

Spawn the `frontend-designer` agent (model: sonnet) for high-impact polish: orb placement, typography pairing, micro-interactions. Do not delegate token compliance — that is your job after the agent returns.

**Motion-token audit:** Run the audit toolkit in `smartout-nordic-split` skill (`Motion Token Audit (Debt Status)` section). Every page polish must end Phase 4 with 0 hardcoded spring/duration/ease values in the page tree.

**Auto-enforcement (strand 1, added 2026-05-14):** `.husky/pre-commit` §10 grep-gates added lines in staged dashboard `.tsx`/`.ts`/`.css` files. Blocks commits introducing NEW hardcoded `zinc-*` / `gray-*` / `slate-*` palette tokens, NEW inline spring physics (`stiffness:` / `damping:`), or NEW inline framer-motion durations / ease arrays. Pre-existing debt is NOT gated — only added lines. Bypass: `SKIP_DESIGN_AUDIT=1 git commit` (document why in message body). The hook catches mechanical drift; the agent-based design audit (planned strand 2) catches taste/composition drift.

## Phase 5 — Telemetry Registry

CLAUDE.md law: "every mutation emits." Walk every `useMutation` and every Server Action on the page:

1. Confirm `emit()` is called in `onSuccess` (TanStack) or after the DB write (Server Action).
2. Check that the event name appears in `packages/telemetry/src/registry.ts` with correct destination flags (PostHog / Logger / activity_trail / engine_event).
3. If missing, add the registry entry first — `emit()` will type-error otherwise.
4. Verify with `pnpm --filter @smartout/telemetry test`.

Mobile mutations have an extra rule (ADR-0134): every emit must resolve `workspace_id` (non-empty) and `actor_id` (non-empty) BEFORE calling. Use `getProfileContext()` from `apps/mobile/src/lib/profile-context.ts`. Never empty-string fallback.

## Phase 6 — Page Instructions

A page must explain itself. Three required strings:

- **Header description** — one sentence under the page title that says what the page is FOR (not what it shows). E.g. "Plan and lock the season's revenue baseline" — not "Season list."
- **Empty state copy** — what the user is missing AND what to do next.
- **Error copy** — what failed AND what to try.

These also feed Botsson context — the harness reads page instructions to answer "what is this page?" If they're generic, Botsson sounds generic.

## Phase 7 — Harness Tool Expectations

If Botsson should operate this page, register page-scoped tools:

```ts
// apps/web/src/app/dashboard/<page>/_components/page-tools-bridge.tsx
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";

useRegisterTools("page-key", {
  filterShifts: {
    description: "Filter visible shifts by department or role. Use when the user asks to narrow the schedule.",
    parameters: { ... },
    handler: async (args) => { ... },
  },
});
```

Every tool needs `description` written for the LLM, not the developer. The description should answer "when would Botsson use this?" — not "what does it do?". Empty descriptions = Botsson never picks the tool.

Verify: open Botsson on the page, ask it to perform the action — it should select the tool you registered, not refuse or pick a generic one.

### Runtime Status (2026-05-14 — council finding)

**Phase 7 client registry:** wired ✅ (registry singleton stores kits, BotssonProvider merges into `botssonTools`).

**Phase 7 client → LLM delivery:** MISSING 🔴
  - Voice path: `/api/wizard/start` route silently drops `body.selected_tools`. `LiveKitVoiceSession.registerTool()` at `packages/agent-sdk/src/providers/livekit.ts:38-40` is a stub.
  - Chat path: `/api/botsson/chat` forwards no tool fields. `services/stage-engine/src/routes/agent/chat.ts` schema has no `client_tools` receiver.

**Consequence:** tools registered via `useRegisterTools` cannot be invoked by Botsson today on either channel. They exist in browser memory for future hot-swap when the HarnessAdapter (see ADR-0326) ships.

**Do NOT remove `useRegisterTools` calls.** The registry is the upstream source the HarnessAdapter will read from. Polish-wave Phase 7 work is correct preparation; the consumer pipe is what's missing.

**See:** `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` (full code-trace), ADR-0326 (proposed unified adapter).

## Phase 7.5 — Tool Implementation Patterns

Six recurring patterns from the May 2026 polish wave. Skip these and you ship working-but-wrong tools.

### 1. dataRef pattern (canonical)

Definitions MUST be stable (`useMemo([], [])`). Implementations MUST read live state via a ref refreshed each render. Closures over props go stale and break Botsson silently.

```ts
export function useXTools(input: XToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => { dataRef.current = input; });

  const definitions = useMemo<ClientToolDefinition[]>(() => [/* ... */], []);
  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getX: () => {
        const d = dataRef.current;  // ← live, never stale
        return Promise.resolve(JSON.stringify({ ok: true, x: d.someField }));
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
```

Reference: `apps/web/src/app/dashboard/my-cv/_tools/use-my-cv-tools.ts`.

### 2. ClientToolParameter shape — DO NOT drift

Agents repeatedly get these wrong on first try. Memorize:

```ts
// CORRECT
{
  name: "deviationId",
  location: "PARAMETER_LOCATION_BODY" as const,  // string literal, NOT imported
  schema: {
    type: "string",                              // ← type lives INSIDE schema
    enum: ["a", "b"],                            // optional
    description: "UUID of the row.",
  },
  required: true,
}

// WRONG
{
  name: "deviationId",
  type: "string",                                // ❌ type at top level
  location: PARAMETER_LOCATION_BODY,             // ❌ imported constant (does not exist)
}
```

Implementations are `(params: Record<string, unknown>) => Promise<string>`. Do NOT type-destructure params — coerce inside (`String(params.x ?? "")`).

### 3. Server-Component + Client-Island bridge

When the host page is a Server Component (server-side auth, RLS query, `redirect()`), `useRegisterTools` cannot mount directly — it is client-only. Pattern:

```tsx
// page.tsx — Server Component
export default async function FooPage() {
  const data = await serverFetch();           // server-side
  const bridgeRows = data.map(serialize);     // serialized for client

  return (
    <>
      <FooToolsBridge rows={bridgeRows} />    {/* client island */}
      <div>{/* server-rendered UI */}</div>
    </>
  );
}
```

```tsx
// _tools/foo-tools-bridge.tsx — Client Component
"use client";
import { useRouter } from "next/navigation";  // routing inside client
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";

export function FooToolsBridge({ rows }: Props) {
  const router = useRouter();
  const tools = useFooTools({ rows, navigateTo: (h) => router.push(h) });
  useRegisterTools("foo", tools);
  return null;
}
```

Rule: bridge receives a **serialized snapshot** (only what tools need) — never the raw Server-query types. Decouples server schema drift from tool contract.

References: `apps/web/src/app/dashboard/contracts/awaiting-my-signature/`, `apps/web/src/app/dashboard/billing/[invoice_id]/`, `apps/web/src/app/dashboard/billing/settings/`.

### 4. PII-safe tool input contract

For surfaces collecting PII (personnummer, address, sensitive financial), enforce **booleans-only at the type level**. Tool results must never carry the actual values — Botsson context is a leak surface.

```ts
// CORRECT — booleans only
export type MyProfileCompleteToolInput = {
  submitted: boolean;
  fields: {
    personalNumberFilled: boolean;   // ← boolean, never the string
    addressFilled: boolean;
  };
};

// WRONG — leaks PII through agent context
export type LeakyInput = {
  personalNumber: string | null;     // ❌ string flows into tool result
};
```

ADR-0077 compliance via type system, not docstring promises. Submit happens via form's own button + RPC. Botsson reads filled-state, describes what's missing; the human types the value.

Reference: `apps/web/src/app/dashboard/my-profile/complete/_tools/use-my-profile-complete-tools.ts`.

### 5. No-mutation rule on financial surfaces

ADR-0244 risk tier: payment, contract signing, MarkPaid, financial state-changes ship as explicit human buttons — never Botsson mutation tools. Tools read state + report what actions are *available* (`canMarkPaid`, `canPayNow`); humans click.

```ts
// CORRECT — read tool reports gating state
getInvoiceActionState: () => Promise.resolve(JSON.stringify({
  canMarkPaid: isIssued,
  canPayNow: isIssued && !isPaid,
  hint: "Trykk 'Betal nå' eller 'Merk som betalt'.",
}))

// WRONG — Botsson mutates financial state
markInvoicePaid: () => { /* ❌ */ }
payInvoice:      () => { /* ❌ */ }
```

References: `apps/web/src/app/dashboard/billing/[invoice_id]/_tools/`, `apps/web/src/app/dashboard/contracts/[id]/_tools/`.

### 6. Distinct scopes for same-data-different-surface

Two pages can consume the same data hook (e.g. `useGovernanceOverview`) but they ARE different surfaces — register under **distinct scope strings**:

- `/dashboard/governance` (redirect-shell) → `useRegisterTools("governance", ...)`
- `/dashboard/hms/governance` (HMS sub-page) → `useRegisterTools("hms-governance", ...)`

Validator allows same tool name across distinct scopes. Distinct scope = distinct surface descriptor for Botsson. Same-named tool calls on each page do NOT collide — the scope picks the right kit at runtime.

### §7 Scope-Naming Convention

Rule: `<parent-route-segment>-<leaf>` for nested routes, hyphenated, lowercase.

Examples:
- `/dashboard/hms/deviations` → scope `hms-deviations` ✅
- `/dashboard/settings/operations` → scope `settings-operations` ✅
- `/dashboard/billing/[invoice_id]` → scope `billing-invoice-detail` (NOT `invoice-detail`) ✅
- `/dashboard/contracts/[id]` → scope `contracts-detail` (NOT `contract-detail` — match parent route segment) ✅
- `/dashboard/contracts/awaiting-my-signature` → scope `contracts-awaiting-signature` ✅

Validator may warn (P2): scope without parent-route-segment prefix.

Existing scopes shipped before 2026-05-14 are grandfathered; do not rename. Apply rule to new scopes only.

## Phase 8 — Site-map Registration

Botsson needs a global view of which paths exist, what each is for, who can reach it, and which page-scoped tools live there. Without it the Realtime LLM has to guess routes and falls back to `query_smartout`, which adds 5–15s per turn. Phase 7 registers tools per page; Phase 8 makes those facts globally addressable.

**Source of truth:** `apps/web/.botsson/site-map.json` (single JSON file, committed). Each polished page MUST own one entry.

**Entry shape:**

```json
{
  "version": 1,
  "generated_at": "2026-05-13T00:00:00Z",
  "routes": [
    {
      "path": "/dashboard/schedule",
      "purpose": "Plan og lock shift for aktiv planning_cycle. Drag-drop editor + auto-tildeling + costing.",
      "module": "Schedule",
      "tier": 1,
      "access": ["owner", "admin", "manager"],
      "polished_at": "2026-05-10",
      "owns_chat_surface": false,
      "domain_chat_endpoint": null,
      "tools": [
        {
          "name": "propose_create_shift",
          "description": "Foreslå ny vakt for ansatt på gitt dato + tidsrom. Krever manager-godkjenning før insert."
        },
        {
          "name": "filter_shifts",
          "description": "Filtrer synlig vaktplan på avdeling, rolle, eller fraværsstatus. Bruk når brukeren ber om å snevre inn."
        }
      ],
      "common_intents": [
        "Hvem jobber [dato]?",
        "Lag en vakt for [navn] [tid]",
        "Bytt vakt mellom [A] og [B]"
      ]
    }
  ]
}
```

**Field rules:**

| Field | Required | Source | Notes |
|-------|----------|--------|-------|
| `path` | yes | actual route | absolute, starts with `/`, no query/hash |
| `purpose` | yes | Phase 6 header description | one sentence, ≤140 chars, says WHAT the page is FOR not WHAT it shows |
| `module` | yes | `docs/reference/ROUTES.md` mapping | matches module column in ROUTES.md |
| `tier` | yes | "Structural Walkthrough Order" section above | 0–3 |
| `access` | yes | actual route guards (server layout role check) | subset of `["owner","admin","manager","employee","godmode"]` |
| `polished_at` | yes | date you finished phases 1–7 | ISO date |
| `owns_chat_surface` | yes | Phase "Surface Disambiguation" check | true if `<DomainChatOwnership>` declared |
| `domain_chat_endpoint` | when owns | which API the in-page chat POSTs to | e.g. `/api/botsson/chat?mission=journey_authoring` |
| `tools` | yes (can be `[]`) | `useRegisterTools(...)` kit on this page | name + description copied verbatim from registration site |
| `common_intents` | recommended | 3–5 example utterances Botsson should match to this page | written in user's language |

**Tools list rule:** name + description must match the live `useRegisterTools(pageKey, kit)` call. Drift = silent: Botsson advertises a tool that doesn't load. Verify with `pnpm site-map:validate` which greps tool-registry call sites and diffs against the JSON.

**Workflow per polished page:**

1. Open `apps/web/.botsson/site-map.json`.
2. Find or add the entry for your `path`.
3. Copy `purpose` from the header description you wrote in Phase 6. **Hard limit: 140 chars** — validator rejects longer. Tighten verbs, drop articles.
4. List every tool you registered in Phase 7 (name + description verbatim from `useRegisterTools` kit).
5. Set `polished_at` to today's date.
6. Bump `generated_at` to today's ISO timestamp.
7. Run `pnpm --filter web site-map:validate`. Fix any reported drift before commit.

**Pre-commit polish hook scope (IMPORTANT):**

The pre-commit hook (`.husky/pre-commit` lines 246-283) only validates **first-segment** route polish files. Regex: `^apps/web/src/app/dashboard/[^/]+/` extracts `dashboard/<segment>` → expects `.claude/page-polish/dashboard-<segment>.run.yml` with `verified: true`.

Implications:

- Sub-route polish files (`dashboard-hms-deviations.run.yml`, `dashboard-billing-invoice-id.run.yml`) are **documentation-only** — hook never enforces them. Convention: write them anyway for traceability.
- When polishing a sub-route under a parent that has **no page of its own** (e.g. `/dashboard/my-profile/complete` exists, `/dashboard/my-profile` does not), the hook still fires on the parent segment. Solution: write a parent stub `dashboard-my-profile.run.yml` documenting "parent has no surface; see sub-route file for detail" with `verified: true`.

Reference parent stub: `.claude/page-polish/dashboard-my-profile.run.yml`.

**Static metadata sources (do NOT duplicate by hand):**

- Module → cross-reference `docs/reference/ROUTES.md` (canonical route catalog).
- Access → derived from server-layout role guards; pull from the actual `if (!isAdmin) redirect(...)` chain on the route.
- Tier → "Structural Walkthrough Order" section in this skill.

**Status (2026-05-14):** site-map.json is currently a **documentation + drift-detection artifact only**. The BFF → context_init injection pipe described in prior versions of this skill does NOT exist in code. ADR-0326 (proposed) draft pending — unified HarnessAdapter, sortie next.

Once the HarnessAdapter ships, site-map.json will be the canonical route catalog read by every LLM consumer (chat, voice, future Slack/email/API). Until then, Phase 8 entries serve:
- Drift validator (`pnpm site-map:validate`) — enforces `useRegisterTools` ↔ JSON entry consistency
- Human reference — what surfaces have been polished, what tools they expose
- future-target — HarnessAdapter will read this JSON when injection ships

**Failure modes the validator catches:**

| Symptom | Cause |
|---------|-------|
| Botsson says "siden finnes ikke" for a polished page | Entry missing from site-map.json (pending HarnessAdapter ship — ADR-0326) |
| Botsson calls `query_smartout` to look up a tool that exists on the page | Tool registered in `useRegisterTools` but not listed in entry's `tools` array (pending HarnessAdapter ship — ADR-0326) |
| Botsson navigates to wrong path | `purpose` is generic ("Side for vakter") — LLM cannot disambiguate |
| Botsson tries page-scoped tool from wrong role | `access` mis-set (lists `employee` when route guards admin-only) |
| Botsson surfaces in-page chat as Orb chat | `owns_chat_surface` missing → no `<DomainChatOwnership>` declared (also Phase "Surface Disambiguation") |

## Structural Walkthrough Order

When polishing the dashboard end-to-end, do not pick pages at random. Follow dependency order — a page that imports shared shells, drawers, or buttons must be polished AFTER the shared primitives, otherwise the per-page work fights the system. Run the seven phases on each tier before moving to the next.

### Tier 0 — Shared Primitives (do first)

Polishing these once propagates to every page that consumes them.

| Surface | Path |
|---------|------|
| DashboardShell + variant tab bar | `apps/web/src/components/dashboard/DashboardShell.tsx` |
| Entity drawer (right-side panel) | `apps/web/src/components/dashboard/entity-drawer/` |
| Status badges | `apps/web/src/components/ui/PaymentStatusBadge.tsx`, `DispatchStatusBadge.tsx` |
| Notification bell | `apps/web/src/components/dashboard/NotificationBell.tsx` |
| Global call alert overlay | `apps/web/src/components/dashboard/GlobalCallAlert.tsx` |
| Wizard shell (onboarding + setup wizards) | `apps/web/src/components/wizard/AnimatedWizardShell.tsx` |
| Sonner toast theme | `apps/web/src/app/globals.css` `[data-sonner-toast]` rules |

### Tier 1 — Day Control + Operational Surfaces (highest user time)

| Page | Path |
|------|------|
| Overview / Day Control | `apps/web/src/components/day/WebDayControl.tsx` + `tabs/` |
| Schedule | `apps/web/src/app/dashboard/schedule/` |
| Reconciliation | `apps/web/src/components/dashboard/ReconciliationView.tsx` |
| Activity | `apps/web/src/components/dashboard/ActivityView.tsx` |

### Tier 2 — Strategic + People

| Page | Path |
|------|------|
| Strategic | `apps/web/src/components/dashboard/StrategicView.tsx` |
| People | `apps/web/src/app/dashboard/people/` |
| Governance | `apps/web/src/app/dashboard/governance/` |
| Year Wheel | `apps/web/src/app/dashboard/year-wheel/` |
| Season | `apps/web/src/app/dashboard/season/` |

### Tier 3 — Long Tail (admin + employee surfaces)

| Page | Path |
|------|------|
| Contracts | `apps/web/src/app/dashboard/contracts/` |
| HMS | `apps/web/src/app/dashboard/hms/` |
| Cost / Billing | `apps/web/src/app/dashboard/cost/`, `apps/web/src/app/dashboard/billing/` |
| Settings | `apps/web/src/app/dashboard/settings/` |
| Notifications | `apps/web/src/app/dashboard/notifications/` |
| Help | `apps/web/src/app/dashboard/help/` |
| Website | `apps/web/src/app/dashboard/website/` |
| Onboarding Assistant | `apps/web/src/app/dashboard/onboarding-assistant/` |
| AI surfaces | `apps/web/src/app/dashboard/ai/` |
| My-* (employee views) | `my-cv`, `my-contract`, `my-salary`, `my-schedule`, `my-training`, `my-profile`, `shift-clock` |
| Close | `apps/web/src/app/dashboard/close/` |

### Process Per Tier

1. **Read tier-level surface index.** Map every component the tier composes.
2. **Run all seven phases per page.** Do not skip the Phase 4 motion-token audit — it is what makes the system globally tunable.
3. **Open one PR per tier**, not per page — each tier is a coherent design slice and reviewers should see the whole arc.
4. **Update `docs/STATE-SUMMARY.md`** at tier completion: which surfaces are now production-grade, what tokens were added, what shared primitives changed.
5. **Re-run `frontend-design:frontend-design`** as a final pass per tier — the agent catches consistency drift across pages that solo polish misses.

### Stop Conditions Per Tier

Tier is "done" only when:

- Lighthouse LCP < 1.5s on every page in the tier
- `grep -rn "stiffness:\|damping:" <tier-paths>` returns 0 hits outside `motionTokens.*`
- `grep -rn "zinc-\|gray-\|slate-" <tier-paths>` returns 0 hits outside intentional escape hatches
- Every page header has a description, every empty/error state has next-action copy
- Every page that Botsson should operate has `useRegisterTools` with descriptions
- Every page in the tier has an entry in `apps/web/.botsson/site-map.json` with matching tool list; `pnpm --filter web site-map:validate` exits 0

## Verification Checklist

- [ ] Lighthouse LCP < 1.5s (warm), CLS < 0.05
- [ ] Skeleton crossfades to content with no blank frame (Performance recording)
- [ ] No hardcoded zinc/gray/slate in the page tree
- [ ] Every mutation has a registry entry + `emit()` call
- [ ] Page header has a one-sentence description
- [ ] Empty + error states have non-generic copy with next-action
- [ ] `useRegisterTools` called with descriptions written for the LLM
- [ ] Botsson can list and invoke each registered tool
- [ ] `apps/web/.botsson/site-map.json` has an entry for this `path` with `purpose`, `module`, `tier`, `access`, `tools` (verbatim from `useRegisterTools`), `polished_at`
- [ ] `pnpm --filter web site-map:validate` exits 0 (no drift between live tool registrations and site-map.json)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Polishing UI before fixing the skeleton flash | Fix flash first — skeleton frames poison Lighthouse CLS |
| Adding a fancy `loading.tsx` skeleton for a route that branches by role | Return `null` from `loading.tsx`, own the skeleton per view |
| Writing tool descriptions like documentation ("Filters the shifts table") | Write them like decision criteria for an LLM ("Use when the user asks to narrow the schedule by …") |
| Calling `emit()` without a registry entry | Add registry entry first; emit is type-checked against it |
| Treating "feels faster" as the win condition | Re-measure with Lighthouse — instinct is a worse judge than the number |
| Mounting page with embedded chat AND BotssonShell without declaring ownership | Add `<DomainChatOwnership reason="...">` so Orb suppresses to passive mode. Without it, dual-surface UX → silent misroute. L-0178 + ADR-0238 (2026-04-29). |
| Polishing a page without updating `site-map.json` | Botsson cannot route users here and silently calls `query_smartout` instead. Add entry in Phase 8. |
| Listing tools in `site-map.json` that don't match `useRegisterTools` call (or vice versa) | Botsson advertises a tool that never loads (silent miss). `pnpm site-map:validate` greps registration sites and diffs. |
| Putting `useRegisterTools` directly in a Server Component | `use client` hook — server-component import fails at build. Create a `_tools/X-tools-bridge.tsx` client island; page passes serialized data as props. Phase 7.5 §3. |
| Closing over props in tool implementation | Closures snapshot props at definition time → tool returns stale data. Use the dataRef pattern (Phase 7.5 §1). |
| Putting `type` at top level of `ClientToolParameter` | `type` lives inside `schema:`. Top-level `type` silently typechecks but generates wrong tool spec. Phase 7.5 §2. |
| Importing `PARAMETER_LOCATION_BODY` from `@smartout/agent-sdk` | Constant does not exist. Use string literal `"PARAMETER_LOCATION_BODY" as const`. Phase 7.5 §2. |
| Exposing PII values through tool input contract | Type the input as `personalNumberFilled: boolean`, never `personalNumber: string`. Botsson agent context is a leak surface. ADR-0077 + Phase 7.5 §4. |
| Registering a Botsson mutation tool for payment / signing / financial state | ADR-0244: human-driven button only. Tools may read action availability (`canMarkPaid`, `canPayNow`); never mutate. Phase 7.5 §5. |
| Treating Stop-hook typecheck errors as authoritative mid-edit | Stop-hook fires per file write; intermediate states often error while final state passes. Run `pnpm --filter web typecheck` fresh before believing the failure. SIGTERM cascade (exit 143) = concurrent typechecks, not your code. |
| Polishing a sub-route under a parent that has no page of its own | Pre-commit hook still validates the parent segment slug. Write a parent stub run.yml with `verified: true` documenting "parent has no surface". See `dashboard-my-profile.run.yml`. |
| Trusting commit success when the bundle includes pre-existing unstaged file deltas | Lint-staged stashes unstaged work, runs tasks on staged, restores stash. The restore can drop staged page.tsx edits silently. After every `git commit` touching page.tsx, run `git status` and re-add anything that should have been in the commit. Cost: 3 contracts page.tsx wirings lost in `0f901a637`; restored in `8b7976a37`. |
| Building 4 thin sub-routes via parallel agent fan-out | SIGTERM cascades from concurrent typechecks (exit 143) wipe edits mid-write. For pages <100 lines build solo + sequential — faster wall-time, no agent drift, no lost work. |
| Trusting skill text claims about runtime pipes without code-trace verification | Pre-flight fact-check must include grep for the alleged consumer of any artifact the skill text references. Phase 7 + Phase 8 false-claim 2026-05-14 occurred because skill text wasn't trace-verified. L-0147 4th occurrence. See `docs/learnings/0264-skill-claim-trace-trap.md`. |
| Writing skill text describing pipe behavior in present tense without verifying in last 30 days | Skill text drifts from reality faster than code does. Mark aspirational claims as "future-target" or annotate with verified-date footer. |

## Phase 7.6 — Botsson Surface Disambiguation (added 2026-04-29 per ADR-0238)

If the page hosts a domain chat surface (in-page chat textbox, mission-prefixed POST to `/api/botsson/chat` or `/api/emma/chat`), the page MUST declare ownership of the chat surface so BotssonShell renders in passive mode.

Checklist:
- [ ] Does the page have an in-page chat surface?
- [ ] If yes: is `<DomainChatOwnership reason="...">` declared in the page or layout?
- [ ] Is BotssonShell mounted at parent layout level (e.g., `platform-admin/layout.tsx`)?
- [ ] Verify in dev: when on this page, the Orb renders icon-only / passive — NOT interactive

Pages with embedded chat to watch: `/platform-admin/journeys/wizard/*`, `/platform-admin/helpdesk-preview/*`, `/dashboard/komm/*`, `/platform-admin/communications/compose/*`.

Without disambiguation: user faces two surfaces both labeled "AI chat", no signal which routes where, types in wrong surface, message misrouted, no error, no redirect. Silent-failure UX is shipping-blocker class.

## Phase 9 — Mobile Parity Verification

Before flipping `verified: true` in run.yml, verify ADR-0133 alignment:

1. Are the data hooks this page uses living in `packages/` (not `apps/web/src/hooks/`)?
2. If this page handles a "verb" that mobile owns per ADR-0133 (Approve/Execute/Witness/D6 production), does a mobile counterpart exist in `apps/mobile/src/`?
3. If not, document in `run.yml` under `mobile_parity:` field as `pending` with linked issue.

Mobile-polish is a separate skill (planned: `smartout-mobile-polish`). Phase 9 here is only the data-layer parity check, not visual parity.

## Cross-References

- `smartout-nordic-split` — design tokens + forbidden colors (phase 4)
- `framer-motion-animator` — spring/fade orchestration (phase 4)
- `frontend-design:frontend-design` — agent for polish bursts (phase 4)
- `smartout-cascade-developer` — D1–D6 alignment when polishing schedule/season pages
- ADR-0134 — mobile telemetry contract
- ADR-0238 — Botsson surface disambiguation (Phase "Surface Disambiguation")
- `packages/telemetry/src/registry.ts` — telemetry source of truth
- `apps/web/src/app/Botsson/_components/tool-registry.ts` — harness tool registration
- `apps/web/.botsson/site-map.json` — site-map source of truth (Phase 8)
- `apps/web/scripts/validate-site-map.ts` — validator that diffs `useRegisterTools` calls against site-map.json
- `docs/reference/ROUTES.md` — canonical route catalog (module + access reference)
- BFF `/api/botsson/voice/session-context` — reads site-map.json, ships in `context_init` bootstrap pipe (2026-05-13 — same pipe as workforce snapshot)
