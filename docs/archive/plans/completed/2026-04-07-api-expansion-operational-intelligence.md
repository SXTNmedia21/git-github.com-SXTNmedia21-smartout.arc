---
title: "API Expansion — Operational Intelligence Layer"
status: draft
updated: 2026-04-07
created: 2026-04-07
module: workspace-api
tags: [api, integration, edda, guardian, events, schedules, operations]
---

# API Expansion — Operational Intelligence Layer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the SmartOut public API from 7 read-only endpoints to 25+ endpoints covering schedules, operations, compliance, events, equipment, suppliers, and waste — making SmartOut the most valuable data source for analytics platforms like Edda.

**Architecture:** All new endpoints follow the existing workspace-api pattern: handler file in `supabase/functions/workspace-api/handlers/`, registered in `index.ts`, scope-guarded via `requireScope()`, workspace-isolated via `executeWithWorkspaceContext()`. New domain tables (supplier, waste_log, asset_maintenance) need migrations with RLS policies (both JWT and API key paths). Some existing tables need API key RLS policies added.

**Tech Stack:** Deno (Supabase Edge Functions), PostgreSQL (migrations + RLS), TypeScript

**Key reference files:**

- Router: `supabase/functions/workspace-api/index.ts`
- Example handler: `supabase/functions/workspace-api/handlers/profiles.ts`
- Auth middleware: `supabase/functions/_shared/auth-middleware.ts`
- Scope middleware: `supabase/functions/_shared/scope-middleware.ts`
- DB helper: `supabase/functions/_shared/api-key-auth.ts` (`executeWithWorkspaceContext`)
- Existing API key RLS patterns: `supabase/migrations/20260301100000_api_key_rls_policies.sql`

---

## Phase 1: Expose Existing Data (Tables Already Have API Key RLS)

These tables already exist, have data, AND have `api_key_read_*` RLS policies. We only need handlers + route registration.

---

### Task 1: Schedules handler — shifts and absences

**Files:**

- Create: `supabase/functions/workspace-api/handlers/schedules.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

**Step 1: Create the schedules handler**

```typescript
// supabase/functions/workspace-api/handlers/schedules.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetShifts(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "schedules:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const employeeId = url.searchParams.get("employee_id");
  const status = url.searchParams.get("status");

  let query = `
    SELECT schedule_shift_id, employee_id, position_id, team_id,
           shift_date, role, start_time, end_time, work_hours, breaks,
           day_category, status, is_published, zone, notes,
           created_at, updated_at
    FROM schedule_shift
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (dateFrom) {
    query += ` AND shift_date >= $${idx}`;
    params.push(dateFrom);
    idx++;
  }
  if (dateTo) {
    query += ` AND shift_date <= $${idx}`;
    params.push(dateTo);
    idx++;
  }
  if (employeeId) {
    query += ` AND employee_id = $${idx}`;
    params.push(employeeId);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }

  query += ` ORDER BY shift_date DESC, start_time ASC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ shifts: rows, limit, offset });
}

export async function handleGetAbsences(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "schedules:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const profileId = url.searchParams.get("profile_id");

  let query = `
    SELECT absence_id, profile_id, absence_type, start_date, end_date,
           note, is_approved, created_at
    FROM schedule_absence
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (profileId) {
    query += ` AND profile_id = $${idx}`;
    params.push(profileId);
    idx++;
  }

  query += ` ORDER BY start_date DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ absences: rows, limit, offset });
}
```

**Step 2: Register routes in index.ts**

Add imports and route registrations to `supabase/functions/workspace-api/index.ts`:

```typescript
// Add import
import { handleGetShifts, handleGetAbsences } from "./handlers/schedules.ts";

// Add routes
routes["GET /v1/shifts"] = handleGetShifts;
routes["GET /v1/absences"] = handleGetAbsences;
```

**Step 3: Verify types compile**

Run: `cd supabase/functions && deno check workspace-api/index.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add supabase/functions/workspace-api/handlers/schedules.ts supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add GET /v1/shifts and GET /v1/absences endpoints"
```

---

### Task 2: Operations handler — sessions and deviations

**Files:**

- Create: `supabase/functions/workspace-api/handlers/operations.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

