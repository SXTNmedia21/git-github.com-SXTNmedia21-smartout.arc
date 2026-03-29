---
title: "Module 17: Platform Administration (Super Admin Backoffice)"
id: MODULE_17
version: "1.0"
status: canonical
layer: module
created: 2026-02-24
updated: 2026-03-22
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - MODULE_13
tags:
  - platform-admin
  - super-admin
  - backoffice
  - stripe
  - landing-config
  - contracts
  - audit-log
  - cascade
tables:
  - landing_config
  - landing_config_version
  - platform_audit_log
  - platform_impersonation_log
  - platform_metrics_daily
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension              | Role                                                           |
| ---------------------- | -------------------------------------------------------------- |
| C4 Policy & Governance | Primary — platform-level policy enforcement and oversight      |
| All Dimensions         | Consumes — platform admin has visibility across all dimensions |

# Module 17: Platform Administration (Super Admin Backoffice)

> **Smartout.ai** — Functional documentation for platform-level administration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2 (User, Company, Workspace), Module 13 (Multi-Tenant, Stripe), Landing Page Config System
> **Audience:** Smartout internal team only — this is NOT workspace-level admin

---

## 1. Module Overview

Smartout needs an internal backoffice where the platform team (Pontus + future team) can manage all workspaces, monitor platform health, manage Stripe subscriptions, control landing page content, and handle contracts. This is a completely separate experience from workspace admin — it operates cross-workspace with `is_godmode` access.

### What This Module Covers

- Workspace overview and activity monitoring
- Stripe subscription and billing management
- Landing page content management (LandingConfig CMS)
- Contract and agreement management (DocuSeal integration)
- Platform health metrics and onboarding funnel
- Super-admin user management and audit logging

### What This Module Does NOT Cover

- Workspace-internal operations (Module 4)
- Per-workspace settings or governance (Modules handled by workspace admin)
- AI engine administration (Module 12 — separate concern)
- GDPR data processing requests (Module 14 — triggered from here but executed there)

### Key Principle

> **The Super Admin Backoffice is Smartout's internal command center.** It answers: "How is the platform doing? Who needs help? Who's paying? What's converting?"

---

## 2. Access & Security

### 2.1 Super-Admin Flag

As defined in Module 13:

```sql
-- On the user_identity table (NOT profile — this is cross-workspace)
ALTER TABLE "user_identity" ADD COLUMN is_godmode boolean DEFAULT false;
```

Super-admin is **not** a workspace role. It's a platform-level flag on the `user` table. A super-admin can also be a regular workspace user with normal roles — the two are orthogonal.

### 2.2 Route Protection

```
/platform-admin/*          — All backoffice routes
/platform-admin            — Dashboard (redirect to /platform-admin/dashboard)
/platform-admin/workspaces — Workspace management
/platform-admin/billing    — Stripe & revenue
/platform-admin/content    — Landing page CMS
/platform-admin/contracts  — Contract management
/platform-admin/health     — Platform metrics
/platform-admin/users      — User management
/platform-admin/audit      — Audit log
```

**Middleware guard:**

```typescript
// middleware.ts — platform-admin route guard
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/platform-admin")) {
    const session = await getSession(req);
    if (!session?.user) return redirect("/login");

    const { data: user } = await supabaseAdmin
      .from("user_identity")
      .select("is_godmode")
      .eq("user_id", session.user.id)
      .single();

    if (!user?.is_godmode) return redirect("/dashboard");
  }
}
```

### 2.3 RLS Bypass

Super-admin queries use the **Supabase service role** client, not the user's RLS-scoped client. This is critical — RLS policies restrict to workspace scope, but super-admin needs cross-workspace access.

```typescript
// Only used in /platform-admin/* server components and API routes
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose to client
);
```

### 2.4 Audit Logging

Every super-admin action is logged:

```sql
CREATE TABLE platform_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id    uuid NOT NULL REFERENCES "user"(user_id),
  action            text NOT NULL,
  entity_type       text NOT NULL,       -- 'workspace', 'subscription', 'contract', 'user', 'config'
  entity_id         uuid,
  details           jsonb DEFAULT '{}',  -- Action-specific payload
  ip_address        inet,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_admin ON platform_audit_log (super_admin_id, created_at DESC);
CREATE INDEX idx_audit_entity ON platform_audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_time ON platform_audit_log (created_at DESC);
```

**No RLS on this table** — only accessible via service role in platform-admin routes.

### 2.5 Impersonation

Super-admins can "impersonate" a workspace user for debugging:

```sql
CREATE TABLE platform_impersonation_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id    uuid NOT NULL REFERENCES "user"(user_id),
  target_user_id    uuid NOT NULL REFERENCES "user"(user_id),
  target_workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  reason            text NOT NULL,       -- Required justification
  started_at        timestamptz DEFAULT now(),
  ended_at          timestamptz,
  actions_taken     jsonb DEFAULT '[]'   -- Log of actions during impersonation
);
```

Impersonation creates a temporary session with the target user's permissions. A visible banner shows "IMPERSONATING: [user name] — [reason]" and all actions are logged.

---

## 3. Data Model — Platform-Specific Tables

