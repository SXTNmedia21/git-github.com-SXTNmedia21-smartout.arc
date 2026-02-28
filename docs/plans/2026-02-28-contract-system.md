# Contract System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Smartout's cross-cutting contract system — shared signing infrastructure that handles B2B client contracts (first deliverable), with architecture supporting future employee contracts, HACCP sign-offs, and training acknowledgments.

**Architecture:** Standalone Fastify microservice (`services/contract-service/`) abstracting DocuSeal Cloud. The microservice owns all DocuSeal communication — no other part of Smartout talks directly to DocuSeal. The Next.js web app embeds `@docuseal/react` for signing UX. Supabase stores all contract data with RLS. A workspace state machine gates access based on contract status.

**Tech Stack:** Fastify + TypeScript (microservice), DocuSeal Cloud (`@docuseal/api` v1.0.21 + `@docuseal/react` v1.0.71), Supabase PostgreSQL (data + storage), Tiptap + Vercel AI SDK 6 (AI template creator, Phase 5), Next.js App Router (UI).

**Reference Docs:**

- Architecture: `docs/architecture/SMARTOUT_CONTRACT_SYSTEM.md` (full spec)
- Existing ADRs: ADR-0016 (services directory), ADR-0018 (TanStack Table), ADR-0006 (secrets)
- Existing Learnings: L-0004 (webhook status regression), L-0006 (DocuSeal shared secret)

**Existing Code:**

- `platform_contract_template` + `platform_contract_instance` tables (migration 00013)
- DocuSeal webhook route: `apps/web/src/app/api/webhooks/docuseal/route.ts`
- Read-only contract listing: `apps/web/src/app/(platform-admin)/platform-admin/contracts/page.tsx`
- `employment_contract` table + `contract_status` enum (migration 00012) — DO NOT reuse this enum name

**Strategy:** We evolve the existing platform contract tables to match the architecture spec rather than creating parallel tables. This avoids data migration and keeps the working webhook intact.

---

## Phase 1: Database Foundation

### Task 1: Write migration for contract_template table evolution

**Files:**

- Create: `supabase/migrations/20260228140000_contract_system_foundation.sql`
- Reference: `docs/architecture/SMARTOUT_CONTRACT_SYSTEM.md` Section 3

**Step 1: Write the migration SQL**

Create migration that evolves `platform_contract_template` → `contract_template` and adds all columns from the architecture spec. Also creates new tables: `contract_event`, `contract_reminder`, `message_template`, `clause_library`.

```sql
-- =============================================================
-- Migration: Contract System Foundation
-- Evolves existing platform_contract_* tables and adds new tables
-- per docs/architecture/SMARTOUT_CONTRACT_SYSTEM.md Section 3
-- =============================================================

-- 1. Rename existing platform tables to match architecture spec
ALTER TABLE platform_contract_template RENAME TO contract_template;
ALTER TABLE platform_contract_instance RENAME TO contract;

-- 2. Evolve contract_template to match spec
-- Add missing columns (keep existing ones)
ALTER TABLE contract_template
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspace(workspace_id),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS content_css text,
  ADD COLUMN IF NOT EXISTS header_html text,
  ADD COLUMN IF NOT EXISTS footer_html text,
  ADD COLUMN IF NOT EXISTS watermark_url text,
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#FF6B35',
  ADD COLUMN IF NOT EXISTS placeholders jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS docuseal_template_id integer,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 3. Evolve contract table to match spec
ALTER TABLE contract
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS resolved_html text,
  ADD COLUMN IF NOT EXISTS resolved_values jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS docuseal_submitter_id integer,
  ADD COLUMN IF NOT EXISTS signing_url text,
  ADD COLUMN IF NOT EXISTS signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS audit_log_url text,
  ADD COLUMN IF NOT EXISTS journey_type text,
  ADD COLUMN IF NOT EXISTS auto_create_workspace boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Rename docuseal_submission_id from text to match spec (integer)
-- Keep as text since existing data may have string values
-- Just add an index for performance
CREATE INDEX IF NOT EXISTS idx_contract_docuseal_sub
  ON contract(docuseal_submission_id);
CREATE INDEX IF NOT EXISTS idx_contract_workspace
  ON contract(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_status
  ON contract(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_recipient
  ON contract(recipient_email);

-- 4. Create contract_event (immutable audit trail)
CREATE TABLE IF NOT EXISTS contract_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES contract(contract_id),
  workspace_id    uuid,
  event_type      text NOT NULL,
  actor_type      text NOT NULL,
  actor_id        text,
  details         jsonb DEFAULT '{}',
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_event_contract ON contract_event(contract_id);
CREATE INDEX idx_event_type ON contract_event(event_type);

-- 5. Create contract_reminder
CREATE TABLE IF NOT EXISTS contract_reminder (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES contract(contract_id),
  workspace_id    uuid REFERENCES workspace(workspace_id),
  reminder_type   text NOT NULL,
  template_key    text NOT NULL,
  language        text NOT NULL DEFAULT 'no',
  scheduled_at    timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text DEFAULT 'scheduled',
  skip_reason     text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_reminder_pending
  ON contract_reminder(scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX idx_reminder_contract
  ON contract_reminder(contract_id);

-- 6. Create message_template
CREATE TABLE IF NOT EXISTS message_template (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text NOT NULL UNIQUE,
  channel           text NOT NULL,
  category          text NOT NULL,
  subject_no        text,
  subject_en        text,
  body_no           text NOT NULL,
  body_en           text,
  cta_label_no      text,
  cta_label_en      text,
  cta_url_template  text,
  sms_body_no       text,
  sms_body_en       text,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 7. Create clause_library
CREATE TABLE IF NOT EXISTS clause_library (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  summary         text,
  content_html    text NOT NULL,
  category        text NOT NULL,
  contract_types  text[] DEFAULT '{}',
  language        text NOT NULL DEFAULT 'no',
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 8. Add contract columns to workspace table
ALTER TABLE workspace
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_ends timestamptz,
  ADD COLUMN IF NOT EXISTS active_contract_id uuid,
  ADD COLUMN IF NOT EXISTS override_access boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_note text,
  ADD COLUMN IF NOT EXISTS override_expires timestamptz;

-- 9. RLS policies for contract tables
-- contract_template: workspace-scoped + system templates visible to all
ALTER TABLE contract_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system templates"
  ON contract_template FOR SELECT
  USING (is_system = true);

CREATE POLICY "Users can view workspace templates"
  ON contract_template FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "Admins can manage workspace templates"
  ON contract_template FOR ALL
  USING (is_admin_in_workspace(workspace_id, auth.uid()));

-- contract: workspace-scoped
ALTER TABLE contract ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace contracts"
  ON contract FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "Admins can manage workspace contracts"
  ON contract FOR ALL
  USING (is_admin_in_workspace(workspace_id, auth.uid()));

-- contract_event: read-only via contract access
ALTER TABLE contract_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for accessible contracts"
  ON contract_event FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contract c
      WHERE c.contract_id = contract_event.contract_id
      AND c.workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- contract_reminder: admin only
ALTER TABLE contract_reminder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view workspace reminders"
  ON contract_reminder FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- clause_library: read-only for all authenticated users
ALTER TABLE clause_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clauses"
  ON clause_library FOR SELECT
  TO authenticated
  USING (is_active = true);

-- message_template: no RLS (system table, service role only)
-- Intentionally NOT enabling RLS on message_template

-- 10. Contract number sequence
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS text AS $$
BEGIN
  RETURN 'KONTRAKT-' || EXTRACT(YEAR FROM now())::text || '-' ||
         LPAD(nextval('contract_number_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
```

**Step 2: Verify migration applies to local Supabase**

