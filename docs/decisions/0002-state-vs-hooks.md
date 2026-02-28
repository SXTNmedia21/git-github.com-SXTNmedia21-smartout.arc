# ADR-0002: State-Driven vs Hook-Driven Logic Boundaries

**Status:** Accepted  
**Date:** 2026-02-24

## Context and Problem Statement

Smartout handles complex workflows (shift planning, task progression, user onboarding). We must define when logic is executed purely through database State Transitions (via Supabase triggers/edge functions listening to row changes) versus UI Event-Driven Hooks (e.g., custom React hooks triggering mutations). Mixed methodologies cause race conditions and duplicate logic.

## Considered Options

1. **Frontend-heavy Hooks**: All business logic fired off by `onClick` or `useEffect` on the client.
2. **Strict State-Driven**: Database drives everything. UI only submits data updates and listens to Realtime changes.
3. **Hybrid (State for Domain, Hooks for UI)**: Domain logic belongs in State; interaction routing belongs in Hooks.

## Decision Outcome

Chosen option: **Hybrid (State for Domain, Hooks for UI)**.

### The Rule Base (Skillnaden / The Differences)

- **State-Driven Methodology (Domain Logic)**
  - The database is the authority. If a task becomes `completed`, a backend trigger recalculates the `readiness_score`. The Frontend NEVER computes this score.
  - _Example:_ Changing `profile_status` from `trainee` to `active`. The UI updates the row. The Backend (Supabase Trigger + Edge Function) sends the email and grants permissions.
- **Hook-Driven Methodology (UI/UX Logic)**
  - Custom Hooks (`useDepartmentSessions`, `useShiftPlanning`) act merely as _dispatchers_ and _projectors_.
  - They wrap `useQuery` or `useMutation` (TanStack) to execute a state change, and provide optimistic UI updates while the State-Driven backend calculates the true outcome.

## Agent Instructions (Rules enforced for Gemini/Claude)

1. **Never write complex business logic inside a React Hook or Component.** If an action triggers multiple side effects across tables, write a Supabase Edge Function or Database Trigger. The Hook only calls the function or updates a single source column.
2. Use `useQuery` / `useMutation` for all hooks.
3. When creating a workflow, refer to this ADR to ensure the boundary between State and Event (Hook) is not blurred.
