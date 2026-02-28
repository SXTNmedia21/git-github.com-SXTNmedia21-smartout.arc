# Platform Admin — Functional, Clickable, Insightful

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the platform admin from read-only dashboards into a fully functional command center with workspace interactions, bulk messaging, targeted email, actionable tables, and insightful charts.

**Scope:** Focus on making existing pages interactive and adding workspace communication capabilities. NOT rebuilding from scratch — building ON TOP of what exists.

**Key user ask:** "I want to send messages to all users, email specific groups (all admins, all workspace owners, etc.), and actually interact with workspaces from the backoffice."

---

## Current State

| Page                              | Data                          | Interactive? | Notes                                 |
| --------------------------------- | ----------------------------- | ------------ | ------------------------------------- |
| `/platform-admin/dashboard`       | Real (5 parallel queries)     | Read-only    | 5 KPI cards + recent workspaces table |
| `/platform-admin/workspaces`      | Real (server fetch)           | Read-only    | Delegates to WorkspaceListClient      |
| `/platform-admin/workspaces/[id]` | Real (4 parallel queries)     | Read-only    | 4 stat cards + company info           |
| `/platform-admin/billing`         | Real (all companies)          | Read-only    | 3 KPI cards + subscription table      |
| `/platform-admin/content`         | Real (landing_config)         | Read-only    | Config table, no edit UI              |
| `/platform-admin/contracts`       | Real (contract instances)     | Read-only    | Contract table                        |
| `/platform-admin/health`          | Real (platform_metrics_daily) | Read-only    | 9 KPI cards, conditional              |
| `/platform-admin/users`           | Real (user_identity)          | Read-only    | User table, max 100                   |
| `/platform-admin/audit`           | Real (platform_audit_log)     | Read-only    | Delegates to AuditListClient          |

**Infrastructure that exists:**

- DB: 5 platform-admin tables (migration 00013) + `is_super_admin` flag
- Middleware: Super-admin check on `/platform-admin/*` routes
- Admin client: `createAdminClient()` in `@smartout/supabase`
- Helpers: `getSuperAdminId()`, `logPlatformAction()` in `apps/web/src/lib/platform-admin.ts`
- API: Only landing config CRUD routes (3 files)
- DocuSeal webhook: Contract status sync implemented
- SendGrid: Env var validated (`SG.` prefix), `@sendgrid/mail` installed in `packages/notifications` — but **zero implementation code**

**What's missing:**

- No action buttons, modals, or forms on any page
- No charts (Recharts is ADR-approved but not used)
- No email sending capability (notifications package is a stub)
- No workspace interaction features
- No bulk operations
- No TanStack Table (ADR-0018 approved, not used on most pages)

---

## Key Files

| File              | Path                                                       | Role                               |
| ----------------- | ---------------------------------------------------------- | ---------------------------------- |
| Layout            | `apps/web/src/app/platform-admin/layout.tsx`               | Dark theme wrapper + sidebar       |
| Dashboard         | `apps/web/src/app/platform-admin/dashboard/page.tsx`       | KPI overview                       |
| Workspaces list   | `apps/web/src/app/platform-admin/workspaces/page.tsx`      | Server fetch → client              |
| Workspace detail  | `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx` | Workspace deep view                |
| Billing           | `apps/web/src/app/platform-admin/billing/page.tsx`         | Subscription overview              |
| Users             | `apps/web/src/app/platform-admin/users/page.tsx`           | Global user list                   |
| Health            | `apps/web/src/app/platform-admin/health/page.tsx`          | Platform metrics                   |
| Content           | `apps/web/src/app/platform-admin/content/page.tsx`         | Landing config CMS                 |
| Contracts         | `apps/web/src/app/platform-admin/contracts/page.tsx`       | Contract management                |
| Audit             | `apps/web/src/app/platform-admin/audit/page.tsx`           | Audit log viewer                   |
| Admin helpers     | `apps/web/src/lib/platform-admin.ts`                       | getSuperAdminId, logPlatformAction |
| Notifications pkg | `packages/notifications/src/index.ts`                      | STUB — needs implementation        |
| Env validation    | `apps/web/src/env.ts`                                      | SendGrid key validated             |
| Config API        | `apps/web/src/app/api/platform-admin/content/configs/`     | Landing config CRUD                |
| DocuSeal webhook  | `apps/web/src/app/api/webhooks/docuseal/route.ts`          | Contract status sync               |