Run: `npx supabase db reset`
Expected: All migrations apply without errors.

**Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: New types include `contract_template`, `contract`, `contract_event`, `contract_reminder`, `message_template`, `clause_library`, plus workspace additions.

**Step 4: Commit**

```bash
git add supabase/migrations/20260228140000_contract_system_foundation.sql packages/supabase/src/database.types.ts
git commit -m "feat: add contract system database foundation

Creates contract_event, contract_reminder, message_template, clause_library tables.
Evolves platform_contract_template → contract_template with spec columns.
Evolves platform_contract_instance → contract with spec columns.
Adds workspace contract_status columns and RLS policies."
```

---

### Task 2: Update webhook route for renamed tables

**Files:**

- Modify: `apps/web/src/app/api/webhooks/docuseal/route.ts`
- Reference: Learning L-0004 (webhook status regression), L-0006 (DocuSeal shared secret)

**Step 1: Read the existing webhook route**

Read the file first to understand the current implementation.

**Step 2: Update table references**

Replace `platform_contract_instance` → `contract` and `platform_audit_log` references. Add `contract_event` logging alongside the existing audit log.

The webhook should now:

1. Match by `docuseal_submission_id` on the `contract` table (renamed)
2. Log to `contract_event` table (new immutable audit trail)
3. Keep logging to `platform_audit_log` (backward compat)
4. Update `viewed_at` on `form.viewed` events
5. Update `signed_at`, `signed_pdf_url` on `form.completed`
6. Update `declined_at`, `decline_reason` on decline events
7. Cancel pending reminders when contract is signed

**Step 3: Run typecheck to verify**

Run: `pnpm --filter web typecheck`
Expected: No type errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/api/webhooks/docuseal/route.ts
git commit -m "refactor: update DocuSeal webhook for renamed contract tables

Uses contract (was platform_contract_instance) and adds contract_event logging."
```

---

### Task 3: Update platform-admin contracts page for renamed table

**Files:**

- Modify: `apps/web/src/app/(platform-admin)/platform-admin/contracts/page.tsx`

**Step 1: Read the existing contracts page**

Read the file to understand current queries.

**Step 2: Update Supabase queries to use renamed table**

Replace `platform_contract_instance` → `contract` in all `.from()` calls.

**Step 3: Run typecheck**

Run: `pnpm --filter web typecheck`
Expected: No type errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/(platform-admin)/platform-admin/contracts/page.tsx
git commit -m "refactor: update platform-admin contracts page for renamed table"
```

---

### Task 4: Seed message templates for contract reminders

**Files:**

- Create: `supabase/migrations/20260228140100_seed_contract_message_templates.sql`

**Step 1: Write the seed migration**

Insert the message templates defined in the architecture spec Section 8 (reminder sequences).

```sql
-- Contract reminder message templates (Journey A: Self-Service Trial)
INSERT INTO message_template (key, channel, category, subject_no, subject_en, body_no, body_en, cta_label_no, cta_label_en, cta_url_template, sms_body_no, sms_body_en)
VALUES
  -- Day 0: Welcome
  ('contract.welcome', 'email', 'contract',
   'Velkommen til Smartout!', 'Welcome to Smartout!',
   'Hei {{client_contact_name}},\n\nVelkommen til Smartout! Din prøveperiode er i gang. Du har 14 dager til å utforske plattformen.\n\nFor å aktivere alle funksjoner, signer avtalen din.',
   'Hi {{client_contact_name}},\n\nWelcome to Smartout! Your trial is active. You have 14 days to explore the platform.\n\nTo unlock all features, sign your agreement.',
   'Signer avtale', 'Sign agreement',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 3: Soft nudge
  ('contract.reminder.day3', 'email', 'contract',
   'Slik får du mest ut av Smartout', 'Getting the most out of Smartout',
   'Hei {{client_contact_name}},\n\nDu har nå brukt Smartout i 3 dager. Har du sett vaktplanleggeren? Den sparer ledere 6+ timer per uke.\n\nSigner avtalen for å sikre full tilgang etter prøveperioden.',
   'Hi {{client_contact_name}},\n\nYou''ve been using Smartout for 3 days. Have you tried the shift planner? It saves managers 6+ hours per week.\n\nSign the agreement to keep full access after the trial.',
   'Signer nå', 'Sign now',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 7: Halfway
  ('contract.reminder.day7', 'email', 'contract',
   'Halvveis i prøveperioden', 'Halfway through your trial',
   'Hei {{client_contact_name}},\n\nDu er halvveis i prøveperioden. {{usage_stats}}\n\nSigner avtalen innen {{trial_ends_at}} for å beholde tilgang.',
   'Hi {{client_contact_name}},\n\nYou''re halfway through your trial. {{usage_stats}}\n\nSign the agreement by {{trial_ends_at}} to keep access.',
   'Signer avtale', 'Sign agreement',
   'https://smartout.io/sign/{{token}}',
   'Smartout: Halvveis i prøveperioden. Signer avtalen for å beholde tilgang: {{short_url}}',
   'Smartout: Halfway through your trial. Sign to keep access: {{short_url}}'),

  -- Day 10: Urgent
  ('contract.reminder.day10', 'email', 'contract',
   '4 dager igjen av prøveperioden', '4 days left in your trial',
   'Hei {{client_contact_name}},\n\nDu har 4 dager igjen. Etter {{trial_ends_at}} blir kontoen skrivebeskyttet.\n\nSigner nå for å unngå avbrudd.',
   'Hi {{client_contact_name}},\n\nYou have 4 days left. After {{trial_ends_at}} your account becomes read-only.\n\nSign now to avoid interruption.',
   'Signer nå', 'Sign now',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 13: Last day
  ('contract.reminder.day13', 'email', 'contract',
   'Siste dag - prøveperioden utløper i morgen', 'Last day - your trial expires tomorrow',
   'Hei {{client_contact_name}},\n\nPrøveperioden utløper i morgen. Signer avtalen NÅ for å beholde tilgang til alle data og funksjoner.',
   'Hi {{client_contact_name}},\n\nYour trial expires tomorrow. Sign the agreement NOW to keep access to all data and features.',
   'Signer avtale', 'Sign agreement',
   'https://smartout.io/sign/{{token}}',
   'Smartout: Siste dag! Prøveperioden utløper i morgen. Signer: {{short_url}}',
   'Smartout: Last day! Trial expires tomorrow. Sign: {{short_url}}'),

  -- Day 14: Expired
  ('contract.reminder.expired', 'email', 'contract',
   'Prøveperioden er utløpt', 'Your trial has expired',
   'Hei {{client_contact_name}},\n\nPrøveperioden er utløpt. Kontoen er nå skrivebeskyttet. Du kan fortsatt se dataene dine, men ikke gjøre endringer.\n\nSigner avtalen for å gjenoppta full tilgang.',
   'Hi {{client_contact_name}},\n\nYour trial has expired. Your account is now read-only. You can still view your data but cannot make changes.\n\nSign the agreement to restore full access.',
   'Signer og aktiver', 'Sign and activate',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 21: Data deletion warning
  ('contract.deletion.warning', 'email', 'contract',
   'Dataene dine slettes om 7 dager', 'Your data will be deleted in 7 days',
   'Hei {{client_contact_name}},\n\nKontoen din har vært inaktiv i 21 dager. Om 7 dager slettes alle data permanent.\n\nDu kan eksportere dataene dine eller signere avtalen for å beholde kontoen.',
   'Hi {{client_contact_name}},\n\nYour account has been inactive for 21 days. In 7 days all data will be permanently deleted.\n\nYou can export your data or sign the agreement to keep your account.',
   'Eksporter data', 'Export data',
   'https://smartout.io/dashboard/settings/export',
   'Smartout: Dataene dine slettes om 7 dager. Eksporter eller signer: {{short_url}}',
   'Smartout: Your data will be deleted in 7 days. Export or sign: {{short_url}}'),

  -- Journey B: Sales-assisted initial send
  ('contract.sales.sent', 'email', 'contract',
   'Avtale fra Smartout', 'Agreement from Smartout',
   'Hei {{client_contact_name}},\n\nVedlagt finner du avtalen mellom {{client_company_name}} og Smartout AS.\n\nVennligst gjennomgå og signer avtalen digitalt.',
   'Hi {{client_contact_name}},\n\nPlease find attached the agreement between {{client_company_name}} and Smartout AS.\n\nPlease review and sign the agreement digitally.',
   'Gjennomgå og signer', 'Review and sign',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Journey B: Not viewed after 3 days
  ('contract.sales.reminder.day3', 'email', 'contract',
   'Påminnelse: Avtale venter på signering', 'Reminder: Agreement awaiting signature',
   'Hei {{client_contact_name}},\n\nVi sendte deg en avtale for 3 dager siden. Den venter fortsatt på gjennomgang.\n\nHar du spørsmål? Svar på denne e-posten.',
   'Hi {{client_contact_name}},\n\nWe sent you an agreement 3 days ago. It''s still awaiting review.\n\nHave questions? Reply to this email.',
   'Åpne avtale', 'Open agreement',
   'https://smartout.io/sign/{{token}}', NULL, NULL);
```