**Step 1: Create the operations handler**

```typescript
// supabase/functions/workspace-api/handlers/operations.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetSessions(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "operations:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const departmentId = url.searchParams.get("department_id");
  const status = url.searchParams.get("status");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT department_session_id, department_id, season_id, session_date,
           status, opened_at, closed_at,
           planned_shifts, actual_shifts, tasks_total, tasks_completed,
           signoff_notes, handoff_notes,
           created_at, updated_at
    FROM department_session
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (departmentId) {
    query += ` AND department_id = $${idx}`;
    params.push(departmentId);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }
  if (dateFrom) {
    query += ` AND session_date >= $${idx}`;
    params.push(dateFrom);
    idx++;
  }
  if (dateTo) {
    query += ` AND session_date <= $${idx}`;
    params.push(dateTo);
    idx++;
  }

  query += ` ORDER BY session_date DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ sessions: rows, limit, offset });
}

export async function handleGetDeviations(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "operations:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const domain = url.searchParams.get("domain");
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");

  let query = `
    SELECT deviation_id, department_id, session_id, domain, subcategory,
           severity, title, description, cost_impact, linked_shift_id,
           status, resolution_notes, resolved_at,
           blocks_day_approval, requires_action, payroll_impact,
           created_at, updated_at
    FROM deviation
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (domain) {
    query += ` AND domain = $${idx}`;
    params.push(domain);
    idx++;
  }
  if (severity) {
    query += ` AND severity = $${idx}`;
    params.push(severity);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ deviations: rows, limit, offset });
}
```

**Step 2: Register routes**

```typescript
// Add import
import { handleGetSessions, handleGetDeviations } from "./handlers/operations.ts";

// Add routes
routes["GET /v1/sessions"] = handleGetSessions;
routes["GET /v1/deviations"] = handleGetDeviations;
```

**Step 3: Verify types compile**

Run: `cd supabase/functions && deno check workspace-api/index.ts`

**Step 4: Commit**

```bash
git add supabase/functions/workspace-api/handlers/operations.ts supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add GET /v1/sessions and GET /v1/deviations endpoints"
```

---

### Task 3: Reports handler — reconciliations, shift approvals, KPIs

**Files:**

- Create: `supabase/functions/workspace-api/handlers/reports.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

**Step 1: Create the reports handler**

```typescript
// supabase/functions/workspace-api/handlers/reports.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetReconciliations(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "reports:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const departmentId = url.searchParams.get("department_id");
  const status = url.searchParams.get("status");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT reconciliation_id, department_id, session_id, reconciliation_date,
           status, settled_at, approved_at,
           revenue_total, revenue_card, revenue_cash, revenue_vat, revenue_transactions, revenue_source,
           total_planned_hours, total_actual_hours, total_labor_cost,
           revenue_per_worked_hour, labor_percentage,
           created_at, updated_at
    FROM daily_reconciliation
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (departmentId) {
    query += ` AND department_id = $${idx}`;
    params.push(departmentId);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }
  if (dateFrom) {
    query += ` AND reconciliation_date >= $${idx}`;
    params.push(dateFrom);
    idx++;
  }
  if (dateTo) {
    query += ` AND reconciliation_date <= $${idx}`;
    params.push(dateTo);
    idx++;
  }

  query += ` ORDER BY reconciliation_date DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ reconciliations: rows, limit, offset });
}

export async function handleGetShiftApprovals(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "reports:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const reconciliationId = url.searchParams.get("reconciliation_id");
  const status = url.searchParams.get("status");

  let query = `
    SELECT approval_id, reconciliation_id, shift_id,
           punch_in, punch_out, planned_hours, calculated_hours, approved_hours,
           status, edit_justification,
           approved_by, approved_at,
           created_at, updated_at
    FROM shift_approval
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (reconciliationId) {
    query += ` AND reconciliation_id = $${idx}`;
    params.push(reconciliationId);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ shift_approvals: rows, limit, offset });
}