---

## Architecture Decisions

**ADR-0018 (Accepted):** TanStack Table + Recharts for Platform Admin

- Use `@tanstack/react-table` for all data tables (sort, filter, pagination, row selection)
- Use `recharts` for charts (MRR trend, subscription breakdown, activity)

**New decisions needed:**

- **ADR-0021:** Email/Notification Service Architecture — SendGrid adapter in `@smartout/notifications`, template system, audience targeting

---

## Implementation Plan

### Phase 1: Email & Notification Foundation

> Build the missing email infrastructure that all interaction features depend on.

#### Task 1.1: Implement `@smartout/notifications` package

**File:** `packages/notifications/src/index.ts` (replace stub)

Create a SendGrid email service with:

```typescript
// packages/notifications/src/sendgrid.ts
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string; // default: noreply@smartout.io
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }>;

// packages/notifications/src/templates.ts
export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>,
): { subject: string; html: string };

// packages/notifications/src/audiences.ts
export type AudienceFilter = {
  scope: "all_users" | "workspace" | "role" | "status" | "super_admins";
  workspaceId?: string;
  role?: "owner" | "admin" | "manager" | "employee";
  status?: "active" | "trainee" | "inactive" | "offboarding";
};

export async function resolveAudience(
  adminClient: SupabaseClient,
  filter: AudienceFilter,
): Promise<Array<{ email: string; name: string; userId: string; workspaceId?: string }>>;
```

**Templates to create:**

- `platform-announcement` — Generic message from Smartout to users
- `workspace-notification` — Targeted message to a workspace
- `trial-reminder` — Trial expiring soon
- `payment-reminder` — Payment failed/past due
- `contract-reminder` — Contract pending signature

**Package exports:**

```json
{
  ".": "./src/index.ts",
  "./templates": "./src/templates.ts",
  "./audiences": "./src/audiences.ts"
}
```

**Env:** Uses existing `SENDGRID_API_KEY` (already validated in `apps/web/src/env.ts`).

#### Task 1.2: Write ADR-0021 for notification architecture

Document the decision to use SendGrid via `@smartout/notifications`, template rendering approach, audience resolution pattern, and audit logging for all sent emails.

---

### Phase 2: Workspace Interactions (The Core Ask)

> Make workspace pages interactive with messaging, email, and action capabilities.

#### Task 2.1: Workspace Communication API routes

**New files:**

```
apps/web/src/app/api/platform-admin/communications/
├── send-email/route.ts        — POST: Send targeted email
├── send-bulk-email/route.ts   — POST: Send to audience filter
└── history/route.ts           — GET: Email send history
```

**`POST /api/platform-admin/communications/send-email`**

```typescript
// Body:
{
  recipients: string[];         // user_ids OR email addresses
  subject: string;
  message: string;              // Markdown body → rendered to HTML
  template: 'platform-announcement' | 'workspace-notification';
  replyTo?: string;
}
// → Sends via @smartout/notifications
// → Logs to platform_audit_log (entity_type: 'communication')
// → Returns { sent: number, failed: number, errors: string[] }
```

**`POST /api/platform-admin/communications/send-bulk-email`**

```typescript
// Body:
{
  audience: AudienceFilter;     // { scope, workspaceId?, role?, status? }
  subject: string;
  message: string;
  template: string;
  dryRun?: boolean;             // If true, returns recipient count without sending
}
// → Resolves audience → sends to all matching users
// → Logs to platform_audit_log with recipient count
// → Returns { audienceSize: number, sent: number, failed: number }
```

#### Task 2.2: Communication database table

**New migration:** `YYYYMMDDHHMMSS_platform_communications.sql`