**Step 2: Apply migration**

Run: `npx supabase db reset`
Expected: All migrations apply.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/20260228140100_seed_contract_message_templates.sql packages/supabase/src/database.types.ts
git commit -m "feat: seed contract reminder message templates

Adds Norwegian + English email/SMS templates for trial reminders,
sales-assisted contract flow, and data deletion warnings."
```

---

## Phase 2: Contract Microservice

### Task 5: Scaffold the contract microservice

**Files:**

- Create: `services/contract-service/package.json`
- Create: `services/contract-service/tsconfig.json`
- Create: `services/contract-service/Dockerfile`
- Create: `services/contract-service/.env.example`
- Create: `services/contract-service/src/server.ts`
- Create: `services/contract-service/src/config.ts`
- Create: `services/contract-service/src/lib/supabase.ts`
- Create: `services/contract-service/src/lib/docuseal.ts`
- Reference: ADR-0016 (services directory)

**Step 1: Create package.json**

```json
{
  "name": "@smartout/contract-service",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@docuseal/api": "^1.0.21",
    "@supabase/supabase-js": "^2.49.4",
    "fastify": "^5.2.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.5",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .env.example**

```env
PORT=3100
SERVICE_KEY=change-me-to-a-strong-secret
NODE_ENV=development
SUPABASE_URL=http://127.0.0.1:54331
SUPABASE_SERVICE_ROLE_KEY=<from-supabase-status>
DOCUSEAL_API_KEY=<from-docuseal-dashboard>
DOCUSEAL_API_URL=https://api.docuseal.com
DOCUSEAL_WEBHOOK_SECRET=<from-docuseal-dashboard>
SMARTOUT_COMPANY_NAME=Smartout AS
SMARTOUT_ORG_NUMBER=93XXXXXXX
SMARTOUT_CONTACT_EMAIL=pontus@smartout.io
```

**Step 4: Create config.ts**

```typescript
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  SERVICE_KEY: z.string().min(16),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  DOCUSEAL_API_KEY: z.string().min(1),
  DOCUSEAL_API_URL: z.string().url().default("https://api.docuseal.com"),
  DOCUSEAL_WEBHOOK_SECRET: z.string().min(1),
  SMARTOUT_COMPANY_NAME: z.string().default("Smartout AS"),
  SMARTOUT_ORG_NUMBER: z.string().default(""),
  SMARTOUT_CONTACT_EMAIL: z.string().email().default("pontus@smartout.io"),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

**Step 5: Create supabase.ts**

```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

**Step 6: Create docuseal.ts**

```typescript
import { DocusealApi } from "@docuseal/api";
import { config } from "../config.js";

export const docuseal = new DocusealApi({
  key: config.DOCUSEAL_API_KEY,
  url: config.DOCUSEAL_API_URL,
});
```

**Step 7: Create server.ts**

```typescript
import Fastify from "fastify";
import { config } from "./config.js";

const app = Fastify({ logger: true });

// Service key auth hook
app.addHook("onRequest", async (request, reply) => {
  // Skip auth for health check and webhooks
  if (request.url === "/health" || request.url.startsWith("/webhooks/")) return;

  const serviceKey = request.headers["x-service-key"];
  if (serviceKey !== config.SERVICE_KEY) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
});

// Health check
app.get("/health", async () => ({
  status: "ok",
  service: "contract-service",
  timestamp: new Date().toISOString(),
}));

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`Contract service running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
```

**Step 8: Create Dockerfile**

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY dist ./dist
EXPOSE 3100
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
```

**Step 9: Install dependencies**

Run: `cd services/contract-service && pnpm install`
Expected: Dependencies installed successfully.

**Step 10: Verify it starts**

Run: `cd services/contract-service && SERVICE_KEY=test-key-1234567890 SUPABASE_URL=http://127.0.0.1:54331 SUPABASE_SERVICE_ROLE_KEY=test DOCUSEAL_API_KEY=test DOCUSEAL_WEBHOOK_SECRET=test npx tsx src/server.ts`
Expected: Server starts on port 3100, `/health` returns `{ status: "ok" }`.

**Step 11: Commit**

```bash
git add services/contract-service/
git commit -m "feat: scaffold contract microservice with Fastify

Standalone service at services/contract-service/ (ADR-0016).
Fastify + TypeScript, Zod config validation, health endpoint.
DocuSeal API client and Supabase service role client initialized."
```

---

### Task 6: Add template CRUD routes

**Files:**

- Create: `services/contract-service/src/routes/templates.ts`
- Create: `services/contract-service/src/schemas/templates.ts`
- Modify: `services/contract-service/src/server.ts`

**Step 1: Create template schemas**

```typescript
import { z } from "zod";

export const createTemplateSchema = z.object({
  workspace_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  contract_type: z.enum(["client", "employee", "haccp", "training", "season", "custom"]),
  language: z.string().default("no"),
  content_html: z.string().min(1),
  content_css: z.string().optional(),
  header_html: z.string().optional(),
  footer_html: z.string().optional(),
  accent_color: z.string().default("#FF6B35"),
  placeholders: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        source: z.enum([
          "workspace",
          "workspace.company",
          "subscription",
          "auto",
          "manual",
          "constant",
        ]),
        default_value: z.string().optional(),
        required: z.boolean().default(false),
      }),
    )
    .default([]),
  is_system: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const listTemplatesQuery = z.object({
  workspace_id: z.string().uuid().optional(),
  contract_type: z.string().optional(),
  language: z.string().optional(),
  is_system: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
});
```

**Step 2: Create template routes**

```typescript
import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuery,
} from "../schemas/templates.js";

export async function templateRoutes(app: FastifyInstance) {
  // List templates
  app.get("/templates", async (request, reply) => {
    const query = listTemplatesQuery.parse(request.query);
    let q = supabase.from("contract_template").select("*");

    if (query.workspace_id) q = q.eq("workspace_id", query.workspace_id);
    if (query.contract_type) q = q.eq("contract_type", query.contract_type);
    if (query.language) q = q.eq("language", query.language);
    if (query.is_system !== undefined) q = q.eq("is_system", query.is_system);
    if (query.is_active !== undefined) q = q.eq("is_active", query.is_active);

    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Get template by ID
  app.get("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase
      .from("contract_template")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return reply.status(404).send({ error: "Template not found" });
    return data;
  });

  // Create template
  app.post("/templates", async (request, reply) => {
    const body = createTemplateSchema.parse(request.body);
    const workspaceId = request.headers["x-workspace-id"] as string | undefined;

    const { data, error } = await supabase
      .from("contract_template")
      .insert({
        ...body,
        workspace_id: body.workspace_id ?? workspaceId ?? null,
      })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(data);
  });

  // Update template
  app.put("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTemplateSchema.parse(request.body);

    const { data, error } = await supabase
      .from("contract_template")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return data;
  });

  // Archive template (soft delete)
  app.delete("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { error } = await supabase
      .from("contract_template")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(204).send();
  });
}
```

**Step 3: Register routes in server.ts**

Add `import { templateRoutes } from './routes/templates.js';` and `app.register(templateRoutes);` before the start function.

**Step 4: Typecheck**

Run: `cd services/contract-service && npx tsc --noEmit`
Expected: No type errors.

**Step 5: Commit**

```bash
git add services/contract-service/src/
git commit -m "feat: add template CRUD routes to contract microservice

GET/POST/PUT/DELETE /templates with Zod validation.
Supports filtering by workspace, type, language, system flag."
```

---

### Task 7: Add DocuSeal template sync route

**Files:**

- Create: `services/contract-service/src/routes/sync.ts`
- Modify: `services/contract-service/src/server.ts`

**Step 1: Create sync route**

This pushes a Smartout template to DocuSeal as HTML, storing the returned DocuSeal template ID.

```typescript
import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import { docuseal } from "../lib/docuseal.js";

export async function syncRoutes(app: FastifyInstance) {
  // Sync template to DocuSeal
  app.post("/templates/:id/sync", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Fetch template
    const { data: template, error } = await supabase
      .from("contract_template")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    if (!template.content_html) {
      return reply.status(400).send({ error: "Template has no HTML content" });
    }

    try {
      // Build full HTML with header, content, footer
      const fullHtml = buildTemplateHtml(template);

      // Push to DocuSeal
      const dsTemplate = await docuseal.createTemplateFromHtml({
        html: fullHtml,
        name: `${template.name} (${template.language})`,
      });

      // Update Smartout record with DocuSeal ID
      await supabase
        .from("contract_template")
        .update({
          docuseal_template_id: dsTemplate.id,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return {
        template_id: id,
        docuseal_template_id: dsTemplate.id,
        synced_at: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "DocuSeal sync failed";
      return reply.status(502).send({ error: message });
    }
  });

  // Preview template as PDF (without creating DocuSeal template)
  app.post("/templates/:id/preview", async (request, reply) => {
    const { id } = request.params as { id: string };
    const overrides = (request.body as Record<string, string>) ?? {};

    const { data: template, error } = await supabase
      .from("contract_template")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    // Resolve placeholders with overrides
    let html = template.content_html ?? "";
    const placeholders =
      (template.placeholders as Array<{ key: string; default_value?: string }>) ?? [];

    for (const p of placeholders) {
      const value = overrides[p.key] ?? p.default_value ?? `[${p.key}]`;
      html = html.replace(new RegExp(`\\{\\{${p.key}\\}\\}`, "g"), value);
    }

    return { html, template_id: id };
  });
}

function buildTemplateHtml(template: {
  content_html: string | null;
  content_css: string | null;
  header_html: string | null;
  footer_html: string | null;
  accent_color: string | null;
}): string {
  const css = template.content_css ?? "";
  const accent = template.accent_color ?? "#FF6B35";

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <style>
    :root { --accent: ${accent}; --accent-light: ${accent}1a; }
    body { font-family: Inter, sans-serif; margin: 0; padding: 40px; color: #1a1a2e; }
    h1, h2, h3 { color: var(--accent); }
    .section-summary { color: #6b7280; font-style: italic; margin-bottom: 1em; }
    ${css}
  </style>
</head>
<body>
  ${template.header_html ?? ""}
  ${template.content_html ?? ""}
  ${template.footer_html ?? ""}
</body>
</html>`;
}
```

**Step 2: Register routes in server.ts**

Add `import { syncRoutes } from './routes/sync.js';` and `app.register(syncRoutes);`.

**Step 3: Typecheck**

Run: `cd services/contract-service && npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add services/contract-service/src/
git commit -m "feat: add DocuSeal template sync and preview routes

