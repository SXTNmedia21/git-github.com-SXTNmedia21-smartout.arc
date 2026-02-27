# Module 13: Multi-Tenant & Skalering (Multi-Tenancy & Scaling)

> **Smartout.io** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2 (Workspace, Company, Profile, all tables with workspace_id)

---

## 1. Module Overview

Every table in Smartout contains `workspace_id`. This module formalizes how workspace isolation works, how data is secured between tenants, and how the system scales as workspaces grow.

**Key insight:** Multi-tenancy in Smartout is not an afterthought — it's built into every table from day one. The question isn't "how do we add multi-tenancy?" but "how do we enforce it consistently and scale it efficiently?"

### What This Module Covers

- Workspace data isolation (the scoping model)
- Row Level Security (RLS) policies for Supabase
- Cross-workspace scenarios (multi-location companies, Super-Admin)
- Performance optimization (indexing, caching, query patterns)
- Subscription & billing (Stripe integration, plan limits)
- Scaling considerations (data volume, real-time connections)

---

## 2. The Scoping Model

### 2.1 Data Hierarchy

```
Company (legal entity)
  │
  ├── Workspace A (Restaurant downtown)
  │     ├── All departments, locations, teams, seasons
  │     ├── All profiles (employees at this location)
  │     ├── All policies, protocols, procedures
  │     ├── All shifts, sessions, tasks
  │     ├── All chat, notifications, training
  │     └── workspace_id = "ws-A" on EVERY row
  │
  └── Workspace B (Restaurant suburb)
        ├── Completely separate data
        └── workspace_id = "ws-B" on EVERY row
```

### 2.2 What's Scoped Where

| Level | Entities | Isolation |
|-------|----------|-----------|
| **User** | `user` table | Global — one user across all workspaces |
| **Company** | `company`, `company_member` | Company-level — shared across company's workspaces |
| **Workspace** | Everything else | Strict workspace isolation via `workspace_id` |

### 2.3 Tables Without workspace_id

Only three tables are NOT scoped by workspace:

| Table | Why | Scoping mechanism |
|-------|-----|-------------------|
| `user` | A person exists independently of workspaces | Scoped via auth — user only sees own record |
| `company` | Legal entity spans workspaces | Scoped via `company_member` — user must be a member |
| `company_member` | Bridge between user and company | Scoped via `user_id` — user sees own memberships |

**Everything else** has `workspace_id` and is strictly isolated.

---

## 3. Row Level Security (RLS)

### 3.1 RLS Strategy

Supabase RLS policies enforce data isolation at the database level. Even if application code has a bug, data cannot leak between workspaces.

**The fundamental pattern:**

```sql
-- Every table with workspace_id gets this base policy:
CREATE POLICY "workspace_isolation" ON [table_name]
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profile
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );
```

This ensures: a user can only access data in workspaces where they have an active Profile.

### 3.2 RLS Policies by Access Level

#### Read Access (SELECT)

```sql
-- Employee: sees data in their workspace
CREATE POLICY "employee_read" ON session_task
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profile
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Employee: sees only own training data
CREATE POLICY "employee_own_training" ON protocol_assignment
  FOR SELECT
  USING (
    profile_id IN (
      SELECT profile_id FROM profile
      WHERE user_id = auth.uid()
    )
  );

-- Manager: sees department data
CREATE POLICY "manager_department_read" ON session_task
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT p.workspace_id FROM profile p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('manager', 'admin', 'owner')
    )
  );
```

#### Write Access (INSERT, UPDATE, DELETE)

```sql
-- Only managers+ can create ad-hoc tasks
CREATE POLICY "manager_create_task" ON session_task
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM profile
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin', 'owner')
    )
  );

-- Employees can only update tasks assigned to them
CREATE POLICY "employee_update_own_task" ON session_task
  FOR UPDATE
  USING (
    claimed_by IN (
      SELECT profile_id FROM profile
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Can only update status and completion fields, not reassign
    claimed_by = (session_task).claimed_by
  );
```

### 3.3 RLS Patterns Per Module