```sql
CREATE TABLE platform_communication_log (
  communication_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id    uuid NOT NULL REFERENCES user_identity(user_id),
  subject           text NOT NULL,
  message_body      text NOT NULL,
  template          text NOT NULL,
  audience_filter   jsonb,                    -- The filter used (for bulk)
  recipient_count   integer NOT NULL DEFAULT 0,
  sent_count        integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'sent',  -- 'sent', 'partial', 'failed'
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_comm_admin ON platform_communication_log (super_admin_id, created_at DESC);
CREATE INDEX idx_comm_time ON platform_communication_log (created_at DESC);
```

No RLS — service role only (same pattern as other platform-admin tables).

#### Task 2.3: Workspace detail page — Add interaction tabs

**File:** `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx`

Transform from a flat info page into a tabbed interface:

**Tab: Overview** (existing content, improved)

- Company info card
- Quick stats (profiles, departments, locations)
- Subscription status badge with plan info
- Last activity timestamp

**Tab: People** (NEW)

- Table of all profiles in this workspace (name, email, role, status, last login)
- Row actions: View profile, Send email
- Bulk select → Send email to selected
- Filter by role (owner/admin/manager/employee) and status

**Tab: Communication** (NEW — the key feature)

- **"Send Message" button** → opens modal/sheet:
  - Audience selector:
    - "All users in this workspace"
    - "All admins in this workspace"
    - "All managers and above"
    - "Only owners"
    - Custom selection (checkbox from people list)
  - Subject field
  - Message body (textarea with markdown support)
  - Preview button (renders the email template)
  - "Dry run" toggle (shows recipient count without sending)
  - Send button (with confirmation dialog)
- Communication history table (previous messages sent to this workspace)

**Tab: Subscription** (NEW)

- Current plan info
- Trial status with days remaining
- Quick actions (placeholders for now — Stripe integration later):
  - Extend Trial (disabled, tooltip: "Stripe integration coming")
  - Change Plan (disabled)
  - Pause/Cancel (disabled)

**Tab: Notes** (NEW)

- Internal notes visible only to super-admins
- Add note form (textarea + save)
- Note history with timestamps and author

**UI Components needed:**

- `Tabs` from shadcn/ui (install if not already)
- `Sheet` or `Dialog` for send message flow
- `Textarea` for message composition
- `Select` for audience targeting
- `Checkbox` for bulk selection in people table

#### Task 2.4: Workspace list page — Add bulk actions

**File:** `apps/web/src/app/platform-admin/workspaces/page.tsx` + client component

Upgrade the workspace list with:

- TanStack Table with sorting, filtering, pagination
- Row selection (checkboxes)
- Bulk action toolbar (appears when rows selected):
  - "Email Selected" → opens bulk email sheet
  - "Export CSV" → downloads selected workspaces as CSV
- Filter bar:
  - Plan: All / Trial / Starter / Professional / Enterprise
  - Status: All / Active / Past Due / Paused / Cancelled
  - Activity: Active (7d) / Dormant (30d) / Inactive (90d)
- Click row → navigate to workspace detail

---

### Phase 3: Dashboard — Make It Insightful

> Add charts, trends, and actionable alerts to the dashboard.

#### Task 3.1: Dashboard KPI cards with sparklines

**File:** `apps/web/src/app/platform-admin/dashboard/page.tsx`

Upgrade KPI cards with:

- Trend indicator (up/down arrow with percentage change)
- Mini sparkline chart (last 14 days from `platform_metrics_daily`)
- Color coding: green=good, red=needs attention

**Cards:**
| Card | Metric | Trend Source |
|------|--------|-------------|
| Workspaces | Total count | Daily delta from metrics |
| MRR | NOK amount | 14-day sparkline |
| Active Trials | Count + conversion rate | Trial → paid % |
| Active 24h | Workspaces with recent activity | % of total |
| At Risk | Past due + failed payments | Count (red if > 0) |

#### Task 3.2: Dashboard subscription chart

Add a Recharts `PieChart` or `BarChart` showing subscription distribution:

- Trial, Active, Paused, Past Due, Cancelled
- Color-coded matching the status colors already defined

#### Task 3.3: Dashboard quick actions panel