POST /templates/:id/sync pushes HTML to DocuSeal, stores template ID.
POST /templates/:id/preview resolves placeholders and returns HTML."
```

---

### Task 8: Add contract creation and sending routes

**Files:**

- Create: `services/contract-service/src/routes/contracts.ts`
- Create: `services/contract-service/src/schemas/contracts.ts`
- Create: `services/contract-service/src/lib/placeholders.ts`
- Modify: `services/contract-service/src/server.ts`

**Step 1: Create contract schemas**

```typescript
import { z } from "zod";

export const createContractSchema = z.object({
  template_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  contract_type: z
    .enum(["client", "employee", "haccp", "training", "season", "custom"])
    .default("client"),
  recipient_name: z.string().min(1),
  recipient_email: z.string().email(),
  journey_type: z.enum(["self_service", "sales_assisted"]).default("sales_assisted"),
  auto_create_workspace: z.boolean().default(false),
  value_overrides: z.record(z.string()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export const listContractsQuery = z.object({
  workspace_id: z.string().uuid().optional(),
  status: z.string().optional(),
  contract_type: z.string().optional(),
  recipient_email: z.string().optional(),
});
```

**Step 2: Create placeholder resolver**

```typescript
import { supabase } from "./supabase.js";
import { config } from "../config.js";

type PlaceholderDef = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

export async function resolvePlaceholders(
  html: string,
  placeholders: PlaceholderDef[],
  workspaceId: string,
  overrides: Record<string, string>,
): Promise<{ resolved_html: string; resolved_values: Record<string, string> }> {
  const values: Record<string, string> = {};

  // Fetch workspace data
  const { data: workspace } = await supabase
    .from("workspace")
    .select("*, company:company_id(*)")
    .eq("workspace_id", workspaceId)
    .single();

  for (const p of placeholders) {
    // Priority: override > source lookup > default
    if (overrides[p.key]) {
      values[p.key] = overrides[p.key];
      continue;
    }

    switch (p.source) {
      case "workspace":
        values[p.key] = resolveWorkspaceField(workspace, p.key) ?? p.default_value ?? "";
        break;
      case "workspace.company":
        values[p.key] = resolveCompanyField(workspace?.company, p.key) ?? p.default_value ?? "";
        break;
      case "constant":
        values[p.key] = resolveConstant(p.key) ?? p.default_value ?? "";
        break;
      case "auto":
        values[p.key] = resolveAuto(p.key);
        break;
      case "manual":
        values[p.key] = overrides[p.key] ?? p.default_value ?? "";
        break;
      default:
        values[p.key] = p.default_value ?? "";
    }
  }

  // Replace all placeholders in HTML
  let resolved = html;
  for (const [key, value] of Object.entries(values)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return { resolved_html: resolved, resolved_values: values };
}

function resolveWorkspaceField(
  workspace: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!workspace) return null;
  const fieldMap: Record<string, string> = {
    client_address: "address_line_1",
    client_postal_code: "postal_code",
    client_city: "city",
  };
  const field = fieldMap[key] ?? key;
  return workspace[field] as string | null;
}

function resolveCompanyField(company: Record<string, unknown> | null, key: string): string | null {
  if (!company) return null;
  const fieldMap: Record<string, string> = {
    client_company_name: "name",
    client_org_number: "org_number",
  };
  const field = fieldMap[key] ?? key;
  return company[field] as string | null;
}

function resolveConstant(key: string): string | null {
  const constants: Record<string, string> = {
    smartout_company_name: config.SMARTOUT_COMPANY_NAME,
    smartout_org_number: config.SMARTOUT_ORG_NUMBER,
    smartout_contact_email: config.SMARTOUT_CONTACT_EMAIL,
    smartout_contact_name: "Pontus Johansson",
  };
  return constants[key] ?? null;
}

function resolveAuto(key: string): string {
  switch (key) {
    case "contract_date":
      return new Date().toLocaleDateString("no-NO");
    case "effective_date":
      return new Date().toLocaleDateString("no-NO");
    case "contract_number":
      // Sequence will be called via SQL
      return `KONTRAKT-${new Date().getFullYear()}-PENDING`;
    default:
      return "";
  }
}
```

**Step 3: Create contract routes**

```typescript
import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import { docuseal } from "../lib/docuseal.js";
import { resolvePlaceholders } from "../lib/placeholders.js";
import { config } from "../config.js";
import { createContractSchema, listContractsQuery } from "../schemas/contracts.js";

export async function contractRoutes(app: FastifyInstance) {
  // List contracts
  app.get("/contracts", async (request, reply) => {
    const query = listContractsQuery.parse(request.query);
    let q = supabase.from("contract").select("*");

    if (query.workspace_id) q = q.eq("workspace_id", query.workspace_id);
    if (query.status) q = q.eq("status", query.status);
    if (query.contract_type) q = q.eq("contract_type", query.contract_type);
    if (query.recipient_email) q = q.eq("recipient_email", query.recipient_email);

    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Get contract with events
  app.get("/contracts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [contractResult, eventsResult] = await Promise.all([
      supabase.from("contract").select("*").eq("contract_id", id).single(),
      supabase.from("contract_event").select("*").eq("contract_id", id).order("created_at"),
    ]);

    if (contractResult.error) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    return { ...contractResult.data, events: eventsResult.data ?? [] };
  });

  // Create contract from template
  app.post("/contracts", async (request, reply) => {
    const body = createContractSchema.parse(request.body);

    // Fetch template
    const { data: template, error: tplErr } = await supabase
      .from("contract_template")
      .select("*")
      .eq("id", body.template_id)
      .single();

    if (tplErr || !template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    // Generate contract number
    const { data: numResult } = await supabase.rpc("generate_contract_number" as never);
    const contractNumber = (numResult as string) ?? `KONTRAKT-${new Date().getFullYear()}-000`;

    // Resolve placeholders
    const placeholders =
      (template.placeholders as Array<{
        key: string;
        label: string;
        source: string;
        default_value?: string;
        required: boolean;
      }>) ?? [];

    const { resolved_html, resolved_values } = await resolvePlaceholders(
      template.content_html ?? "",
      placeholders,
      body.workspace_id,
      { ...body.value_overrides, contract_number: contractNumber },
    );

    // Insert contract record
    const { data: contract, error: insertErr } = await supabase
      .from("contract")
      .insert({
        workspace_id: body.workspace_id,
        template_id: body.template_id,
        contract_type: body.contract_type,
        contract_number: contractNumber,
        title: `${template.name} - ${body.recipient_name}`,
        resolved_html,
        resolved_values,
        sender_name: config.SMARTOUT_COMPANY_NAME,
        sender_email: config.SMARTOUT_CONTACT_EMAIL,
        recipient_name: body.recipient_name,
        recipient_email: body.recipient_email,
        status: "draft",
        journey_type: body.journey_type,
        auto_create_workspace: body.auto_create_workspace,
        metadata: body.metadata,
      })
      .select()
      .single();

    if (insertErr) return reply.status(400).send({ error: insertErr.message });

    // Log creation event
    await supabase.from("contract_event").insert({
      contract_id: contract.contract_id,
      workspace_id: body.workspace_id,
      event_type: "created",
      actor_type: "user",
      actor_id: (request.headers["x-user-id"] as string) ?? "system",
    });

    return reply.status(201).send(contract);
  });

  // Send contract for signing
  app.post("/contracts/:id/send", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { data: contract, error } = await supabase
      .from("contract")
      .select("*, template:template_id(*)")
      .eq("contract_id", id)
      .single();

    if (error || !contract) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    if (contract.status !== "draft") {
      return reply
        .status(400)
        .send({ error: `Cannot send contract in status: ${contract.status}` });
    }

    try {
      // Build full HTML
      const fullHtml = `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><style>
body { font-family: Inter, sans-serif; padding: 40px; }
</style></head>
<body>${contract.resolved_html}</body>
</html>`;

      // Create DocuSeal template from resolved HTML
      const dsTemplate = await docuseal.createTemplateFromHtml({
        html: fullHtml,
        name: contract.title ?? "Smartout Contract",
      });

      // Create submission with two parties
      const submission = await docuseal.createSubmission({
        template_id: dsTemplate.id,
        send_email: true,
        submitters: [
          {
            role: "Leverandør",
            email: contract.sender_email,
            completed: true, // Auto-sign Smartout party
          },
          {
            role: "Kunde",
            email: contract.recipient_email,
          },
        ],
      });

      // Extract signing URL for the client submitter
      const clientSubmitter = Array.isArray(submission)
        ? submission.find((s: { role: string }) => s.role === "Kunde")
        : null;

      const signingUrl = clientSubmitter?.embed_src ?? clientSubmitter?.slug ?? null;

      // Update contract record
      await supabase
        .from("contract")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          docuseal_submission_id: String(submission[0]?.submission_id ?? dsTemplate.id),
          docuseal_submitter_id: clientSubmitter?.id ?? null,
          signing_url: signingUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_id", id);

      // Log sent event
      await supabase.from("contract_event").insert({
        contract_id: id,
        workspace_id: contract.workspace_id,
        event_type: "sent",
        actor_type: "user",
        actor_id: (request.headers["x-user-id"] as string) ?? "system",
        details: { docuseal_template_id: dsTemplate.id },
      });

      return {
        contract_id: id,
        status: "sent",
        signing_url: signingUrl,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send contract";
      return reply.status(502).send({ error: message });
    }
  });

  // Cancel contract
  app.post("/contracts/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { data: contract, error } = await supabase
      .from("contract")
      .select("contract_id, status, workspace_id")
      .eq("contract_id", id)
      .single();

    if (error || !contract) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    const cancellable = ["draft", "sent", "viewed"];
    if (!cancellable.includes(contract.status)) {
      return reply
        .status(400)
        .send({ error: `Cannot cancel contract in status: ${contract.status}` });
    }

    await supabase
      .from("contract")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("contract_id", id);

    // Cancel pending reminders
    await supabase
      .from("contract_reminder")
      .update({ status: "skipped", skip_reason: "contract_cancelled" })
      .eq("contract_id", id)
      .eq("status", "scheduled");

    // Log cancellation
    await supabase.from("contract_event").insert({
      contract_id: id,
      workspace_id: contract.workspace_id,
      event_type: "cancelled",
      actor_type: "user",
      actor_id: (request.headers["x-user-id"] as string) ?? "system",
    });

    return { contract_id: id, status: "cancelled" };
  });

  // Get contract events (audit trail)
  app.get("/contracts/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase
      .from("contract_event")
      .select("*")
      .eq("contract_id", id)
      .order("created_at");

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });
}
```

**Step 4: Register routes in server.ts**

Add `import { contractRoutes } from './routes/contracts.js';` and `app.register(contractRoutes);`.

**Step 5: Typecheck**

Run: `cd services/contract-service && npx tsc --noEmit`
Expected: No type errors (may have some due to DocuSeal API type mismatches — fix as needed).

**Step 6: Commit**

```bash
git add services/contract-service/src/
git commit -m "feat: add contract CRUD, send, and cancel routes

POST /contracts creates from template with placeholder resolution.
POST /contracts/:id/send pushes to DocuSeal and returns signing URL.
POST /contracts/:id/cancel with reminder cancellation.
GET /contracts/:id/events for audit trail."
```

---

### Task 9: Add webhook route to microservice

**Files:**

- Create: `services/contract-service/src/routes/webhooks.ts`
- Modify: `services/contract-service/src/server.ts`

**Step 1: Create webhook handler**

Move webhook logic from the Next.js app to the microservice. The Next.js route will proxy to this.

```typescript
import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import { config } from "../config.js";

type WebhookPayload = {
  event_type: string;
  timestamp: string;
  data: {
    id: number;
    submission_id: number;
    email: string;
    role: string;
    status: string;
    completed_at?: string;
    declined_at?: string;
    decline_reason?: string;
    documents?: Array<{ url: string; filename: string }>;
    submitters?: Array<{
      id: number;
      email: string;
      role: string;
      completed_at?: string;
      name?: string;
    }>;
    values?: Array<{ field: string; value: string }>;
  };
};

const STATUS_WEIGHT: Record<string, number> = {
  draft: 0,
  sent: 1,
  viewed: 2,
  signed: 3,
  expired: 3,
  cancelled: 3,
  declined: 3,
};

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/docuseal", async (request, reply) => {
    // Verify shared secret
    const secret = request.headers["x-docuseal-secret"] ?? request.headers["x-docuseal-signature"];
    if (secret !== config.DOCUSEAL_WEBHOOK_SECRET) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { event_type, data } = request.body as WebhookPayload;

    // Map DocuSeal events to contract statuses
    const eventToStatus: Record<string, string> = {
      "form.viewed": "viewed",
      "form.started": "viewed",
      "form.completed": "signed",
      "form.declined": "declined",
      "submission.completed": "signed",
      "submission.expired": "expired",
    };

    const newStatus = eventToStatus[event_type];
    if (!newStatus) {
      return { received: true, event_type, action: "ignored" };
    }

    // Find contract by DocuSeal submission ID
    const { data: contract, error } = await supabase
      .from("contract")
      .select("contract_id, status, workspace_id")
      .eq("docuseal_submission_id", String(data.submission_id))
      .single();

    if (error || !contract) {
      app.log.warn(`No contract found for submission ${data.submission_id}`);
      return reply.status(404).send({ error: "Contract not found" });
    }

    // Prevent status regression (Learning L-0004)
    const currentWeight = STATUS_WEIGHT[contract.status] ?? 0;
    const newWeight = STATUS_WEIGHT[newStatus] ?? 0;
    if (newWeight <= currentWeight) {
      return { received: true, action: "skipped", reason: "status_not_advanced" };
    }

    // Build update payload
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (event_type === "form.viewed") {
      updates.viewed_at = new Date().toISOString();
    }

    if (newStatus === "signed") {
      updates.signed_at = data.completed_at ?? new Date().toISOString();
      if (data.documents?.[0]?.url) {
        updates.signed_pdf_url = data.documents[0].url;
      }
    }

    if (newStatus === "declined") {
      updates.declined_at = data.declined_at ?? new Date().toISOString();
      updates.decline_reason = data.decline_reason ?? null;
    }

    // Update contract
    await supabase.from("contract").update(updates).eq("contract_id", contract.contract_id);

    // Log event
    await supabase.from("contract_event").insert({
      contract_id: contract.contract_id,
      workspace_id: contract.workspace_id,
      event_type: event_type.replace(".", "_"),
      actor_type: "webhook",
      details: {
        docuseal_event: event_type,
        submitter_email: data.email,
        submitter_role: data.role,
      },
      ip_address: request.ip,
    });

    // On signing: cancel pending reminders + update workspace
    if (newStatus === "signed") {
      await Promise.all([
        // Cancel reminders
        supabase
          .from("contract_reminder")
          .update({ status: "skipped", skip_reason: "contract_signed" })
          .eq("contract_id", contract.contract_id)
          .eq("status", "scheduled"),

        // Update workspace contract status
        supabase
          .from("workspace")
          .update({
            contract_status: "active",
            active_contract_id: contract.contract_id,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", contract.workspace_id),
      ]);
    }

    return { received: true, contract_id: contract.contract_id, new_status: newStatus };
  });
}
```

**Step 2: Register in server.ts**

Add `import { webhookRoutes } from './routes/webhooks.js';` and `app.register(webhookRoutes);`.

**Step 3: Typecheck**

Run: `cd services/contract-service && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add services/contract-service/src/
git commit -m "feat: add DocuSeal webhook handler to contract microservice