| Module | Key RLS patterns |
|--------|-----------------|
| **Core (Profiles)** | Users see only workspaces they belong to. Profile data visible within workspace. |
| **Module 1 (Onboarding)** | Trainee sees own journey. Manager sees department trainees. Admin sees all. |
| **Module 2 (Org Structure)** | All workspace members can read structure. Only admin+ can modify. |
| **Module 3 (Scheduling)** | Published shifts visible to all. Unpublished only to manager+. |
| **Module 4 (Operations)** | Tasks visible based on assignment. Session data visible to department members. Manager sees department. Admin sees all. |
| **Module 5 (HACCP)** | HACCP data readable by all in department. CCP configuration admin-only. |
| **Module 6 (Training)** | Own assignments visible. Manager sees department readiness. Admin sees all. |
| **Module 9 (Chat)** | Messages visible only to channel members. Channel membership derived from org structure or explicit. |
| **Payroll** | Own salary visible. Manager sees department (if permitted via Policy). Admin sees all. |

### 3.4 RLS Helper Functions

To keep policies clean and performant, create reusable database functions:

```sql
-- Get current user's profile IDs across workspaces
CREATE FUNCTION auth.user_profile_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT array_agg(profile_id)
  FROM profile
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Get current user's workspace IDs
CREATE FUNCTION auth.user_workspace_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT array_agg(workspace_id)
  FROM profile
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Check if user has role in workspace
CREATE FUNCTION auth.has_role(ws_id uuid, min_role text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid()
    AND workspace_id = ws_id
    AND is_active = true
    AND role IN (
      CASE min_role
        WHEN 'employee' THEN ARRAY['employee','manager','admin','owner']
        WHEN 'manager' THEN ARRAY['manager','admin','owner']
        WHEN 'admin' THEN ARRAY['admin','owner']
        WHEN 'owner' THEN ARRAY['owner']
      END
    )
  );
$$;

-- Check if user is in department
CREATE FUNCTION auth.in_department(dept_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid()
    AND is_active = true
    AND (department_id = dept_id OR dept_id = ANY(departments))
  );
$$;
```

### 3.5 RLS Performance Considerations

- **Cache `auth.user_workspace_ids()`** — this is called on every query. Mark as `STABLE` to allow PostgreSQL to cache within a transaction.
- **Index on `(workspace_id)`** on every table — fundamental for RLS performance
- **Composite indexes** for common query patterns: `(workspace_id, status)`, `(workspace_id, department_id)`, `(workspace_id, profile_id)`
- **Avoid complex joins in RLS policies** — use pre-computed helper functions instead
- **Test RLS with `EXPLAIN ANALYZE`** to ensure policies don't cause sequential scans

---

## 4. Cross-Workspace Scenarios

### 4.1 Multi-Location Company

A Company with multiple Workspaces (restaurant chain):

```
Company: "RestaurantKjeden AS"
  ├── Workspace: "Sentrum" (workspace_id: ws-1)
  ├── Workspace: "Vest" (workspace_id: ws-2)
  └── Workspace: "Øst" (workspace_id: ws-3)

User: Ole (Regional Manager)
  ├── Profile in ws-1 (role: admin)
  ├── Profile in ws-2 (role: admin)
  └── Profile in ws-3 (role: admin)
```

Ole can switch between workspaces. Each workspace loads independently. Cross-workspace reporting (e.g., "show me all deviations across all locations") is handled by querying multiple workspaces sequentially, not via cross-workspace joins.

### 4.2 Shared Employee

An employee can work at multiple locations:

```
User: Anna
  ├── Profile in ws-1 (role: employee, department: Kitchen)
  └── Profile in ws-2 (role: employee, department: Service)
```

Anna has separate training, schedules, and tasks per workspace. Her readiness score is calculated independently per workspace.

### 4.3 Smartout Super-Admin

For Smartout's internal team to manage the platform:

```sql
-- Super-admin flag on user (NOT on profile)
ALTER TABLE "user" ADD COLUMN is_super_admin boolean DEFAULT false;

-- Super-admin RLS bypass
CREATE POLICY "super_admin_access" ON [table_name]
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "user"
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );
```