export async function handleGetKpiTargets(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "reports:read");
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT id, metric_key, target_value, period_type, period_start, period_end,
            department_id, created_at
     FROM workspace_kpi_target
     WHERE workspace_id = $1
     ORDER BY period_start DESC`,
    [auth.workspaceId],
  );
  return jsonOk({ kpi_targets: rows });
}

export async function handleGetBudgets(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "reports:read");
  if (denied) return denied;

  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT id, target_date, department_id,
           revenue_target, labor_target_hours, labor_target_cost,
           guest_count_target, notes,
           created_at, updated_at
    FROM workspace_budget
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (dateFrom) {
    query += ` AND target_date >= $${idx}`;
    params.push(dateFrom);
    idx++;
  }
  if (dateTo) {
    query += ` AND target_date <= $${idx}`;
    params.push(dateTo);
    idx++;
  }

  query += ` ORDER BY target_date DESC`;
  params.push();

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ budgets: rows });
}
```

**Step 2: Register routes**

```typescript
import {
  handleGetReconciliations,
  handleGetShiftApprovals,
  handleGetKpiTargets,
  handleGetBudgets,
} from "./handlers/reports.ts";

routes["GET /v1/reconciliations"] = handleGetReconciliations;
routes["GET /v1/shift-approvals"] = handleGetShiftApprovals;
routes["GET /v1/kpi-targets"] = handleGetKpiTargets;
routes["GET /v1/budgets"] = handleGetBudgets;
```

**Step 3: Add missing API key RLS policy for shift_approval**

Create migration: `supabase/migrations/20260407100001_api_key_shift_approval.sql`

```sql
SET search_path TO public, extensions;

-- shift_approval needs API key read policy
DROP POLICY IF EXISTS "api_key_read_shift_approval" ON shift_approval;
CREATE POLICY "api_key_read_shift_approval" ON shift_approval
  FOR SELECT USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );
```

**Step 4: Verify and commit**

```bash
git add supabase/functions/workspace-api/handlers/reports.ts \
  supabase/functions/workspace-api/index.ts \
  supabase/migrations/20260407100001_api_key_shift_approval.sql
git commit -m "feat(api): add reconciliations, shift-approvals, kpi-targets, budgets endpoints"
```

---

### Task 4: Guardian handler — signals and event log (THE DIFFERENTIATOR)

**Files:**

- Create: `supabase/functions/workspace-api/handlers/guardian.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

**Step 1: Create the guardian handler**

```typescript
// supabase/functions/workspace-api/handlers/guardian.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetSignals(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "guardian:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const domain = url.searchParams.get("domain");
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status") ?? "active";

  let query = `
    SELECT id, signal_type, domain, severity,
           entity_type, entity_id, entity_label,
           title, description, data, status,
           acknowledged_at, resolved_at, expires_at,
           created_at, updated_at
    FROM guardian_signal
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (status !== "all") {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }
  if (domain) {
    query += ` AND domain = $${idx}`;
    params.push(domain);
    idx++;
  }
  if (severity) {
    query += ` AND severity = $${idx}`;
    params.push(severity);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ signals: rows, limit, offset });
}

export async function handleGetGuardianLog(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "guardian:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const eventType = url.searchParams.get("event_type");
  const since = url.searchParams.get("since");

  let query = `
    SELECT id, session_id, event_type, actor, summary, data, created_at
    FROM guardian_log
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (eventType) {
    query += ` AND event_type = $${idx}`;
    params.push(eventType);
    idx++;
  }
  if (since) {
    query += ` AND created_at >= $${idx}`;
    params.push(since);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ events: rows, limit, offset });
}
```

**Step 2: Register routes**

```typescript
import { handleGetSignals, handleGetGuardianLog } from "./handlers/guardian.ts";

routes["GET /v1/signals"] = handleGetSignals;
routes["GET /v1/guardian-log"] = handleGetGuardianLog;
```

**Step 3: Commit**

```bash
git add supabase/functions/workspace-api/handlers/guardian.ts supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add Guardian signals and event log endpoints"
```

---

### Task 5: Events handler — engine event stream

**Files:**

- Create: `supabase/functions/workspace-api/handlers/events.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