These tables exist outside workspace scope (no `workspace_id`):

### 3.1 Landing Page Configurations

```sql
CREATE TABLE landing_config (
  config_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,          -- 'platform', 'fabrikken', 'sikkerhet'
  name              text NOT NULL,                  -- Display name
  locale            text NOT NULL DEFAULT 'no',     -- 'no', 'en', 'sv', 'da', 'fi'
  status            text NOT NULL DEFAULT 'draft',  -- 'draft', 'published', 'archived'
  config_json       jsonb NOT NULL,                 -- Full LandingConfig object
  published_json    jsonb,                          -- Snapshot of last published version
  version           integer NOT NULL DEFAULT 1,

  -- Metadata
  created_by        uuid REFERENCES "user"(user_id),
  updated_by        uuid REFERENCES "user"(user_id),
  published_at      timestamptz,
  published_by      uuid REFERENCES "user"(user_id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE landing_config_version (
  version_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         uuid NOT NULL REFERENCES landing_config(config_id),
  version           integer NOT NULL,
  config_json       jsonb NOT NULL,
  change_notes      text,
  created_by        uuid REFERENCES "user"(user_id),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_config_slug ON landing_config (slug);
CREATE INDEX idx_config_status ON landing_config (status);
CREATE INDEX idx_config_version ON landing_config_version (config_id, version DESC);
```

**How it works:**

- `config_json` = current working draft (editable in CMS)
- `published_json` = the live version serving traffic
- On "Publish" → `published_json = config_json`, increment version, snapshot to `landing_config_version`
- Landing page reads from `published_json` only
- Rollback = copy a previous version's `config_json` back to `config_json`

### 3.2 Contract Templates & Instances

```sql
CREATE TABLE contract_template (
  template_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,                  -- 'Standard SaaS Agreement', 'Enterprise Custom'
  description       text,
  docuseal_template_id text,                        -- DocuSeal template reference
  template_type     text NOT NULL,                  -- 'saas_agreement', 'dpa', 'sla', 'custom'
  locale            text NOT NULL DEFAULT 'no',
  status            text NOT NULL DEFAULT 'active', -- 'draft', 'active', 'archived'

  -- Configurable fields that get filled per workspace
  variable_fields   jsonb NOT NULL DEFAULT '[]',    -- [{name, label, type, required}]

  created_by        uuid REFERENCES "user"(user_id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE contract_instance (
  contract_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid REFERENCES contract_template(template_id),
  company_id        uuid NOT NULL REFERENCES company(company_id),
  workspace_id      uuid REFERENCES workspace(workspace_id),  -- Nullable: can be company-level

  -- Contract details
  title             text NOT NULL,
  status            text NOT NULL DEFAULT 'draft',  -- 'draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'
  docuseal_submission_id text,                      -- DocuSeal submission reference

  -- Filled variable values
  field_values      jsonb DEFAULT '{}',

  -- Signatories
  signatories       jsonb NOT NULL DEFAULT '[]',    -- [{name, email, role, signed_at}]

  -- Dates
  sent_at           timestamptz,
  signed_at         timestamptz,
  expires_at        timestamptz,

  -- Document storage
  document_url      text,                           -- Signed PDF in Supabase Storage

  created_by        uuid REFERENCES "user"(user_id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_contract_company ON contract_instance (company_id);
CREATE INDEX idx_contract_workspace ON contract_instance (workspace_id);
CREATE INDEX idx_contract_status ON contract_instance (status);
CREATE INDEX idx_contract_template ON contract_instance (template_id);
```

### 3.3 Platform Metrics (Materialized)

```sql
-- Daily snapshot for fast dashboard queries
CREATE TABLE platform_metrics_daily (
  date              date PRIMARY KEY,
  total_users       integer NOT NULL DEFAULT 0,
  total_companies   integer NOT NULL DEFAULT 0,
  total_workspaces  integer NOT NULL DEFAULT 0,
  total_profiles    integer NOT NULL DEFAULT 0,

  -- Signups
  new_users_today   integer NOT NULL DEFAULT 0,
  new_workspaces_today integer NOT NULL DEFAULT 0,

  -- Subscription status breakdown
  subscriptions_trial    integer NOT NULL DEFAULT 0,
  subscriptions_active   integer NOT NULL DEFAULT 0,
  subscriptions_paused   integer NOT NULL DEFAULT 0,
  subscriptions_past_due integer NOT NULL DEFAULT 0,
  subscriptions_cancelled integer NOT NULL DEFAULT 0,

  -- Revenue
  mrr_nok           decimal(12,2) NOT NULL DEFAULT 0,  -- Monthly Recurring Revenue in NOK

  -- Activity (last 24h)
  active_workspaces_24h integer NOT NULL DEFAULT 0,    -- At least 1 login
  sessions_created_24h  integer NOT NULL DEFAULT 0,    -- Department sessions
  tasks_completed_24h   integer NOT NULL DEFAULT 0,

  -- Funnel
  signups_to_workspace  decimal(5,2),  -- % of signups that create workspace
  workspace_to_invite   decimal(5,2),  -- % of workspaces that send first invite
  invite_to_session     decimal(5,2),  -- % of workspaces that create first session

  computed_at       timestamptz DEFAULT now()
);
```

