---
name: smartout-page-polish
description: Use when productionizing a Smartout dashboard page in apps/web/src/app/dashboard/* — symptoms include skeleton flash, layout shift between loading and ready states, missing or mismatched loading.tsx fallback, untracked mutations missing emit(), generic page header without instructions, harness tools registered without description, slow first paint, missing site-map.json entry, or a page that "works" but feels unprofessional. Covers the eight-phase polish workflow: speed-test baseline, bottleneck fix, re-test, UI/UX pass, telemetry registration, page instructions, harness tool descriptions, site-map registration.
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
3. Copy `purpose` from the header description you wrote in Phase 6.
4. List every tool you registered in Phase 7 (name + description verbatim from `useRegisterTools` kit).
5. Set `polished_at` to today's date.
6. Bump `generated_at` to today's ISO timestamp.
7. Run `pnpm --filter web site-map:validate`. Fix any reported drift before commit.

**Static metadata sources (do NOT duplicate by hand):**

- Module → cross-reference `docs/reference/ROUTES.md` (canonical route catalog).
- Access → derived from server-layout role guards; pull from the actual `if (!isAdmin) redirect(...)` chain on the route.
- Tier → "Structural Walkthrough Order" section in this skill.

**Why this matters:** the bootstrap pipe `BFF → context_init → voice-agent` (same one that delivers the workforce snapshot 2026-05-13) reads this JSON and injects `## Sidekart` as a developer message in the Realtime LLM's chat context. With the site-map injected, Botsson can answer "hvor finner jeg HMS-loggen?" → "Gå til /dashboard/governance/hms" instantly, and pick the correct page-scoped tool by name without first navigating + waiting for page-mount tool registration.

**Failure modes the validator catches:**

| Symptom | Cause |
|---------|-------|
| Botsson says "siden finnes ikke" for a polished page | Entry missing from site-map.json |
| Botsson calls `query_smartout` to look up a tool that exists on the page | Tool registered in `useRegisterTools` but not listed in entry's `tools` array |
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

## Phase 5 — Botsson Surface Disambiguation (added 2026-04-29 per ADR-0238)

If the page hosts a domain chat surface (in-page chat textbox, mission-prefixed POST to `/api/botsson/chat` or `/api/emma/chat`), the page MUST declare ownership of the chat surface so BotssonShell renders in passive mode.

Checklist:
- [ ] Does the page have an in-page chat surface?
- [ ] If yes: is `<DomainChatOwnership reason="...">` declared in the page or layout?
- [ ] Is BotssonShell mounted at parent layout level (e.g., `platform-admin/layout.tsx`)?
- [ ] Verify in dev: when on this page, the Orb renders icon-only / passive — NOT interactive

Pages with embedded chat to watch: `/platform-admin/journeys/wizard/*`, `/platform-admin/helpdesk-preview/*`, `/dashboard/komm/*`, `/platform-admin/communications/compose/*`.

Without disambiguation: user faces two surfaces both labeled "AI chat", no signal which routes where, types in wrong surface, message misrouted, no error, no redirect. Silent-failure UX is shipping-blocker class.

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