**Step 1: Create the events handler**

```typescript
// supabase/functions/workspace-api/handlers/events.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetEvents(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "events:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const eventType = url.searchParams.get("event_type");
  const since = url.searchParams.get("since");

  let query = `
    SELECT id, event_type, payload, idempotency_key, fired_at
    FROM engine_event
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (eventType) {
    query += ` AND event_type = $${idx}`;
    params.push(eventType);
    idx++;
  }
  if (since) {
    query += ` AND fired_at >= $${idx}`;
    params.push(since);
    idx++;
  }

  query += ` ORDER BY fired_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ events: rows, limit, offset });
}
```

**Step 2: Register route**

```typescript
import { handleGetEvents } from "./handlers/events.ts";

routes["GET /v1/events"] = handleGetEvents;
```

**Step 3: Commit**

```bash
git add supabase/functions/workspace-api/handlers/events.ts supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add engine event stream endpoint"
```

---

## Phase 2: New Domain Tables (Supplier, Waste, Equipment Maintenance)

These require new migrations with tables + RLS, then handlers.

---

### Task 6: Supplier tables migration

**Files:**

- Create: `supabase/migrations/20260407200000_supplier_tables.sql`

**Step 1: Write the migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- Supplier management: directory + order tracking
-- Enables food cost analysis, price trend tracking,
-- and delivery reliability scoring for analytics platforms.
-- ============================================