Processes form.viewed, form.completed, form.declined, submission.completed.
Status regression guard (L-0004). Cancels reminders on signing.
Updates workspace contract_status to 'active' on client signing."
```

---

## Phase 3: Signing Page & Client Journeys

### Task 10: Install @docuseal/react and create signing page

**Files:**

- Create: `apps/web/src/app/sign/[token]/page.tsx`
- Create: `apps/web/src/app/sign/[token]/layout.tsx`
- Modify: `apps/web/package.json` (add @docuseal/react)

**Step 1: Install @docuseal/react**

Run: `cd apps/web && pnpm add @docuseal/react`

**Step 2: Create signing page layout (full-screen, no dashboard chrome)**

```typescript
// apps/web/src/app/sign/[token]/layout.tsx
export default function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
```

**Step 3: Create the signing page**

Server component that fetches contract data, then renders embedded DocusealForm client component.

```typescript
// apps/web/src/app/sign/[token]/page.tsx
import { notFound } from 'next/navigation';
import { createServerClient } from '@smartout/supabase/server';
import { SigningForm } from './signing-form';

type Props = { params: Promise<{ token: string }> };

export default async function SignPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createServerClient();

  // Look up contract by signing URL token
  const { data: contract } = await supabase
    .from('contract')
    .select('contract_id, title, signing_url, recipient_email, recipient_name, status, sender_name')
    .eq('signing_url', token)
    .single();

  if (!contract || !contract.signing_url) notFound();

  // Already signed or expired
  if (['signed', 'expired', 'cancelled', 'declined'].includes(contract.status)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {contract.status === 'signed' ? 'Avtalen er signert' : 'Avtalen er ikke lenger tilgjengelig'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {contract.status === 'signed'
              ? 'Du har allerede signert denne avtalen. Sjekk e-posten din for en kopi.'
              : 'Kontakt oss hvis du har spørsmål.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <SigningForm
      signingUrl={contract.signing_url}
      recipientEmail={contract.recipient_email ?? ''}
      contractTitle={contract.title ?? 'Avtale'}
    />
  );
}
```

**Step 4: Create client-side signing form component**

```typescript
// apps/web/src/app/sign/[token]/signing-form.tsx
'use client';

import { DocusealForm } from '@docuseal/react';

type Props = {
  signingUrl: string;
  recipientEmail: string;
  contractTitle: string;
};

export function SigningForm({ signingUrl, recipientEmail, contractTitle }: Props) {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-6 text-center">
        <img src="/logo.png" alt="Smartout" className="mx-auto h-8" />
        <h1 className="mt-4 text-xl font-semibold">{contractTitle}</h1>
      </div>
      <DocusealForm
        src={signingUrl}
        email={recipientEmail}
        logo="https://smartout.io/logo.png"
        backgroundColor="#f9fafb"
        withDecline={true}
        withDownloadButton={true}
        language="no"
        onComplete={(data) => {
          // Redirect to success page
          window.location.href = '/sign/success';
        }}
        onDecline={(data) => {
          window.location.href = '/sign/declined';
        }}
      />
    </div>
  );
}
```

**Step 5: Create success/declined pages**

Simple static pages for post-signing feedback.

**Step 6: Typecheck**

Run: `pnpm --filter web typecheck`

**Step 7: Commit**

```bash
git add apps/web/src/app/sign/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add embedded contract signing page