**Populated by:** Supabase Edge Function or n8n workflow running daily at 02:00 UTC.

---

## 4. Screen Specifications

### 4.1 Dashboard (`/platform-admin/dashboard`)

The landing page after login. Quick pulse on platform health.

**Layout:** Grid of KPI cards + activity feed + alerts

**KPI Cards (top row):**

| Card             | Data                         | Visual                   |
| ---------------- | ---------------------------- | ------------------------ |
| Total Workspaces | Count + trend (vs last week) | Number + sparkline       |
| MRR              | Sum of active subscriptions  | NOK amount + change %    |
| Trial → Paid     | Conversion rate              | Percentage + funnel mini |
| Active Today     | Workspaces with login in 24h | Number + % of total      |
| At Risk          | Past-due + failed payments   | Number (red if > 0)      |
| New Signups      | This week vs. last week      | Number + comparison      |

**Activity Feed (below cards):**

- Real-time stream of platform events:
  - "🆕 **Café Nordlys** created workspace (trial)"
  - "✅ **Sjømat AS** upgraded to Professional"
  - "⚠️ **Bistro Central** payment failed (3rd attempt)"
  - "📄 **RestaurantKjeden** signed SaaS agreement"
  - "👤 New signup: ole@example.com"

**Alerts Panel (sidebar):**

- Subscriptions past due (> 3 days)
- Trials expiring within 48h
- Contracts pending signature (> 7 days)
- Workspaces with zero activity (> 14 days after creation)

### 4.2 Workspace Overview (`/platform-admin/workspaces`)

**Primary view:** Sortable, filterable table of all workspaces.

**Table columns:**

| Column         | Source                       | Sortable | Filterable |
| -------------- | ---------------------------- | :------: | :--------: |
| Workspace Name | `workspace.name`             |    ✅    |   Search   |
| Company        | `company.name`               |    ✅    |   Search   |
| Org.nr         | `company.org_number`         |    —     |   Search   |
| Plan           | `stripe_subscription.plan`   |    ✅    |  Dropdown  |
| Status         | `stripe_subscription.status` |    ✅    |  Dropdown  |
| Profiles       | Count of active profiles     |    ✅    |   Range    |
| Created        | `workspace.created_at`       |    ✅    | Date range |
| Last Activity  | Last login timestamp         |    ✅    | Date range |
| Contract       | `contract_instance.status`   |    ✅    |  Dropdown  |

**Filters bar:**

- Plan: Trial / Starter / Professional / Enterprise / All
- Status: Trialing / Active / Past Due / Paused / Cancelled / All
- Activity: Active (7d) / Dormant (30d) / Inactive (90d)
- Contract: Signed / Pending / None

**Actions:**

- Click row → Workspace Detail view
- Bulk select → Export CSV, Bulk email

### 4.3 Workspace Detail (`/platform-admin/workspaces/:id`)

Deep dive into a single workspace. Tabbed layout:

#### Tab 1: Overview

| Section        | Content                                                           |
| -------------- | ----------------------------------------------------------------- |
| Company Info   | Name, org.nr, address, contact person, industry, created date     |
| Workspace Info | Name, timezone, language, active modules, season status           |
| Owner          | Name, email, phone, last login                                    |
| Quick Stats    | Profiles (active/trainee/inactive), departments, locations, teams |

#### Tab 2: Subscription & Billing

| Section             | Content                                                              |
| ------------------- | -------------------------------------------------------------------- |
| Current Plan        | Plan name, price, billing period, next invoice date                  |
| Subscription Status | Badge (trial/active/past_due/etc.) with days remaining for trial     |
| Profile Usage       | Bar: `current_profile_count` / `max_profiles_per_workspace`          |
| Payment Method      | Card brand + last four, or "No payment method"                       |
| Invoice History     | Table: date, amount, status, PDF link                                |
| Actions             | Change plan, extend trial, pause, cancel, add credit, override limit |

**Stripe Actions (with confirmation dialogs + audit log):**

| Action                 | Parameters          | Effect                                      |
| ---------------------- | ------------------- | ------------------------------------------- |
| Change Plan            | Target plan         | Calls Stripe API to update subscription     |
| Extend Trial           | Days to add         | Updates `trial_ends_at` in Stripe           |
| Add Credit             | Amount (NOK)        | Applies credit balance in Stripe            |
| Pause Subscription     | Duration            | Pauses collection, workspace goes read-only |
| Cancel Subscription    | Reason              | Initiates cancellation flow (Module 13, §7) |
| Override Profile Limit | New max             | Updates `max_profiles_per_workspace`        |
| Apply Discount         | % or flat, duration | Creates Stripe coupon and applies           |

#### Tab 3: Activity

| Section         | Content                                       |
| --------------- | --------------------------------------------- |
| Login History   | Last 30 days, by user, with device info       |
| Operations      | Sessions created, tasks completed (chart)     |
| Engagement      | Weekly active profiles, feature usage heatmap |
| Events Timeline | Chronological stream of workspace events      |

#### Tab 4: Contracts