-- ── supplier ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier (
  supplier_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  org_number        TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  country           TEXT DEFAULT 'NO',
  category          TEXT,                          -- 'food', 'beverage', 'equipment', 'services', 'other'
  payment_terms     TEXT,                          -- 'net30', 'net14', 'cod'
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_supplier" ON supplier;
CREATE POLICY "jwt_read_supplier" ON supplier
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_supplier" ON supplier;
CREATE POLICY "jwt_manage_supplier" ON supplier
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_supplier" ON supplier;
CREATE POLICY "api_key_read_supplier" ON supplier
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_supplier" ON supplier;
CREATE POLICY "service_role_supplier" ON supplier
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_supplier_workspace ON supplier (workspace_id);
CREATE TRIGGER set_supplier_updated_at BEFORE UPDATE ON supplier FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── supplier_order ───────────────────────────────────────
-- Individual delivery/order records. Tracks price per item over time.
CREATE TABLE IF NOT EXISTS public.supplier_order (
  order_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES supplier(supplier_id) ON DELETE CASCADE,
  department_id     UUID REFERENCES department(department_id),
  order_date        DATE NOT NULL,
  delivery_date     DATE,
  total_amount      NUMERIC(12,2),
  currency          TEXT DEFAULT 'NOK',
  status            TEXT NOT NULL DEFAULT 'ordered',  -- 'ordered', 'delivered', 'partial', 'cancelled'
  delivery_rating   INTEGER,                          -- 1-5 quality/reliability score
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_supplier_order" ON supplier_order;
CREATE POLICY "jwt_read_supplier_order" ON supplier_order
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_supplier_order" ON supplier_order;
CREATE POLICY "jwt_manage_supplier_order" ON supplier_order
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_supplier_order" ON supplier_order;
CREATE POLICY "api_key_read_supplier_order" ON supplier_order
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_supplier_order" ON supplier_order;
CREATE POLICY "service_role_supplier_order" ON supplier_order
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_supplier_order_workspace ON supplier_order (workspace_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_order_supplier ON supplier_order (supplier_id, order_date DESC);
CREATE TRIGGER set_supplier_order_updated_at BEFORE UPDATE ON supplier_order FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE supplier IS 'Supplier directory with contact info and payment terms.';
COMMENT ON TABLE supplier_order IS 'Order/delivery records for price tracking and reliability scoring.';
```

**Step 2: Apply migration locally**

Run: `npx supabase db push --local` or restart Supabase

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/20260407200000_supplier_tables.sql packages/supabase/src/database.types.ts
git commit -m "feat(schema): add supplier and supplier_order tables with API key RLS"
```

---

### Task 7: Waste log migration

**Files:**

- Create: `supabase/migrations/20260407200001_waste_log_table.sql`

**Step 1: Write the migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- Waste tracking: daily waste logs with reason codes.
-- Enables food waste analytics, cost attribution,
-- and waste reduction tracking over time.
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waste_category') THEN
    CREATE TYPE waste_category AS ENUM (
      'food_prep',        -- prep waste, trimmings
      'food_spoilage',    -- expired, spoiled
      'food_overproduction', -- cooked but not sold
      'food_returned',    -- customer returns
      'beverage',         -- drinks waste
      'packaging',        -- packaging material
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.waste_log (
  waste_log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id     UUID REFERENCES department(department_id),
  session_id        UUID REFERENCES department_session(department_session_id),

  -- Classification
  category          waste_category NOT NULL,
  item_description  TEXT NOT NULL,
  quantity          NUMERIC(10,3),                 -- kg, liters, units
  unit              TEXT DEFAULT 'kg',
  estimated_cost    NUMERIC(10,2),

  -- Context
  reason            TEXT,                          -- free-text explanation
  recorded_by       UUID REFERENCES profile(profile_id),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_waste_log" ON waste_log;
CREATE POLICY "jwt_read_waste_log" ON waste_log
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_waste_log" ON waste_log;
CREATE POLICY "jwt_manage_waste_log" ON waste_log
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_waste_log" ON waste_log;
CREATE POLICY "api_key_read_waste_log" ON waste_log
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_waste_log" ON waste_log;
CREATE POLICY "service_role_waste_log" ON waste_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_waste_log_workspace ON waste_log (workspace_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_log_session ON waste_log (session_id) WHERE session_id IS NOT NULL;
CREATE TRIGGER set_waste_log_updated_at BEFORE UPDATE ON waste_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE waste_log IS 'Per-item waste tracking with category, cost, and reason codes.';
```

**Step 2: Apply and regenerate types**

Run: `npx supabase db push --local && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 3: Commit**

```bash
git add supabase/migrations/20260407200001_waste_log_table.sql packages/supabase/src/database.types.ts
git commit -m "feat(schema): add waste_log table with category enum and API key RLS"
```

---

### Task 8: Equipment maintenance migration

**Files:**

- Create: `supabase/migrations/20260407200002_asset_maintenance_tables.sql`

**Step 1: Write the migration**

The `asset` table already exists with `workspace_id`, `location_id`, `name`, `requires_training`, `requires_routine`. We need to add: maintenance logs, downtime tracking, and API key RLS (missing from original asset table).

```sql
SET search_path TO public, extensions;

-- ============================================
-- Equipment/asset lifecycle: maintenance logs + downtime.
-- Extends existing asset table with operational tracking.
-- ============================================

-- 1. Add API key RLS to existing asset table (missing)
DROP POLICY IF EXISTS "api_key_read_asset" ON asset;
CREATE POLICY "api_key_read_asset" ON asset
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

-- 2. Add columns to asset table for richer equipment data
ALTER TABLE asset ADD COLUMN IF NOT EXISTS asset_type TEXT;           -- 'oven', 'dishwasher', 'pos_terminal', 'fridge', etc.
ALTER TABLE asset ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(12,2);
ALTER TABLE asset ADD COLUMN IF NOT EXISTS warranty_expires DATE;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id);

-- 3. Maintenance log
CREATE TABLE IF NOT EXISTS public.asset_maintenance (
  maintenance_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL REFERENCES asset(asset_id) ON DELETE CASCADE,
  maintenance_type  TEXT NOT NULL,                  -- 'scheduled', 'repair', 'inspection', 'cleaning'
  description       TEXT NOT NULL,
  cost              NUMERIC(10,2),
  performed_by      TEXT,                          -- vendor/technician name
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_scheduled    TIMESTAMPTZ,                   -- next maintenance date
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_asset_maintenance" ON asset_maintenance;
CREATE POLICY "jwt_read_asset_maintenance" ON asset_maintenance
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_asset_maintenance" ON asset_maintenance;
CREATE POLICY "jwt_manage_asset_maintenance" ON asset_maintenance
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_asset_maintenance" ON asset_maintenance;
CREATE POLICY "api_key_read_asset_maintenance" ON asset_maintenance
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_asset_maintenance" ON asset_maintenance;
CREATE POLICY "service_role_asset_maintenance" ON asset_maintenance
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance (asset_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_workspace ON asset_maintenance (workspace_id, performed_at DESC);
CREATE TRIGGER set_asset_maintenance_updated_at BEFORE UPDATE ON asset_maintenance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Downtime tracking
CREATE TABLE IF NOT EXISTS public.asset_downtime (
  downtime_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL REFERENCES asset(asset_id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,                   -- null = still down
  reason            TEXT NOT NULL,
  impact_description TEXT,
  estimated_revenue_impact NUMERIC(12,2),          -- estimated lost revenue
  reported_by       UUID REFERENCES profile(profile_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asset_downtime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_asset_downtime" ON asset_downtime;
CREATE POLICY "jwt_read_asset_downtime" ON asset_downtime
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_asset_downtime" ON asset_downtime;
CREATE POLICY "jwt_manage_asset_downtime" ON asset_downtime
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_asset_downtime" ON asset_downtime;
CREATE POLICY "api_key_read_asset_downtime" ON asset_downtime
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_asset_downtime" ON asset_downtime;
CREATE POLICY "service_role_asset_downtime" ON asset_downtime
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_asset_downtime_asset ON asset_downtime (asset_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_downtime_active ON asset_downtime (workspace_id)
  WHERE ended_at IS NULL;
CREATE TRIGGER set_asset_downtime_updated_at BEFORE UPDATE ON asset_downtime FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE asset_maintenance IS 'Equipment maintenance log: repairs, inspections, scheduled service.';
COMMENT ON TABLE asset_downtime IS 'Equipment downtime tracking with revenue impact estimation.';
```

**Step 2: Apply and regenerate types**

Run: `npx supabase db push --local && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 3: Commit**

```bash
git add supabase/migrations/20260407200002_asset_maintenance_tables.sql packages/supabase/src/database.types.ts
git commit -m "feat(schema): add asset_maintenance, asset_downtime tables; extend asset with equipment fields"
```

---

### Task 9: Supplier, waste, and equipment API handlers

**Files:**

- Create: `supabase/functions/workspace-api/handlers/suppliers.ts`
- Create: `supabase/functions/workspace-api/handlers/waste.ts`
- Create: `supabase/functions/workspace-api/handlers/equipment.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

**Step 1: Create suppliers handler**

```typescript
// supabase/functions/workspace-api/handlers/suppliers.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetSuppliers(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "suppliers:read");
  if (denied) return denied;

  const category = url.searchParams.get("category");

  let query = `
    SELECT supplier_id, name, org_number, contact_name, contact_email, contact_phone,
           address, city, postal_code, country, category, payment_terms,
           is_active, created_at
    FROM supplier WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (category) {
    query += ` AND category = $${idx}`;
    params.push(category);
    idx++;
  }

  query += ` ORDER BY name`;
  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ suppliers: rows });
}

export async function handleGetSupplierOrders(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "suppliers:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const supplierId = url.searchParams.get("supplier_id");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT order_id, supplier_id, department_id, order_date, delivery_date,
           total_amount, currency, status, delivery_rating, notes, created_at
    FROM supplier_order WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (supplierId) {
    query += ` AND supplier_id = $${idx}`;
    params.push(supplierId);
    idx++;
  }
  if (dateFrom) {
    query += ` AND order_date >= $${idx}`;
    params.push(dateFrom);
    idx++;
  }
  if (dateTo) {
    query += ` AND order_date <= $${idx}`;
    params.push(dateTo);
    idx++;
  }

  query += ` ORDER BY order_date DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ orders: rows, limit, offset });
}
```

**Step 2: Create waste handler**

```typescript
// supabase/functions/workspace-api/handlers/waste.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetWasteLogs(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "waste:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const category = url.searchParams.get("category");
  const departmentId = url.searchParams.get("department_id");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT waste_log_id, department_id, session_id, category,
           item_description, quantity, unit, estimated_cost,
           reason, recorded_by, recorded_at, created_at
    FROM waste_log WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (category) {
    query += ` AND category = $${idx}`;
    params.push(category);
    idx++;
  }
  if (departmentId) {
    query += ` AND department_id = $${idx}`;
    params.push(departmentId);
    idx++;
  }
  if (dateFrom) {
    query += ` AND recorded_at >= $${idx}`;
    params.push(dateFrom);
    idx++;
  }
  if (dateTo) {
    query += ` AND recorded_at <= $${idx}`;
    params.push(dateTo);
    idx++;
  }

  query += ` ORDER BY recorded_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ waste_logs: rows, limit, offset });
}
```

**Step 3: Create equipment handler**

```typescript
// supabase/functions/workspace-api/handlers/equipment.ts
import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
    environment: null,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetAssets(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "equipment:read");
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT asset_id, location_id, department_id, name, description,
            asset_type, serial_number, manufacturer, model,
            purchase_date, purchase_cost, warranty_expires,
            requires_training, requires_routine, is_active, created_at
     FROM asset WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ assets: rows });
}

