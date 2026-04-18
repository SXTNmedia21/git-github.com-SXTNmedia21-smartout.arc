---
title: "Plan — gatedwrite-pilot (post-WP2 call-site migration reference)"
status: exploration
updated: 2026-04-18
created: 2026-04-18
module: governance
tags: [plan, adr-0091, gatedwrite, call-site-migration, pilot]
---

## Executive Summary

This plan defines a pilot module for migrating call sites from direct Supabase writes (flagged by ESLint rule `smartout/no-direct-supabase-write`) to the new `gatedInsert/Update/Delete` wrapper API shipped today in WP2. The RPC `cascade_gate_write` now gates writes against `framework_trigger` entity types; only gated tables (4 types: `schedule_shift`, `profile`, `employment_contract`, `season`) require error handling for `GateDeniedError`. We recommend migrating `people-actions.ts` (5 violations on `profile` table, all server actions, low risk, self-contained) as the reference pattern for future mechanical migrations. Error handling will surface proposal IDs to the UI with a "needs approval" toast, returning `{ ok: true, pendingProposal }`. Non-gated tables should scope out of the pilot to maximize learning value.

## Framework Trigger Coverage

The `hospitality.no.default.v1` framework seeded today gates writes on exactly 4 entity types via `cascade_gate_write` RPC:

| Entity Type | Trigger Count | Rule Categories | Gating Behavior |
|---|---|---|---|
| `schedule_shift` | 4 | working_time, overtime, rest, compensation, Sunday/holiday | All writes to schedule_shift are intercepted; framework-trigger-matched → `proposal_id` returned |
| `profile` | 1 | working_time (avg hours check) | Writes to profile are gated on weekly hour aggregation; time_based trigger |
| `employment_contract` | 1 | employment terms, vacation, wage | Writes to employment_contract trigger contract validation |
| `season` | 1 | tariff rates, compensation | Writes to season trigger tariff re-evaluation |

**Tables NOT in this list** (e.g., `team`, `website_publish_event`, `contract_event`, `handbook_chapter`) are NOT gated by cascade_gate_write; they will receive `outcome='applied'` with no proposal creation, making migration a straightforward plumbing pass-through.

## Call-Site Map (ESLint Surface)

**Total violations: 96 direct `.from().insert|update|delete` calls across apps/web/src**

Bucketed by location and target table:

### By Location
- **Server Actions** (`apps/web/src/app/**/_actions/*.ts`): 5 violations
  - `people-actions.ts`: 1 (`profile.update`)
  - `publish-actions.ts`: 3 (`website_published_snapshot.insert|update`, `website.update`, `website_publish_event.insert`)
  - `website-actions.ts`: 1 (non-gated)
- **API Routes** (`apps/web/src/app/api/**`): 40 violations
  - Spread across 15+ tables; highest: `contract_event` (8), `journey_event` (7)
- **Components** (`apps/web/src/components/**`): 5 violations (dashboard wizards, non-gated)
- **Lib**: 1 violation

### By Gated Table
- `schedule_shift`: 4 violations (2 in API routes, 2 in components)
- `profile`: 1 violation (server action: `people-actions.ts`)
- `employment_contract`: 0 violations
- `season`: 1 violation (component)

**Non-gated tables dominate the surface** (91 violations), but these are lower-risk for the pilot since pass-through behavior (`allowed=true`) requires no error-handling change.

## Pilot Candidate Recommendation

**Recommended module: `people-actions.ts`**

**Rationale:**
- **Single gated table** (`profile`): 1 violation, all `.update()` calls
- **Low call-site count** (5 exported functions touching `profile`): `updateProfileRole`, `updateProfileRole`, `updateProfileDepartment`, `deactivateProfile`, `updateProfileStatus`, `reactivateProfile`, `bulkUpdateProfiles`
- **Self-contained** (no cross-module coupling beyond telemetry + profile schema)
- **Low-stakes domain** (workforce management, not contracts or payroll)
- **Clear ownership** (single server action file)
- **Existing telemetry patterns** (easy to emit `gate_denied` event for audit)

All functions follow identical pattern: server-role client → `.update({ ... })` → emit telemetry. Migration requires wrapping 7 call sites with `gatedUpdate` and adding `GateDeniedError` handling.

### Why Not Others
- `publish-actions.ts`: writes to `websites` schema (untyped), multiple tables, includes service-role operations; high complexity for reference implementation.
- `schedule_shift` violations: spread across API routes (not Server Actions), harder to package as a cohesive reference.

## Error-Handling Pattern (Option A Chosen)

**Selected: Surface proposal_id to UI; toast "Needs approval"; return `{ ok: true, pendingProposal: proposal_id }`**

**Code sketch:**

```typescript
// people-actions.ts (gated migration)
import { gatedUpdate, GateDeniedError, type GateContext } from "@smartout/supabase/gate-client";

export async function updateProfileRole(
  profileId: string,
  workspaceId: string,
  newRole: NonNullable<TablesUpdate<"profile">["role"]>,
): Promise<{ ok: true; pendingProposal?: string } | { ok: false; error: string }> {
  const supabase = await getClient();
  const { data: currentProfile } = await supabase
    .from("profile")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  const gateCtx: GateContext = {
    entityType: "profile",
    entityId: profileId,
    workspaceId,
    capability: "profile:update:role",
    actorProfileId: await resolveActorId(supabase),
    currentData: currentProfile,
  };

  try {
    const result = await gatedUpdate(supabase, "profile", { role: newRole }, gateCtx);
    
    if (result.outcome === "proposed") {
      // Emit audit event for reviewer intake
      void emit({
        event: "profile update proposed",
        workspace_id: workspaceId,
        actor_id: gateCtx.actorProfileId,
        properties: {
          entity: { entity_type: "profile", entity_id: profileId },
          proposal_id: result.pendingProposal,
        },
      });
      return { ok: true, pendingProposal: result.data[0]?.proposal_id };
    }

    void emit({ event: "profile role updated", ... }); // existing telemetry
    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      return { 
        ok: false, 
        error: `Write requires approval (proposal: ${err.proposalId})` 
      };
    }
    return { ok: false, error: (err as Error).message };
  }
}
```