Super-admins can access any workspace for support and debugging. Logged and auditable.

---

## 5. Performance & Scaling

### 5.1 Indexing Strategy

**Every table gets:**
```sql
CREATE INDEX idx_{table}_workspace ON {table} (workspace_id);
```

**High-traffic tables get composite indexes:**

```sql
-- session_task: most queried table
CREATE INDEX idx_session_task_session_status ON session_task (session_id, status);
CREATE INDEX idx_session_task_workspace_category ON session_task (workspace_id, category);
CREATE INDEX idx_session_task_assigned ON session_task (assigned_to_ref, status) WHERE assigned_to_type = 'profile';
CREATE INDEX idx_session_task_completed ON session_task (completed_by, completed_at);

-- department_session: daily operational queries
CREATE INDEX idx_dept_session_date ON department_session (workspace_id, date, department_id);
CREATE INDEX idx_dept_session_status ON department_session (workspace_id, status);

-- shift: scheduling queries
CREATE INDEX idx_shift_date ON shift (workspace_id, start_time);
CREATE INDEX idx_shift_profile ON shift (profile_id, start_time);
CREATE INDEX idx_shift_published ON shift (workspace_id, is_published, start_time);

-- chat_message: real-time chat
CREATE INDEX idx_chat_message_channel ON chat_message (channel_id, created_at);

-- notification: delivery queue
CREATE INDEX idx_notification_unread ON notification (profile_id, read_at) WHERE read_at IS NULL;

-- protocol_assignment: training dashboard
CREATE INDEX idx_protocol_assignment_profile ON protocol_assignment (profile_id, status);
CREATE INDEX idx_protocol_assignment_workspace ON protocol_assignment (workspace_id, status);
```

### 5.2 Data Volume Estimates

For a typical restaurant (20 employees, 1 department session/day):

| Table | Daily rows | Monthly rows | Yearly rows |
|-------|-----------|-------------|-------------|
| session_task | 30–50 | 900–1,500 | ~12,000 |
| chat_message | 50–200 | 1,500–6,000 | ~40,000 |
| notification | 100–300 | 3,000–9,000 | ~50,000 |
| shift | 10–20 | 300–600 | ~5,000 |
| department_session | 1–3 | 30–90 | ~500 |

For 100 workspaces: multiply by 100. Still manageable for PostgreSQL on Supabase Pro.

For 1,000+ workspaces: consider table partitioning on `workspace_id` or `created_at` for session_task, chat_message, and notification.

### 5.3 Caching Strategy

| Data | Cache type | TTL | Invalidation |
|------|-----------|-----|-------------|
| Workspace settings | In-memory (Next.js) | 5 min | On settings change |
| Department/Team/Location structure | In-memory | 5 min | On org structure change |
| Profile list (who works here) | In-memory | 1 min | On profile change |
| Shift schedule (current week) | In-memory | 30 sec | On shift publish/change |
| Session task board | Supabase Realtime | Real-time | Subscription |
| Chat messages | Supabase Realtime | Real-time | Subscription |
| Notification count | In-memory + Realtime | Hybrid | New notification triggers Realtime |
| Readiness scores | Computed + cached | 5 min | On protocol_assignment update |

### 5.4 Supabase Realtime Scaling

Real-time subscriptions (chat, task updates, notifications) are bounded by:
- **Per-workspace connections:** ~20 (one per online employee)
- **Channels per connection:** ~5 (session channel, department channel, DMs, notifications)
- **Messages per channel:** ~1/minute average, bursts during service

Supabase Pro handles this for hundreds of workspaces. At 1,000+ workspaces with 50+ concurrent users each, consider Supabase Enterprise or connection pooling.

### 5.5 Edge Function Performance