export async function handleGetAssetMaintenance(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "equipment:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const assetId = url.searchParams.get("asset_id");

  let query = `
    SELECT maintenance_id, asset_id, maintenance_type, description, cost,
           performed_by, performed_at, next_scheduled, notes, created_at
    FROM asset_maintenance WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (assetId) {
    query += ` AND asset_id = $${idx}`;
    params.push(assetId);
    idx++;
  }

  query += ` ORDER BY performed_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ maintenance: rows, limit, offset });
}

export async function handleGetAssetDowntime(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "equipment:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const assetId = url.searchParams.get("asset_id");
  const activeOnly = url.searchParams.get("active_only");

  let query = `
    SELECT downtime_id, asset_id, started_at, ended_at, reason,
           impact_description, estimated_revenue_impact, created_at
    FROM asset_downtime WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (assetId) {
    query += ` AND asset_id = $${idx}`;
    params.push(assetId);
    idx++;
  }
  if (activeOnly === "true") {
    query += ` AND ended_at IS NULL`;
  }

  query += ` ORDER BY started_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ downtime: rows, limit, offset });
}
```

**Step 4: Register all new routes in index.ts**

```typescript
import { handleGetSuppliers, handleGetSupplierOrders } from "./handlers/suppliers.ts";
import { handleGetWasteLogs } from "./handlers/waste.ts";
import {
  handleGetAssets,
  handleGetAssetMaintenance,
  handleGetAssetDowntime,
} from "./handlers/equipment.ts";