/sign/[token] renders DocusealForm with Smartout branding.
Handles signed, expired, cancelled, declined states.
Norwegian language, decline option, PDF download."
```

---

### Task 11: Add admin contract creation UI

**Files:**

- Create: `apps/web/src/app/(platform-admin)/platform-admin/contracts/new/page.tsx`
- Modify: `apps/web/src/app/(platform-admin)/platform-admin/contracts/page.tsx`

**Step 1: Read existing contracts page**

Understand current layout/patterns.

**Step 2: Create the "new contract" form page**

A form that:

1. Selects a template
2. Enters recipient details (or Brreg lookup)
3. Selects workspace (existing or new)
4. Previews resolved HTML
5. Sends via microservice API

Use shadcn/ui form components (input, select, button, card).

**Step 3: Add "Ny kontrakt" button to contracts listing page**

Add a Link button at the top of the existing contracts table.

**Step 4: Create API route to proxy to microservice**

Create `apps/web/src/app/api/platform-admin/contracts/route.ts` that forwards to the contract microservice with the service key.

**Step 5: Typecheck**

Run: `pnpm --filter web typecheck`

**Step 6: Commit**

```bash
git add apps/web/src/app/(platform-admin)/platform-admin/contracts/ apps/web/src/app/api/platform-admin/contracts/
git commit -m "feat: add admin contract creation UI