**UI side (React client):**
```typescript
// Usage in component
const result = await updateProfileRole(profileId, workspaceId, newRole);
if (result.ok && result.pendingProposal) {
  toast.info(`Change pending approval (${result.pendingProposal})`);
} else if (!result.ok) {
  toast.error(result.error);
}
```

**Why option A:**
- Caller gets proposal_id immediately; can route to inbox for review
- Requires minimal client-side change (just render pending state)
- Matches existing telemetry audit trail (record proposal_id + actor)
- Non-disruptive UX: user sees "waiting for reviewer" in toast, not an error

**Rejected alternatives:**
- (b) Throw a Result: adds ceremony; error is expected, not exceptional
- (c) Block + log: loses proposal context at call site; reviewer must hunt inbox

## Test Strategy

**Existing pattern: Vitest + vi.mock (unit tests with mocked Supabase)**

Repository uses `vitest` + `vi.mock()` for route/action tests. See `/apps/web/src/app/api/schedule/send-message/__tests__/route.test.ts` for reference (mocks client, admin client, external APIs).

**Minimum viable test for `people-actions.ts` migration:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfileRole } from "../people-actions";
import { GateDeniedError } from "@smartout/supabase/gate-client";

const supabaseClientMock = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(() => supabaseClientMock),
}));

describe("updateProfileRole (gated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { ok: true, pendingProposal } when gate returns proposed", async () => {
    const updateChain = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ proposal_id: "p-123" }] }) }) });
    supabaseClientMock.from.mockReturnValue({ update: updateChain, select: vi.fn().mockResolvedValue({ data: [{ role: "manager" }] }) });
    
    // Mock gatedUpdate to throw GateDeniedError
    vi.mock("@smartout/supabase/gate-client", async () => {
      const actual = await vi.importActual("@smartout/supabase/gate-client");
      return {
        ...actual,
        gatedUpdate: vi.fn().mockRejectedValue(new GateDeniedError({ outcome: "proposed", proposalId: "p-123" })),
      };
    });

    const result = await updateProfileRole("prof-1", "ws-1", "manager");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("proposal");
  });

  it("writes and returns { ok: true } when gate allows", async () => {
    // Mock gatedUpdate to resolve successfully
    // Assert telemetry event was emitted with outcome='applied'
  });

  it("returns { ok: false, error } when gatedUpdate throws non-gate error", async () => {
    // Mock gatedUpdate to throw generic error
    // Assert result.ok = false, error message in result.error
  });
});
```

**What's being proven:**
1. `GateDeniedError` is caught and converted to result shape
2. `proposal_id` is extracted and returned
3. Non-gate errors are also caught and logged
4. Telemetry is emitted (via `vi.spyOn(emit)`)
5. When gate allows, normal path executes

**Coverage depth:** Unit level (mocked Supabase). Integration test (full RPC round-trip) would live in `supabase/tests/` as a SQL integration test.

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `GateDeniedError` not caught in call site → unhandled rejection | High | (1) Add catch handler in pilot. (2) Lint rule enforcement. (3) Integration test. |
| Caller forgets to pass `currentData` for UPDATE → gate comparison fails | Medium | (1) Type-check in `GateContext` (optional → doc warning). (2) Telemetry audit shows missing data. (3) Code review in pilot PR. |
| proposal_id lost in transit (client discards it) → can't route to reviewer | Medium | (1) Return in result shape. (2) Telemetry emits proposal_id in audit row. (3) Reviewer can search change_proposal table. |
| Test mocking complexity (vi.mock chain is deep) → brittle tests | Low | (1) Use factory helpers for mock chains. (2) Snapshot the mock shape. (3) Focus on contract, not internals. |
| Non-gated tables migrated in pilot → false sense of "done" | Medium | **Scope to gated tables only**; document pass-through migration as follow-up. |

## Next Session Kickoff

**What to dispatch:**
1. **Refine handler signature** — merge the `{ ok: true, pendingProposal? }` shape with existing pattern (if action returns `{ ok: boolean, error? }` elsewhere, unify). Confirm UX toast message with product.
2. **Add TSDoc to `people-actions.ts`** — mark which functions are gated + what to do on `GateDeniedError`.
3. **Write the pilot PR:**
   - Modify 7 functions in `people-actions.ts` to use `gatedUpdate`
   - Add `GateDeniedError` catch + result conversion
   - Emit telemetry with `proposal_id` when proposed
   - Add 3–4 unit tests (happy path, denied path, error path)
   - Link to ADR-0091 + this plan in PR description
4. **Land the pilot** → collect feedback, then mechanize remaining migrations
5. **Create follow-up issues** — for each non-gated table (scope, sequence, owner)

---

**Document prepared:** 2026-04-18  
**Pilot complexity estimate:** 4–6 hours (code + test + review)  
**Future migrations:** Once pilot pattern is proven, 2–3 hours per module (mechanical)