routes["GET /v1/suppliers"] = handleGetSuppliers;
routes["GET /v1/supplier-orders"] = handleGetSupplierOrders;
routes["GET /v1/waste-logs"] = handleGetWasteLogs;
routes["GET /v1/assets"] = handleGetAssets;
routes["GET /v1/asset-maintenance"] = handleGetAssetMaintenance;
routes["GET /v1/asset-downtime"] = handleGetAssetDowntime;
```

**Step 5: Commit**

```bash
git add supabase/functions/workspace-api/handlers/suppliers.ts \
  supabase/functions/workspace-api/handlers/waste.ts \
  supabase/functions/workspace-api/handlers/equipment.ts \
  supabase/functions/workspace-api/index.ts
git commit -m "feat(api): add supplier, waste, and equipment endpoints"
```

---

## Phase 3: Update Scopes & API Docs

### Task 10: Update scope registry in CLAUDE.md

Add to the canonical scope list in `CLAUDE.md`:

| Scope             | Endpoints                                                              | Status |
| ----------------- | ---------------------------------------------------------------------- | ------ |
| `schedules:read`  | /v1/shifts, /v1/absences                                               | Active |
| `operations:read` | /v1/sessions, /v1/deviations                                           | Active |
| `reports:read`    | /v1/reconciliations, /v1/shift-approvals, /v1/kpi-targets, /v1/budgets | Active |
| `guardian:read`   | /v1/signals, /v1/guardian-log                                          | Active |
| `events:read`     | /v1/events                                                             | Active |
| `suppliers:read`  | /v1/suppliers, /v1/supplier-orders                                     | Active |
| `waste:read`      | /v1/waste-logs                                                         | Active |
| `equipment:read`  | /v1/assets, /v1/asset-maintenance, /v1/asset-downtime                  | Active |

**Step 1: Update CLAUDE.md scope table**

Add the 6 new scopes to the canonical scope list section.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add 6 new API scopes to canonical scope registry"
```