New contract form with template selection, recipient details, preview.
Proxies to contract microservice for creation and sending."
```

---

## Phase 4: Workspace State Machine & Reminders

### Task 12: Implement workspace access middleware

**Files:**

- Modify: `apps/web/src/middleware.ts`

**Step 1: Read existing middleware**

Understand current auth flow.

**Step 2: Add workspace contract_status check**

After auth, fetch the user's active workspace `contract_status`. If `suspended` → redirect to read-only mode or signing prompt. If `deactivated` → redirect to blocked page.

Access control matrix (from spec Section 7.3):

- `setup` → Setup wizard only
- `pending_contract` / `trial` → Full access (trial countdown banner)
- `active` → Full access
- `suspended` → Read-only (sign-only admin)
- `deactivated` → No access (redirect to blocked page)

**Step 3: Create trial banner component**

A dismissible banner showing trial days remaining, linked to signing page.

**Step 4: Typecheck + test middleware locally**

Run: `pnpm --filter web typecheck`

**Step 5: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/components/
git commit -m "feat: add workspace contract_status access control

Middleware checks contract_status for suspended/deactivated.
Trial countdown banner for pending_contract workspaces."
```

---

### Task 13: Add reminder scheduling to contract creation

**Files:**

- Modify: `services/contract-service/src/routes/contracts.ts`
- Create: `services/contract-service/src/lib/reminders.ts`

**Step 1: Create reminder scheduler**

When a contract is created/sent, schedule the appropriate reminder sequence based on `journey_type` (self_service vs sales_assisted) using the `contract_reminder` table.

```typescript
// services/contract-service/src/lib/reminders.ts
import { supabase } from "./supabase.js";

type ReminderSchedule = {
  day_offset: number;
  template_key: string;
  reminder_type: "email" | "sms";
};

const SELF_SERVICE_SCHEDULE: ReminderSchedule[] = [
  { day_offset: 0, template_key: "contract.welcome", reminder_type: "email" },
  { day_offset: 3, template_key: "contract.reminder.day3", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "sms" },
  { day_offset: 10, template_key: "contract.reminder.day10", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "sms" },
  { day_offset: 21, template_key: "contract.deletion.warning", reminder_type: "email" },
  { day_offset: 21, template_key: "contract.deletion.warning", reminder_type: "sms" },
];

const SALES_ASSISTED_SCHEDULE: ReminderSchedule[] = [
  { day_offset: 0, template_key: "contract.sales.sent", reminder_type: "email" },
  { day_offset: 3, template_key: "contract.sales.reminder.day3", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "sms" },
  { day_offset: 10, template_key: "contract.reminder.day10", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "sms" },
];

export async function scheduleReminders(
  contractId: string,
  workspaceId: string,
  journeyType: string,
  sentAt: Date,
  language: string = "no",
) {
  const schedule = journeyType === "self_service" ? SELF_SERVICE_SCHEDULE : SALES_ASSISTED_SCHEDULE;

  const reminders = schedule.map((r) => ({
    contract_id: contractId,
    workspace_id: workspaceId,
    reminder_type: r.reminder_type,
    template_key: r.template_key,
    language,
    scheduled_at: new Date(sentAt.getTime() + r.day_offset * 24 * 60 * 60 * 1000).toISOString(),
    status: r.day_offset === 0 ? "sent" : "scheduled", // Day 0 is sent immediately
  }));

  const { error } = await supabase.from("contract_reminder").insert(reminders);
  if (error) {
    console.error("Failed to schedule reminders:", error.message);
  }
}
```

**Step 2: Call scheduleReminders when contract is sent**

In the `/contracts/:id/send` route, after successful DocuSeal submission, call `scheduleReminders()`.

**Step 3: Typecheck**

Run: `cd services/contract-service && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add services/contract-service/src/
git commit -m "feat: add reminder scheduling to contract sending flow

Schedules email + SMS reminders based on journey type.
Self-service: day 0,3,7,10,13,21 sequence.
Sales-assisted: day 0,3,7,10,13 sequence."
```

---

### Task 14: Create daily cron for contract lifecycle

**Files:**

- Create: `supabase/functions/contract-lifecycle/index.ts`

**Step 1: Create Edge Function for daily cron**

Runs daily at 06:00 CET. Checks for:

1. Trial expirations → workspace status: `suspended`
2. Grace period expirations → workspace status: `deactivated`
3. Contract expirations (14-day signing deadline)
4. Pending reminders that need sending

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const results: Record<string, number> = {};

  // 1. Trial expirations → suspended
  const { data: expiredTrials } = await supabase
    .from("workspace")
    .select("workspace_id")
    .eq("contract_status", "pending_contract")
    .lt("trial_ends_at", now)
    .is("override_access", false);

  if (expiredTrials?.length) {
    await supabase
      .from("workspace")
      .update({
        contract_status: "suspended",
        suspended_at: now,
        grace_period_ends: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: now,
      })
      .in(
        "workspace_id",
        expiredTrials.map((w) => w.workspace_id),
      );
    results.trials_expired = expiredTrials.length;
  }

  // 2. Grace period expirations → deactivated
  const { data: expiredGrace } = await supabase
    .from("workspace")
    .select("workspace_id")
    .eq("contract_status", "suspended")
    .lt("grace_period_ends", now)
    .is("override_access", false);

  if (expiredGrace?.length) {
    await supabase
      .from("workspace")
      .update({
        contract_status: "deactivated",
        deactivated_at: now,
        updated_at: now,
      })
      .in(
        "workspace_id",
        expiredGrace.map((w) => w.workspace_id),
      );
    results.grace_expired = expiredGrace.length;
  }

  // 3. Contract signing deadline expirations
  const { data: expiredContracts } = await supabase
    .from("contract")
    .select("contract_id")
    .in("status", ["sent", "viewed"])
    .lt("expires_at", now);

  if (expiredContracts?.length) {
    const ids = expiredContracts.map((c) => c.contract_id);
    await supabase
      .from("contract")
      .update({ status: "expired", updated_at: now })
      .in("contract_id", ids);

    // Cancel their reminders
    await supabase
      .from("contract_reminder")
      .update({ status: "skipped", skip_reason: "contract_expired" })
      .in("contract_id", ids)
      .eq("status", "scheduled");

    results.contracts_expired = expiredContracts.length;
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed_at: now,
      results,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
```

**Step 2: Add to supabase config for cron scheduling**

Note: Actual cron scheduling requires `pg_cron` or an external scheduler (n8n). Document the cron setup in the function's README.

**Step 3: Commit**

```bash
git add supabase/functions/contract-lifecycle/
git commit -m "feat: add contract lifecycle Edge Function

Daily cron processes trial expirations, grace period expirations,
and contract signing deadline expirations. Updates workspace status
and cancels stale reminders."
```

---

## Phase 5: AI Template Creator (High-Level)

> This phase builds the Tiptap-based contract template editor with AI assistance.
> Detailed task breakdown should be created when Phase 1-4 are complete.

### Task 15: Install Tiptap and create editor scaffold

**Files:**

- Install: `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit` in `apps/web`
- Create: `apps/web/src/app/(platform-admin)/platform-admin/contracts/templates/[id]/edit/page.tsx`
- Create: `apps/web/src/components/contract-editor/contract-editor.tsx`
- Create: `apps/web/src/components/contract-editor/toolbar.tsx`

Split-view layout: Tiptap editor (70%) + AI chat panel (30%). Basic text editing with toolbar. No AI tools yet.

---

### Task 16: Create custom Tiptap extensions

**Files:**

- Create: `apps/web/src/components/contract-editor/extensions/clause-block.ts`
- Create: `apps/web/src/components/contract-editor/extensions/placeholder-field.ts`
- Create: `apps/web/src/components/contract-editor/extensions/signature-field.ts`
- Create: `apps/web/src/components/contract-editor/extensions/section-summary.ts`

Extensions per architecture spec Section 5.3:

- `ClauseBlock` — Draggable section with title, summary, drag handle
- `PlaceholderField` — Inline `{{placeholder}}` rendered as colored chip
- `SignatureField` — Maps to DocuSeal signature fields
- `SectionSummary` — One-line summary per section

---

### Task 17: Build AI agent tools (document editing)

**Files:**

- Create: `packages/ai/src/tools/contract/` directory
- Create: Individual tool files for read_document, replace_section, insert_section, remove_section, edit_text, reorder_sections

18 tools total per architecture spec Section 5.4. Build in batches:

1. Reading tools (read_document, read_placeholders)
2. Editing tools (replace_section, insert_section, remove_section, edit_text, reorder_sections)
3. Design tools (highlight_text, apply_design, add_image)
4. Field tools (add_placeholder, add_signature_field)
5. Translation tools (translate_section, translate_document)
6. Validation tools (validate_contract, summarize_contract, generate_preview)
7. Library tools (search_clauses)

---

### Task 18: Wire AI chat panel to contract agent

**Files:**

- Create: `apps/web/src/app/api/contract-agent/route.ts`
- Modify: `apps/web/src/components/contract-editor/contract-editor.tsx`

API route that runs the contract template agent with Vercel AI SDK 6. Chat panel streams responses and applies tool results to the Tiptap editor with diff visualization.

---

### Task 19: Add diff visualization with accept/reject

**Files:**

- Modify: `apps/web/src/components/contract-editor/contract-editor.tsx`
- Create: `apps/web/src/components/contract-editor/diff-overlay.tsx`

When AI proposes changes:

- Red background + strikethrough for deletions
- Green background for insertions
- `[Godta] [Avvis] [Diskuter]` buttons per changed section

---

## Phase 6: Admin Dashboard Enhancement (High-Level)

### Task 20: Enhance contracts listing with actions

**Files:**

- Modify: `apps/web/src/app/(platform-admin)/platform-admin/contracts/page.tsx`
- Create: `apps/web/src/app/(platform-admin)/platform-admin/contracts/[id]/page.tsx`

Add to listing:

- Action buttons: Preview, Send reminder, Cancel, Download PDF
- Filter by status, date range, contract type
- Search by company name or recipient email

Contract detail page:

- Contract info card
- Event timeline (from contract_event table)
- Reminder schedule (from contract_reminder table)
- Actions: extend deadline, resend, cancel, override workspace access

---

### Task 21: Seed clause library with V1 Norwegian content

**Files:**

- Create: `supabase/migrations/20260228150000_seed_clause_library.sql`

Insert the 12 pre-built clause blocks from architecture spec Section 11.3:
Parter, Tjenestebeskrivelse, Betaling, Varighet, Data & GDPR, Konfidensialitet, Ansvar, IP, Force Majeure, Endringer, Tvister, Underskrifter.

Both Norwegian and English versions.

---

### Task 22: Write ADR for contract system

**Files:**

- Create: `docs/decisions/0021-contract-system-architecture.md`
- Modify: `docs/decisions/0000-decision-log.md`

Document decisions:

- DocuSeal Cloud over self-hosted
- Standalone microservice over Edge Functions
- Tiptap editor over DocuSeal builder
- HTML content format
- Embedded signing in Smartout
- Table rename strategy (platform*contract*\_ → contract\_\_)

---

## ADR & Documentation Tasks

### Task 23: Update CLAUDE.md with contract system additions

**Files:**

- Modify: `CLAUDE.md`

Add to relevant sections:

- New tables: contract_event, contract_reminder, message_template, clause_library
- Renamed tables: platform_contract_template → contract_template, platform_contract_instance → contract
- New workspace columns (contract*status, trial*\*, etc.)
- New service: services/contract-service/ (port 3100)
- New routes: /sign/[token], /api/platform-admin/contracts/
- New env vars: SERVICE_KEY, DOCUSEAL_API_KEY, DOCUSEAL_API_URL
- New Edge Function: contract-lifecycle
- ADR-0021 entry

---

## Dependency Graph

```
Task 1 (migration) ──────────────┬──→ Task 2 (webhook update)
                                 ├──→ Task 3 (admin page update)
                                 ├──→ Task 4 (message templates)
                                 └──→ Task 5 (microservice scaffold)
                                        │
Task 5 ──→ Task 6 (template routes)
       ──→ Task 7 (sync routes)
       ──→ Task 8 (contract routes) ──→ Task 9 (webhook routes)
                                        │
Task 8 ──→ Task 10 (signing page)
       ──→ Task 11 (admin creation UI)
       ──→ Task 13 (reminder scheduling)
                                        │
Task 12 (middleware) ← depends on Task 1
Task 14 (lifecycle cron) ← depends on Task 1
                                        │
Tasks 15-19 (AI editor) ← depends on Tasks 1-9
Tasks 20-21 (admin dashboard) ← depends on Tasks 1-11
Tasks 22-23 (docs) ← do last, after implementation
```

## Implementation Notes

- **Existing `contract_status` enum (migration 00012):** DO NOT reuse. The workspace `contract_status` column uses plain text, not the enum. The enum belongs to `employment_contract` only.
- **Table rename caution:** Migration 00013's `platform_contract_template` and `platform_contract_instance` are renamed in Task 1. Any other code referencing these old names must be updated (Tasks 2, 3).
- **DocuSeal API types:** The `@docuseal/api` TypeScript SDK may have incomplete types. Use `as unknown` casts where needed and document in a learning record.
- **Service-to-service auth:** The microservice uses a shared `X-Service-Key` header. Store in 1Password, inject via `op run`. Never commit to code.
- **PDF storage:** Signed PDFs should eventually be downloaded from DocuSeal and stored in Supabase Storage at `/{workspace_id}/contracts/{contract_id}/signed.pdf`. Initial implementation stores the DocuSeal URL only.