Add action buttons below the KPI row:

- "Send Platform Announcement" → opens global email modal
- "View Payment Failures" → link to billing page
- "Expiring Trials" → filtered workspace list
- "Pending Contracts" → link to contracts page

#### Task 3.4: Recent activity feed

Replace the basic "Recent Workspaces" table with a richer activity feed:

- New workspace created
- Subscription changed
- Contract signed
- Payment failed
- User signed up
- Pull from `platform_audit_log` (last 20 entries)

---

### Phase 4: Global Communication Hub

> A dedicated page for platform-wide communication management.

#### Task 4.1: New route `/platform-admin/communications`

**New files:**

```
apps/web/src/app/platform-admin/communications/
├── page.tsx                    — Communication hub
└── _components/
    ├── compose-email-sheet.tsx  — Reusable email composer
    ├── audience-selector.tsx    — Audience targeting UI
    └── communication-history.tsx — Sent message log
```

**Communication Hub page:**

**Top section: Quick Send**

- 4 preset buttons:
  - "All Users" — Every user on the platform
  - "All Workspace Owners" — Company owners only
  - "All Admins" — Admin role across all workspaces
  - "Custom Audience" — Opens advanced filter

**Compose Email Sheet (reusable component):**

- Audience selector (role filter, status filter, workspace filter, or "all")
- Subject line
- Message body (textarea, markdown)
- Template selector (announcement, notification, reminder)
- Dry run button → shows: "This will be sent to X recipients" with list preview
- Confirmation dialog before send: "Send to X recipients?"
- Send button → calls API → shows success/failure toast

**Communication History:**

- TanStack Table of all sent communications
- Columns: Date, Subject, Audience, Recipients, Sent/Failed, Admin
- Click row → expand to see full message and recipient details

#### Task 4.2: Add "Communications" to sidebar navigation

Update the platform admin sidebar/layout to include the new communications route.

---

### Phase 5: Users Page — Make Interactive

> Add actions to the user management page.

#### Task 5.1: Users page with TanStack Table

**File:** `apps/web/src/app/platform-admin/users/page.tsx`

Upgrade with:

- TanStack Table (sortable, filterable, paginated)
- Search bar (filter by name or email)
- Columns: Name, Email, Workspaces (count), Role badges, Super Admin badge, Last Login, Created
- Row actions dropdown:
  - Send Email (opens compose sheet pre-filled with this user)
  - View Workspaces (expand row to show profiles across workspaces)
  - Grant/Revoke Super Admin (confirmation dialog + audit)
  - Trigger Password Reset
- Bulk select → "Email Selected Users"

---

### Phase 6: Billing & Contracts — Add Actions

> Make billing and contracts pages clickable with real actions.

#### Task 6.1: Billing page with action buttons

**File:** `apps/web/src/app/platform-admin/billing/page.tsx`

- Add Recharts: MRR trend (line chart, last 30 days from `platform_metrics_daily`)
- Subscription table with TanStack Table (sort, filter)
- Row actions:
  - Send Payment Reminder (email)
  - View in Stripe (external link, placeholder)
- "Payment Failures" tab/filter
- Bulk: "Email All Past Due" button

#### Task 6.2: Contracts page with send flow

**File:** `apps/web/src/app/platform-admin/contracts/page.tsx`

- TanStack Table for contract instances
- Row actions:
  - View Details (expand/navigate)
  - Send Reminder (email to unsigned signatories)
  - Cancel Contract
- "Send New Contract" button (select template → select company → fill fields → send)
- Status badge colors (already defined in current code)

---

### Phase 7: shadcn/ui Components & Polish

> Install missing components and ensure consistent UI.

#### Task 7.1: Install required shadcn/ui components

From `apps/web/`:

```bash
npx shadcn@latest add tabs
npx shadcn@latest add textarea
npx shadcn@latest add checkbox
npx shadcn@latest add switch
npx shadcn@latest add alert-dialog
npx shadcn@latest add command
npx shadcn@latest add popover
npx shadcn@latest add data-table  # If shadcn provides this, otherwise manual
```

#### Task 7.2: Install Recharts