---

### Task 11: Update API docs page and sidebar

**Files:**

- Modify: `apps/landing/src/app/docs/api/page.tsx`
- Modify: `apps/landing/src/app/docs/_components/api-sidebar.tsx`

Add all new endpoints to the Public API section of the docs page, following the existing pattern. Update sidebar navigation to include new endpoint groups:

- Schedules (shifts, absences)
- Operations (sessions, deviations)
- Reports (reconciliations, shift-approvals, kpi-targets, budgets)
- Guardian (signals, guardian-log)
- Events (events)
- Suppliers (suppliers, supplier-orders)
- Waste (waste-logs)
- Equipment (assets, asset-maintenance, asset-downtime)

Update the scopes reference table at the bottom of the page.

**Step 1: Update sidebar navigation array with new sections**

**Step 2: Add endpoint documentation sections to page.tsx**

**Step 3: Typecheck**

Run: `pnpm --filter landing exec tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/landing/src/app/docs/api/page.tsx apps/landing/src/app/docs/_components/api-sidebar.tsx
git commit -m "docs(api): add all new endpoints to public API documentation"
```

---

## Final Endpoint Summary

After implementation, the full public API surface:

| #   | Method | Path                  | Scope           | Phase    |
| --- | ------ | --------------------- | --------------- | -------- |
| 1   | GET    | /v1/profiles          | profiles:read   | Existing |
| 2   | GET    | /v1/departments       | profiles:read   | Existing |
| 3   | GET    | /v1/teams             | profiles:read   | Existing |
| 4   | GET    | /v1/locations         | profiles:read   | Existing |
| 5   | GET    | /v1/contracts         | contracts:read  | Existing |
| 6   | GET    | /v1/protocols         | training:read   | Existing |
| 7   | GET    | /v1/assignments       | training:read   | Existing |
| 8   | GET    | /v1/shifts            | schedules:read  | Phase 1  |
| 9   | GET    | /v1/absences          | schedules:read  | Phase 1  |
| 10  | GET    | /v1/sessions          | operations:read | Phase 1  |
| 11  | GET    | /v1/deviations        | operations:read | Phase 1  |
| 12  | GET    | /v1/reconciliations   | reports:read    | Phase 1  |
| 13  | GET    | /v1/shift-approvals   | reports:read    | Phase 1  |
| 14  | GET    | /v1/kpi-targets       | reports:read    | Phase 1  |
| 15  | GET    | /v1/budgets           | reports:read    | Phase 1  |
| 16  | GET    | /v1/signals           | guardian:read   | Phase 1  |
| 17  | GET    | /v1/guardian-log      | guardian:read   | Phase 1  |
| 18  | GET    | /v1/events            | events:read     | Phase 1  |
| 19  | GET    | /v1/suppliers         | suppliers:read  | Phase 2  |
| 20  | GET    | /v1/supplier-orders   | suppliers:read  | Phase 2  |
| 21  | GET    | /v1/waste-logs        | waste:read      | Phase 2  |
| 22  | GET    | /v1/assets            | equipment:read  | Phase 2  |
| 23  | GET    | /v1/asset-maintenance | equipment:read  | Phase 2  |
| 24  | GET    | /v1/asset-downtime    | equipment:read  | Phase 2  |

**9 scopes, 24 endpoints, 3 new tables, 2 extended tables.**