| Function | Trigger | Expected latency | Scaling note |
|----------|---------|------------------|-------------|
| Session auto-generation | Nightly cron | 1–5 sec per workspace | Batch all workspaces, parallelize |
| Hook evaluation | Every 5 min | 100–500ms per session | Only active sessions |
| Task inheritance | On no-show | 200–500ms | Per-session, rare event |
| Day Brief generation | 30 min before first shift | 1–3 sec (AI call) | Per department, sequential OK |
| Notification delivery | On event | 50–200ms | Queue + batch for SMS/email |
| Recurring task generation | Nightly cron | 500ms–2 sec per workspace | Batch |
| Certificate expiry check | Nightly cron | 100–500ms per workspace | Batch |

---

## 6. Subscription & Billing

### 6.1 Stripe Integration

Smartout uses Stripe for subscription management:

```
stripe_subscription (Smartout-side tracking)
  subscription_id      uuid (PK)
  company_id           fk → company
  stripe_customer_id   string (Stripe customer ID)
  stripe_subscription_id string (Stripe subscription ID)
  
  -- Plan
  plan                 trial | starter | professional | enterprise
  status               trialing | active | past_due | canceled | paused
  
  -- Limits
  max_workspaces       integer
  max_profiles_per_workspace integer
  active_modules       string[] (which modules are included in plan)
  
  -- Billing
  current_period_start timestamp
  current_period_end   timestamp
  trial_ends_at        timestamp | null
  
  -- Usage
  current_profile_count integer (updated on profile create/deactivate)
  
  created_at           timestamp
  updated_at           timestamp
```

### 6.2 Plan Tiers

| Feature | Trial | Starter | Professional | Enterprise |
|---------|-------|---------|-------------|------------|
| Duration | 14 days | — | — | — |
| Max profiles/workspace | 10 | 20 | 50 | Unlimited |
| Workspaces | 1 | 1 | 3 | Unlimited |
| Core modules | ✅ | ✅ | ✅ | ✅ |
| HACCP module | ✅ | ✅ | ✅ | ✅ |
| AI features | Basic | Basic | Full | Full + custom |
| Voice AI (Mr. Botsson) | Demo | — | ✅ | ✅ |
| SMS notifications | 50/month | 100/month | 500/month | Unlimited |
| API access | — | — | — | ✅ |
| Price | Free | Per employee/month | Per employee/month | Custom |

*Plan details are directional — final pricing TBD.*

### 6.3 Profile Count Enforcement

Trainee profiles count toward the plan limit. The system checks on:
- Invite acceptance → before creating profile, check `current_profile_count < max_profiles_per_workspace`
- If at limit → show upgrade prompt: "Du har nådd grensen for ansatte på din plan. Oppgrader for å legge til flere."

### 6.4 Billing Events

| Event | Stripe action | Smartout action |
|-------|--------------|----------------|
| Workspace created | — | Check workspace limit against plan |
| Profile created | — | Increment `current_profile_count`, check limit |
| Profile deactivated | — | Decrement count |
| Plan upgrade | Stripe subscription update | Update plan limits, unlock modules |
| Plan downgrade | Stripe subscription update | Warn if over new limits, grace period |
| Payment failed | Stripe webhook: `invoice.payment_failed` | Email admin, 7-day grace, then pause |
| Subscription canceled | Stripe webhook: `customer.subscription.deleted` | 30-day data retention, then archive |
| Trial ending | Stripe webhook | Email admin 3 days before: "Din prøveperiode utløper snart" |

### 6.5 Stripe Webhook Handler

An Edge Function handles Stripe webhooks:

```
POST /functions/v1/stripe-webhook
  → Verify Stripe signature
  → Route by event type:
      invoice.payment_failed → update subscription status, notify admin
      customer.subscription.updated → update plan, limits, modules
      customer.subscription.deleted → start cancellation flow
      invoice.paid → update status to active
  → Acknowledge webhook
```

---

## 7. Data Retention & Archival

### 7.1 Active Data

All operational data stays in the primary database while the subscription is active.

### 7.2 Archival Strategy

| Data type | Archive after | Storage |
|-----------|-------------|---------|
| Session tasks (completed) | 12 months | Move to archive table or cold storage |
| Chat messages | 12 months | Archive to cold storage, keep searchable |
| Notifications (read) | 3 months | Delete |
| AI event logs | 6 months | Archive |
| Temperature/HACCP logs | 24 months (regulatory) | Keep in primary DB (compliance requirement) |
| Session sign-offs | 24 months | Keep in primary DB |