| Section           | Content                                 |
| ----------------- | --------------------------------------- |
| Active Contracts  | List with status, signed date, expiry   |
| Send New Contract | Select template → fill variables → send |
| Contract History  | All contracts ever sent to this company |

#### Tab 5: Support

| Section     | Content                                                        |
| ----------- | -------------------------------------------------------------- |
| Notes       | Internal notes about this workspace (not visible to customer)  |
| Impersonate | Button to enter workspace as a specific user (requires reason) |
| Data Export | Trigger GDPR data export for this workspace                    |
| Danger Zone | Force-reset workspace, archive workspace, delete workspace     |

### 4.4 Billing Management (`/platform-admin/billing`)

Cross-workspace financial overview.

#### Revenue Dashboard

| Metric                | Visualization                                  |
| --------------------- | ---------------------------------------------- |
| MRR                   | Number + 12-month trend line                   |
| ARR                   | Calculated from MRR                            |
| ARPU                  | Average revenue per user                       |
| Churn Rate            | Monthly % (cancelled / start-of-month active)  |
| Trial Conversion      | % of trials that become paid within 30 days    |
| Net Revenue Retention | MRR from existing customers vs. previous month |
| Revenue by Plan       | Stacked bar chart                              |

#### Subscription Table

Same columns as workspace overview but focused on billing:

- Company, plan, status, MRR, profiles, payment method, next invoice, last payment status

#### Payment Failures

Dedicated view for subscriptions with failed payments:

- Company, amount, failure reason, attempt count, last attempt date
- Actions: Retry payment, send reminder email, extend grace period, contact customer

#### Revenue Breakdown

- By plan tier (pie chart)
- By month (bar chart with trend)
- Upcoming renewals this month
- Upcoming trial expirations

### 4.5 Landing Page CMS (`/platform-admin/content`)

Manage LandingConfig objects that power the marketing site.

#### Config List

| Column         | Source                       |
| -------------- | ---------------------------- |
| Name           | `landing_config.name`        |
| Slug           | `landing_config.slug`        |
| Status         | Draft / Published / Archived |
| Locale         | no / en                      |
| Version        | Current version number       |
| Last Published | `published_at`               |
| Last Edited    | `updated_at`                 |

**Actions:** Create New, Duplicate, Archive

#### Config Editor (`/platform-admin/content/:slug`)

**Left panel: Section navigator**

- Tree view of `sectionOrder` items
- Drag-and-drop to reorder sections
- Toggle sections on/off (add/remove from `sectionOrder`)
- Click section → loads editor for that section

**Center panel: Section editor**

Per section type, shows relevant fields:

| Section          | Editable Fields                                                       |
| ---------------- | --------------------------------------------------------------------- |
| Hero             | Headlines (array of lines), subheadline, CTA buttons, highlight flags |
| Features         | Feature items (icon, title, description), max 8                       |
| How It Works     | Steps (number, title, description), max 5                             |
| FAQ              | Q&A pairs, 5-8 items                                                  |
| Testimonials     | Name, role, company, quote                                            |
| Final CTA        | Headline, subheadline, buttons                                        |
| Header           | Logo, nav items, CTA                                                  |
| Footer           | Links, legal text                                                     |
| Talk To It       | Conversation examples (for interactive demo)                          |
| Data Sovereignty | Trust badges, server location text                                    |

**Right panel: Live preview**

- Real-time preview rendered from current `config_json`
- Device toggle: Desktop / Tablet / Mobile
- Locale indicator

**Top bar actions:**

- Save Draft (updates `config_json`)
- Preview Full Page (opens in new tab with draft config)
- Publish (copies `config_json` → `published_json`, creates version snapshot)
- Version History (dropdown → select previous version → diff view or restore)
- Validation (runs config validation, shows errors/warnings)

#### Theme Editor

Nested within config editor:

- Color picker for all 16 OKLCH theme colors
- Visual preview of color combinations
- Preset themes to apply as starting point

#### SEO Settings

Per config:

- Title (50-60 chars, live character count)
- Description (150-160 chars, live character count)
- OG image upload
- Canonical URL

### 4.6 Contract Management (`/platform-admin/contracts`)

#### Template Management

| Column            | Source                              |
| ----------------- | ----------------------------------- |
| Template Name     | `contract_template.name`            |
| Type              | SaaS Agreement / DPA / SLA / Custom |
| Locale            | no / en                             |
| Status            | Draft / Active / Archived           |
| Variable Fields   | Count                               |
| DocuSeal Template | Link to DocuSeal                    |

**Actions:** Create Template, Edit, Duplicate, Archive, Preview

#### Template Editor (`/platform-admin/contracts/templates/:id`)

| Section         | Content                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| Basic Info      | Name, description, type, locale                                                    |
| DocuSeal Link   | Connect to DocuSeal template ID                                                    |
| Variable Fields | Define fillable fields: name, label, type (text/date/number/select), required flag |
| Preview         | Render template with sample data                                                   |

#### Contract Instances

All sent contracts across all companies:

| Column     | Source                                               |
| ---------- | ---------------------------------------------------- |
| Title      | `contract_instance.title`                            |
| Company    | Company name                                         |
| Workspace  | Workspace name (or "Company-level")                  |
| Template   | Template name                                        |
| Status     | Draft / Sent / Viewed / Signed / Expired / Cancelled |
| Sent At    | Date                                                 |
| Signed At  | Date or "—"                                          |
| Expires At | Date or "—"                                          |

**Filters:** Status, Template Type, Company, Date Range

#### Send Contract Flow

1. Select template
2. Select company (+ optional workspace)
3. Fill variable fields (company name, org.nr, plan, start date, etc.)
4. Add signatories (name, email, role)
5. Set expiration (optional)
6. Preview filled document
7. Send via DocuSeal

**DocuSeal webhook** → updates `contract_instance.status` on signature events.

#### Contract Detail

- Full contract info + filled field values
- Signatory status (who signed, who hasn't)
- Timeline (sent → viewed → signed)
- Download signed PDF
- Actions: Resend, Cancel, Remind Signatories

### 4.7 Platform Health (`/platform-admin/health`)

| Section           | Content                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Onboarding Funnel | Signup → Create Workspace → Setup Complete → First Invite → First Session → Active Usage |
| Feature Usage     | Module activation rates across workspaces                                                |
| Activity Heatmap  | 7-day grid of active workspaces per hour                                                 |
| Error Monitor     | Recent Edge Function errors, failed webhooks                                             |
| Database Stats    | Table sizes, connection pool usage, query performance                                    |
| Storage Usage     | Supabase Storage consumption per workspace                                               |

### 4.8 User Management (`/platform-admin/users`)

| Column      | Source                   |
| ----------- | ------------------------ |
| Name        | `user.full_name`         |
| Email       | `user.email`             |
| Workspaces  | Count of active profiles |
| Super Admin | Badge if `is_godmode`    |
| Created     | `user.created_at`        |
| Last Login  | Auth metadata            |

**Actions:**

- Search users globally
- View user's profiles across workspaces
- Grant/revoke super-admin (requires confirmation + audit)
- Disable account
- Trigger password reset

### 4.9 Audit Log (`/platform-admin/audit`)

Full audit trail of all super-admin actions:

| Column    | Source                            |
| --------- | --------------------------------- |
| Timestamp | `platform_audit_log.created_at`   |
| Admin     | Super-admin name                  |
| Action    | Human-readable action description |
| Entity    | Type + name/ID                    |
| Details   | Expandable JSON                   |

**Filters:** Admin, Action Type, Entity Type, Date Range

---

## 5. API Routes

All routes under `/app/api/platform-admin/` with super-admin middleware.

### 5.1 Workspace Routes

| Method | Route                                            | Description                             |
| ------ | ------------------------------------------------ | --------------------------------------- |
| GET    | `/api/platform-admin/workspaces`                 | List workspaces (paginated, filterable) |
| GET    | `/api/platform-admin/workspaces/:id`             | Get workspace detail                    |
| GET    | `/api/platform-admin/workspaces/:id/activity`    | Get activity data                       |
| POST   | `/api/platform-admin/workspaces/:id/notes`       | Add internal note                       |
| POST   | `/api/platform-admin/workspaces/:id/impersonate` | Start impersonation session             |
| POST   | `/api/platform-admin/workspaces/:id/export`      | Trigger GDPR export                     |
| DELETE | `/api/platform-admin/workspaces/:id`             | Archive workspace (soft delete)         |

### 5.2 Billing Routes

| Method | Route                                                          | Description              |
| ------ | -------------------------------------------------------------- | ------------------------ |
| GET    | `/api/platform-admin/billing/overview`                         | Revenue dashboard data   |
| GET    | `/api/platform-admin/billing/subscriptions`                    | List all subscriptions   |
| GET    | `/api/platform-admin/billing/failures`                         | List payment failures    |
| POST   | `/api/platform-admin/billing/subscriptions/:id/change-plan`    | Change subscription plan |
| POST   | `/api/platform-admin/billing/subscriptions/:id/extend-trial`   | Extend trial period      |
| POST   | `/api/platform-admin/billing/subscriptions/:id/add-credit`     | Add credit balance       |
| POST   | `/api/platform-admin/billing/subscriptions/:id/pause`          | Pause subscription       |
| POST   | `/api/platform-admin/billing/subscriptions/:id/cancel`         | Cancel subscription      |
| POST   | `/api/platform-admin/billing/subscriptions/:id/override-limit` | Override profile limit   |
| POST   | `/api/platform-admin/billing/subscriptions/:id/apply-discount` | Apply discount           |

### 5.3 Content Routes

| Method | Route                                                | Description                |
| ------ | ---------------------------------------------------- | -------------------------- |
| GET    | `/api/platform-admin/content/configs`                | List landing configs       |
| GET    | `/api/platform-admin/content/configs/:slug`          | Get config with full JSON  |
| PUT    | `/api/platform-admin/content/configs/:slug`          | Update config (save draft) |
| POST   | `/api/platform-admin/content/configs/:slug/publish`  | Publish config             |
| POST   | `/api/platform-admin/content/configs`                | Create new config          |
| GET    | `/api/platform-admin/content/configs/:slug/versions` | List version history       |
| POST   | `/api/platform-admin/content/configs/:slug/restore`  | Restore previous version   |
| DELETE | `/api/platform-admin/content/configs/:slug`          | Archive config             |

**Landing page public endpoint** (no auth):

| Method | Route                | Description                                        |
| ------ | -------------------- | -------------------------------------------------- |
| GET    | `/api/content/:slug` | Returns `published_json` for the given config slug |

### 5.4 Contract Routes

| Method | Route                                         | Description                 |
| ------ | --------------------------------------------- | --------------------------- |
| GET    | `/api/platform-admin/contracts/templates`     | List templates              |
| POST   | `/api/platform-admin/contracts/templates`     | Create template             |
| PUT    | `/api/platform-admin/contracts/templates/:id` | Update template             |
| GET    | `/api/platform-admin/contracts`               | List all contract instances |
| POST   | `/api/platform-admin/contracts`               | Create + send contract      |
| GET    | `/api/platform-admin/contracts/:id`           | Get contract detail         |
| POST   | `/api/platform-admin/contracts/:id/resend`    | Resend to signatories       |
| POST   | `/api/platform-admin/contracts/:id/cancel`    | Cancel contract             |
| POST   | `/api/platform-admin/contracts/:id/remind`    | Send reminder               |

**Webhook endpoint:**

| Method | Route                    | Description               |
| ------ | ------------------------ | ------------------------- |
| POST   | `/api/webhooks/docuseal` | DocuSeal signature events |

### 5.5 Health & Metrics Routes

| Method | Route                                      | Description                    |
| ------ | ------------------------------------------ | ------------------------------ |
| GET    | `/api/platform-admin/health/metrics`       | Current platform metrics       |
| GET    | `/api/platform-admin/health/funnel`        | Onboarding funnel data         |
| GET    | `/api/platform-admin/health/feature-usage` | Module usage across workspaces |
| GET    | `/api/platform-admin/health/errors`        | Recent errors                  |

### 5.6 User & Audit Routes

| Method | Route                                       | Description                        |
| ------ | ------------------------------------------- | ---------------------------------- |
| GET    | `/api/platform-admin/users`                 | List users (paginated, searchable) |
| GET    | `/api/platform-admin/users/:id`             | User detail + workspace profiles   |
| POST   | `/api/platform-admin/users/:id/super-admin` | Grant super-admin                  |
| DELETE | `/api/platform-admin/users/:id/super-admin` | Revoke super-admin                 |
| POST   | `/api/platform-admin/users/:id/disable`     | Disable account                    |
| GET    | `/api/platform-admin/audit`                 | Audit log (paginated, filterable)  |

---

## 6. DocuSeal Integration

### 6.1 Connection

```typescript
// DocuSeal API client
const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL; // Self-hosted or cloud
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY;

// Create submission (send contract for signing)
async function sendContract(contract: ContractInstance, template: ContractTemplate) {
  const response = await fetch(`${DOCUSEAL_API_URL}/submissions`, {
    method: "POST",
    headers: {
      "X-Auth-Token": DOCUSEAL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: template.docuseal_template_id,
      send_email: true,
      submitters: contract.signatories.map((s) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        fields: contract.field_values,
      })),
    }),
  });
  return response.json();
}
```

### 6.2 Webhook Handler

```typescript
// /api/webhooks/docuseal
export async function POST(req: Request) {
  const event = await req.json();

  switch (event.event_type) {
    case "submission.created":
      // Update contract status → 'sent'
      break;
    case "submission.viewed":
      // Update contract status → 'viewed'
      break;
    case "submission.completed":
      // Update contract status → 'signed'
      // Store signed PDF URL
      // Update signatory records with signed_at timestamps
      break;
    case "submission.expired":
      // Update contract status → 'expired'
      break;
  }

  // Audit log
  await logPlatformAction("docuseal_webhook", "contract", contract_id, event);

  return new Response("OK", { status: 200 });
}
```

### 6.3 Standard Contract Templates

| Template                  | Type             | Use Case                              |
| ------------------------- | ---------------- | ------------------------------------- |
| Smartout SaaS-avtale      | `saas_agreement` | Standard subscription agreement       |
| Databehandleravtale (DPA) | `dpa`            | GDPR data processor agreement         |
| Tjenestenivåavtale (SLA)  | `sla`            | Service level guarantees (Enterprise) |
| Tilleggsavtale            | `custom`         | Custom addendums                      |

**Variable fields for SaaS agreement:**

- Company name, org.nr
- Contact person name + email
- Selected plan + pricing
- Number of included profiles
- Start date
- Contract duration
- Special terms (free text)

---

## 7. Landing Page Content Flow

### 7.1 Architecture

```
CMS (Super Admin)                    Landing Page (Public)
┌──────────────────┐                 ┌──────────────────┐
│ Edit config_json │                 │ Read from API    │
│ Save Draft       │                 │ /api/content/:slug│
│ Preview          │                 │ Returns           │
│ Publish ─────────┼──┐              │ published_json    │
│                  │  │              │                  │
│ Version History  │  │  ┌────────┐  │ Renders sections │
│ Rollback        │  └─→│ DB     │──→│ per sectionOrder │
└──────────────────┘     │published│  └──────────────────┘
                         │_json   │
                         └────────┘
```

### 7.2 Config Validation on Save

Before saving, validate the `config_json`:

```typescript
interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[]; // Must fix before publish
  warnings: ConfigValidationWarning[]; // Can publish with warnings
}

// Validation checks (align with smartout-config-generator skill):
// - All required fields present
// - sectionOrder matches sections keys
// - No section in sectionOrder without matching sections entry
// - All 16 theme colors defined in OKLCH
// - SEO title 50-60 chars, description 150-160 chars
// - Headlines 3-8 words
// - Features 4-8 items, no duplicate icons
// - FAQ 5-8 items
// - CTA actions are valid enum values
// - Locale consistency (all copy matches declared locale)
```

### 7.3 Publish Flow

1. Super-admin clicks "Publish"
2. Run validation → must pass with zero errors
3. Show diff between current `published_json` and new `config_json`
4. Confirm dialog: "Publish v{n+1}? This goes live immediately."
5. On confirm:
   - Create `landing_config_version` snapshot
   - Copy `config_json` → `published_json`
   - Increment `version`
   - Set `published_at` and `published_by`
   - Audit log entry
6. Landing page immediately serves new content (no cache invalidation needed — API reads from DB)

### 7.4 Rollback

1. Open Version History
2. Select a previous version
3. View diff between that version and current
4. "Restore this version" → copies version's `config_json` back to the working `config_json`
5. Still requires "Publish" to go live (safe two-step)

---

## 8. Metrics Collection

### 8.1 Daily Metrics Job

Supabase Edge Function scheduled via `pg_cron`:

```sql
SELECT cron.schedule(
  'daily-platform-metrics',
  '0 2 * * *',  -- 02:00 UTC daily
  $$SELECT compute_platform_metrics()$$
);
```

```sql
CREATE OR REPLACE FUNCTION compute_platform_metrics()
RETURNS void AS $$
INSERT INTO platform_metrics_daily (
  date,
  total_users,
  total_companies,
  total_workspaces,
  total_profiles,
  new_users_today,
  new_workspaces_today,
  subscriptions_trial,
  subscriptions_active,
  subscriptions_paused,
  subscriptions_past_due,
  subscriptions_cancelled,
  active_workspaces_24h,
  mrr_nok
)
SELECT
  CURRENT_DATE,
  (SELECT count(*) FROM "user"),
  (SELECT count(*) FROM company),
  (SELECT count(*) FROM workspace),
  (SELECT count(*) FROM profile WHERE is_active = true),
  (SELECT count(*) FROM "user" WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM workspace WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM stripe_subscription WHERE status = 'trialing'),
  (SELECT count(*) FROM stripe_subscription WHERE status = 'active'),
  (SELECT count(*) FROM stripe_subscription WHERE status = 'paused'),
  (SELECT count(*) FROM stripe_subscription WHERE status = 'past_due'),
  (SELECT count(*) FROM stripe_subscription WHERE status = 'canceled'),
  -- Active workspaces: at least one profile with recent activity
  (SELECT count(DISTINCT workspace_id) FROM profile
   WHERE updated_at >= now() - interval '24 hours'),
  -- MRR: simplified calculation (actual from Stripe API for accuracy)
  (SELECT COALESCE(sum(
    CASE plan
      WHEN 'starter' THEN current_profile_count * 149  -- Example NOK pricing
      WHEN 'professional' THEN current_profile_count * 249
      WHEN 'enterprise' THEN current_profile_count * 399
      ELSE 0
    END
  ), 0) FROM stripe_subscription WHERE status = 'active')
ON CONFLICT (date) DO UPDATE SET
  total_users = EXCLUDED.total_users,
  total_companies = EXCLUDED.total_companies,
  total_workspaces = EXCLUDED.total_workspaces,
  total_profiles = EXCLUDED.total_profiles,
  new_users_today = EXCLUDED.new_users_today,
  new_workspaces_today = EXCLUDED.new_workspaces_today,
  subscriptions_trial = EXCLUDED.subscriptions_trial,
  subscriptions_active = EXCLUDED.subscriptions_active,
  subscriptions_paused = EXCLUDED.subscriptions_paused,
  subscriptions_past_due = EXCLUDED.subscriptions_past_due,
  subscriptions_cancelled = EXCLUDED.subscriptions_cancelled,
  active_workspaces_24h = EXCLUDED.active_workspaces_24h,
  mrr_nok = EXCLUDED.mrr_nok,
  computed_at = now();
$$ LANGUAGE sql;
```

### 8.2 Real-Time Events

For the activity feed on the dashboard, use Supabase Realtime:

```typescript
// Subscribe to platform events
const channel = supabaseAdmin
  .channel("platform-events")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "workspace",
    },
    (payload) => {
      addToFeed(`🆕 New workspace: ${payload.new.name}`);
    },
  )
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "stripe_subscription",
    },
    (payload) => {
      if (payload.old.status !== payload.new.status) {
        addToFeed(
          `Subscription ${payload.new.company_id}: ${payload.old.status} → ${payload.new.status}`,
        );
      }
    },
  )
  .subscribe();
```

---

## 9. Integration Points

| Module                       | Integration                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| **Module 1 (Onboarding)**    | Platform admin sees onboarding funnel metrics. Can view individual workspace onboarding state. |
| **Module 13 (Multi-Tenant)** | Shares `stripe_subscription` table. Super-admin RLS bypass defined in Module 13 used here.     |
| **Module 14 (Compliance)**   | GDPR export triggered from workspace detail. Data deletion requests initiated here.            |
| **Landing Page System**      | CMS manages the `LandingConfig` objects that the public landing page consumes.                 |
| **DocuSeal**                 | Contract templates mapped to DocuSeal templates. Webhook sync for signature status.            |
| **Stripe API**               | Direct Stripe API calls for subscription modifications, not just webhook consumption.          |

---

## 10. Implementation Sequence

| Phase                      | Scope                                                                                  | Duration | Priority    |
| -------------------------- | -------------------------------------------------------------------------------------- | -------- | ----------- |
| **1. Foundation**          | Super-admin middleware, audit log table, route structure, basic layout shell           | 2-3 days | 🔴 Critical |
| **2. Workspace Overview**  | Workspace list + detail view (read-only). Query cross-workspace data.                  | 3-4 days | 🔴 Critical |
| **3. Landing Page CMS**    | `landing_config` table, config list, section editor, publish flow, version history.    | 5-7 days | 🔴 Critical |
| **4. Contract Management** | Templates, DocuSeal integration, send flow, webhook handler, contract status tracking. | 4-5 days | 🟡 High     |
| **5. Billing Dashboard**   | MRR charts, subscription table, payment failure view. Read-only first.                 | 3-4 days | 🟡 High     |
| **6. Billing Actions**     | Stripe API integration for plan changes, trial extensions, discounts, etc.             | 3-4 days | 🟡 High     |
| **7. Platform Metrics**    | Daily metrics job, health dashboard, onboarding funnel.                                | 2-3 days | 🟢 Medium   |
| **8. User Management**     | Global user search, super-admin grants, impersonation.                                 | 2-3 days | 🟢 Medium   |
| **9. Polish**              | Activity feed (Realtime), alerts, export, keyboard shortcuts.                          | 2-3 days | 🟢 Medium   |

**Estimated total: 4-5 weeks**

---

## 11. UI/UX Guidelines

### 11.1 Design Principles

- **Density over beauty.** This is an internal tool — maximize information density. Tables over cards. Compact spacing.
- **Speed over transitions.** No animations. Instant page loads. Server components where possible.
- **Actions are audited.** Every destructive action needs confirmation dialog + reason field.
- **Data first.** Every page should show meaningful data within 200ms.

### 11.2 Component Library

Use the same shadcn/ui components as the main app, but with a more compact, dashboard-oriented configuration:

- `DataTable` with sorting, filtering, pagination (TanStack Table)
- `Sheet` for side panels (workspace detail, contract detail)
- `Dialog` for confirmations and actions
- `Tabs` for detail views
- `Badge` for status indicators
- `Card` for KPI metrics
- Charts: Recharts (already in the stack)

### 11.3 Color Coding

| Status                        | Color  | Usage              |
| ----------------------------- | ------ | ------------------ |
| Active / Signed / Published   | Green  | Healthy state      |
| Trial / Draft / Pending       | Blue   | Transitional state |
| Past Due / Expiring / At Risk | Orange | Needs attention    |
| Cancelled / Expired / Failed  | Red    | Problem state      |
| Paused / Archived / Inactive  | Gray   | Dormant state      |

---

## 12. Security Checklist

- [ ] `is_godmode` can only be set via direct database access or by an existing super-admin
- [ ] Service role key never exposed to client-side code
- [ ] All platform-admin API routes check `is_godmode` in middleware
- [ ] Every action writes to `platform_audit_log`
- [ ] Impersonation requires reason and is time-limited (max 1 hour)
- [ ] Impersonation creates visible banner in impersonated session
- [ ] Contract documents stored in isolated Supabase Storage bucket
- [ ] DocuSeal webhook validates signature/origin
- [ ] No PII logged in platform_audit_log details (reference IDs only)
- [ ] Rate limiting on billing action endpoints (prevent accidental bulk operations)

---

## 13. Future Considerations

| Feature                      | When                                   | Notes                                                  |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------ |
| **A/B Testing**              | When landing page traffic justifies it | Split traffic between config versions                  |
| **Customer Success Scoring** | 50+ workspaces                         | Composite score: activity, engagement, support tickets |
| **Automated Dunning**        | When payment failures increase         | Multi-step recovery emails with escalation             |
| **White-Label Config**       | Enterprise tier                        | Per-workspace branding via platform admin              |
| **API Analytics**            | When API access launches               | Track external API usage per workspace                 |
| **Multi-Admin Permissions**  | When team grows                        | Role-based access within platform admin itself         |

---

_The Platform Admin Backoffice is Smartout's internal command center — the single pane of glass for understanding every workspace, every subscription, every contract, and every landing page. It's an internal tool, so optimize for speed and information density over polish. Build it incrementally, starting with workspace visibility and landing page management._