```bash
pnpm --filter web add recharts
```

(TanStack Table should already be available per ADR-0018 — verify.)

#### Task 7.3: Shared platform-admin components

**New directory:** `apps/web/src/app/platform-admin/_components/`

```
_components/
├── platform-admin-sidebar.tsx    — Sidebar nav (may already exist)
├── kpi-card.tsx                  — Reusable KPI card with sparkline
├── data-table.tsx                — TanStack Table wrapper for platform admin
├── compose-email-sheet.tsx       — Reusable email composition UI
├── audience-selector.tsx         — Audience targeting dropdown/filters
├── confirmation-dialog.tsx       — "Are you sure?" for destructive actions
├── status-badge.tsx              — Color-coded status badges
└── sparkline.tsx                 — Mini chart component (Recharts)
```

---

## Dependency Graph

```
Phase 1 (Email Foundation)
  ├── Task 1.1: @smartout/notifications package
  └── Task 1.2: ADR-0021
        │
Phase 7.1-7.3 (Components) ──── can run in parallel with Phase 1
        │
Phase 2 (Workspace Interactions) ──── depends on Phase 1 + 7
  ├── Task 2.1: Communication API routes
  ├── Task 2.2: Communication DB table
  ├── Task 2.3: Workspace detail tabs
  └── Task 2.4: Workspace list bulk actions
        │
Phase 3 (Dashboard) ──── depends on Phase 7 (Recharts)
  ├── Task 3.1: KPI sparklines
  ├── Task 3.2: Subscription chart
  ├── Task 3.3: Quick actions
  └── Task 3.4: Activity feed
        │
Phase 4 (Communication Hub) ──── depends on Phase 2
  ├── Task 4.1: Communications page
  └── Task 4.2: Sidebar update
        │
Phase 5 (Users) ──── depends on Phase 1 + 7
  └── Task 5.1: Interactive users table
        │
Phase 6 (Billing & Contracts) ──── depends on Phase 1 + 7
  ├── Task 6.1: Billing actions
  └── Task 6.2: Contracts send flow
```

**Parallelizable:** Phase 1 + Phase 7 can run simultaneously. After that, Phases 3/4/5/6 are largely independent.

---

## Build Sequence (Recommended)

| Order | Task    | Why                                                    |
| ----- | ------- | ------------------------------------------------------ |
| 1     | 7.1-7.3 | Install components + create shared pieces              |
| 2     | 1.1     | Email infrastructure (everything depends on this)      |
| 3     | 1.2     | Document the decision                                  |
| 4     | 2.2     | Communication log table (migration)                    |
| 5     | 2.1     | Communication API routes                               |
| 6     | 2.3     | Workspace detail — tabbed interface with communication |
| 7     | 2.4     | Workspace list — bulk actions                          |
| 8     | 4.1-4.2 | Communication hub page                                 |
| 9     | 3.1-3.4 | Dashboard improvements                                 |
| 10    | 5.1     | Users page interactive                                 |
| 11    | 6.1-6.2 | Billing + contracts actions                            |

---

## Out of Scope (Future)

- Stripe API integration for billing actions (plan changes, refunds)
- Impersonation feature
- A/B testing for landing configs
- Real-time activity feed (Supabase Realtime)
- GDPR data export triggering
- Automated dunning sequences
- SMS notifications (Twilio)

---

## Success Criteria

- [ ] Can send an email to all users on the platform from the dashboard
- [ ] Can send an email to all admins of a specific workspace
- [ ] Can send an email to all workspace owners across the platform
- [ ] Can select specific users and email them
- [ ] Can see communication history (what was sent, to whom, when)
- [ ] Workspace detail page has tabs: Overview, People, Communication, Subscription, Notes
- [ ] Dashboard has charts (subscription distribution, MRR trend)
- [ ] Dashboard has quick action buttons
- [ ] All data tables use TanStack Table with sort/filter/pagination
- [ ] All emails are audit-logged in `platform_audit_log`
- [ ] Dry run mode shows recipient count before sending
- [ ] Confirmation dialogs on all destructive/broadcast actions