### 7.3 On Subscription Cancellation

1. **Immediate:** Workspace becomes read-only. No new data can be created.
2. **30 days:** Admin notified: "Your data will be archived. Export now if needed."
3. **60 days:** Data archived to cold storage. Workspace inaccessible.
4. **12 months:** Data deleted per GDPR (unless regulatory requirement dictates longer retention).

GDPR data export available at any time via Edge Function (see Module 14).

---

## 8. Integration Points

| Module | Multi-tenancy consideration |
|--------|---------------------------|
| **All modules** | Every query must include `workspace_id` filter. RLS enforces this even if application code forgets. |
| **Module 1 (Onboarding)** | Invite links are workspace-scoped. Profile creation checks plan limits. |
| **Module 4 (Operations)** | Session auto-generation runs per workspace. High-volume tables need indexing. |
| **Module 9 (Communication)** | Chat channels scoped to workspace. Push tokens linked to Profile (workspace-aware). |
| **Module 12 (AI)** | AI context includes workspace settings. AI never leaks data across workspaces. |
| **Module 14 (Compliance)** | GDPR export per workspace. Data retention rules per regulatory requirement. |

---

## 9. Implementation Sequence

| Phase | Scope | Duration |
|-------|-------|----------|
| **1. RLS foundation** | RLS helper functions. Base workspace isolation policy on all tables. Test with multiple workspaces. | Week 1–2 |
| **2. Role-based RLS** | Per-module RLS policies (employee vs. manager vs. admin access levels). | Week 3–4 |
| **3. Indexing** | Composite indexes on high-traffic tables. EXPLAIN ANALYZE on common queries. | Week 5–6 |
| **4. Stripe integration** | Subscription creation, plan management, webhook handler, profile count enforcement. | Week 7–9 |
| **5. Multi-workspace** | Workspace switcher UI. Cross-workspace profile management. Company-level admin view. | Week 10–11 |
| **6. Super-Admin** | Smartout internal admin panel. Cross-workspace access. Audit logging. | Week 12 |
| **7. Performance tuning** | Caching layer. Realtime connection optimization. Query profiling. | Week 13–14 |
| **8. Archival** | Data retention policies. Archive jobs. GDPR export function. | Week 15–16 |

---

## 10. Migration Notes

Specific considerations for migration from Bubble to Next.js/Supabase:

- **RLS before any data:** Enable RLS on every table before inserting production data. Test with Supabase's "Impersonate User" feature.
- **workspace_id as non-nullable:** Every table (except user, company, company_member) must have `workspace_id NOT NULL`. Add as part of schema migration.
- **RLS performance testing:** Supabase's RLS can be slow if policies involve subqueries on unindexed tables. Test every policy with EXPLAIN ANALYZE on realistic data volumes.
- **Stripe webhook reliability:** Use Stripe's webhook retry mechanism. Make the handler idempotent (check if event already processed).
- **Profile count:** Maintain `current_profile_count` on `stripe_subscription` via database trigger on profile INSERT/UPDATE (status change). Don't compute on-the-fly for billing checks.
- **Supabase project structure:** One Supabase project per environment (dev, staging, prod). NOT one project per workspace — that doesn't scale.
- **Connection pooling:** Supabase uses PgBouncer. For Edge Functions, use `supabase.from()` which handles pooling. For direct connections (n8n), use connection pooling mode.
- **Row-level encryption:** NOT needed for multi-tenancy — RLS is sufficient. Consider encryption for PII fields (email, phone, emergency contacts) if required by GDPR assessment.
- **Backup:** Supabase handles daily backups. For enterprise customers, consider point-in-time recovery (PITR) which Supabase Pro supports.

---

*Multi-tenancy in Smartout is not a feature — it's a structural guarantee. Every table has `workspace_id`, every query runs through RLS, and every workspace is provably isolated at the database level. The subscription model scales from a single restaurant trial to an enterprise chain with hundreds of locations, all on the same infrastructure.*
