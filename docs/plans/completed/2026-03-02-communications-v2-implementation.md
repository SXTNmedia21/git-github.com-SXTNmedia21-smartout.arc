---
title: Communications Module v2 — Implementation Plan
status: in_progress
updated: 2026-03-02
created: 2026-03-02
module: communications
tags: [email, sendgrid, tiptap, ai, i18n, webhooks, platform-admin]
---

# Communications Module v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the platform communications system with SendGrid dynamic templates, rich text editing (Tiptap), AI text correction, multilingual sending, and read receipt tracking via SendGrid webhooks.

**Architecture:** The existing `@smartout/notifications` package and SendGrid adapter remain the foundation. We add a new "dynamic template" sending path alongside the existing inline HTML templates. The compose UI becomes a structured form that maps to SendGrid Handlebars variables. AI features use OpenRouter via Vault. SendGrid webhooks feed delivery/engagement data back into the recipient table.

**Tech Stack:** SendGrid Dynamic Templates API + Tiptap v3 (already installed) + OpenRouter (AI) + Supabase Edge Functions (webhook receiver)

**Open Questions — Resolved:**

| Question             | Decision                                   | Rationale                                              |
| -------------------- | ------------------------------------------ | ------------------------------------------------------ |
| SendGrid vs Resend?  | **Keep SendGrid**                          | Already integrated, working, dynamic templates support |
| Rich Text editor?    | **Tiptap**                                 | Already installed (v3.20.0), used in contract editor   |
| AI correction scope? | **Grammar + tone + professional**          | OpenRouter via `getServiceKey('openrouter')`           |
| Languages?           | **Norwegian + English**                    | Match existing i18n, expand later                      |
| Footer config?       | **Per-send with workspace defaults**       | Max flexibility                                        |
| Webhook events?      | **opened, clicked, bounced, unsubscribed** | Standard SendGrid events                               |
| Builder type?        | **Fixed structure** (not drag-and-drop)    | Matches SendGrid template, YAGNI                       |
| Template preview?    | **HTML preview iframe with sample data**   | Quick to implement                                     |

---

## Existing Code Map

| Component                    | Path                                                                                   | What It Does                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Communications page          | `apps/web/src/app/platform-admin/communications/page.tsx`                              | Server component, fetches history                              |
| Communications client        | `apps/web/src/app/platform-admin/communications/_components/communications-client.tsx` | Quick Send buttons + History table                             |
| Compose sheet                | `apps/web/src/components/platform-admin/compose-email-sheet.tsx`                       | Side-sheet with audience, template, subject, markdown textarea |
| Audience selector            | `apps/web/src/components/platform-admin/audience-selector.tsx`                         | Discriminated union audience picker                            |
| Type-to-confirm              | `apps/web/src/components/platform-admin/type-to-confirm.tsx`                           | Large audience confirmation                                    |
| Confirmation dialog          | `apps/web/src/components/platform-admin/confirmation-dialog.tsx`                       | Send confirmation                                              |
| Send API                     | `apps/web/src/app/api/platform-admin/communications/send/route.ts`                     | POST — validate, resolve, send                                 |
| Dry-run API                  | `apps/web/src/app/api/platform-admin/communications/dry-run/route.ts`                  | POST — preview recipients                                      |
| History API                  | `apps/web/src/app/api/platform-admin/communications/history/route.ts`                  | GET — paginated history                                        |
| Job status API               | `apps/web/src/app/api/platform-admin/communications/[jobId]/route.ts`                  | GET — job details                                              |
| Notifications types          | `packages/notifications/src/types.ts`                                                  | EmailTemplate, AudienceFilter, etc.                            |
| Email service                | `packages/notifications/src/email-service.ts`                                          | createEmailJob orchestrator                                    |
| SendGrid adapter             | `packages/notifications/src/sendgrid.ts`                                               | sendEmailBatch with retry                                      |
| Templates                    | `packages/notifications/src/templates.ts`                                              | 5 inline HTML templates                                        |
| Compliance                   | `packages/notifications/src/compliance.ts`                                             | Classification, suppression, senders                           |
| Audiences                    | `packages/notifications/src/audiences.ts`                                              | Audience resolution                                            |
| Rate limiting                | `packages/notifications/src/rate-limit.ts`                                             | Per-admin + global limits                                      |
| Kill switch                  | `packages/notifications/src/kill-switch.ts`                                            | Feature flag                                                   |
| Contract editor (Tiptap ref) | `apps/web/src/components/contract-editor/contract-editor.tsx`                          | Reference for Tiptap setup                                     |
| Vault helper                 | `packages/supabase/src/vault.ts`                                                       | getServiceKey for external secrets                             |
| DB migration                 | `supabase/migrations/20260228120000_platform_communications.sql`                       | 3 tables: log, recipient, suppression                          |

---

## Task 1: Database Schema — Tracking & Template Support

**Goal:** Add columns for SendGrid template data and engagement tracking. Add webhook event table.

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_communications_v2.sql`

**Step 1: Write the migration**

```sql
-- Communications v2: template data + engagement tracking + webhook events

-- 1. Add SendGrid template columns to platform_communication_log
ALTER TABLE platform_communication_log
  ADD COLUMN IF NOT EXISTS sendgrid_template_id text,
  ADD COLUMN IF NOT EXISTS template_data jsonb,
  ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN platform_communication_log.sendgrid_template_id IS 'SendGrid dynamic template ID (d-xxxx)';
COMMENT ON COLUMN platform_communication_log.template_data IS 'Handlebars variables sent to SendGrid template';
COMMENT ON COLUMN platform_communication_log.opened_count IS 'Aggregated open count from webhook events';
COMMENT ON COLUMN platform_communication_log.clicked_count IS 'Aggregated click count from webhook events';

-- 2. Add engagement tracking to platform_communication_recipient
ALTER TABLE platform_communication_recipient
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- 3. Webhook event log for audit trail
CREATE TABLE IF NOT EXISTS platform_webhook_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'sendgrid',
  event_type text NOT NULL,
  email text NOT NULL,
  communication_id uuid REFERENCES platform_communication_log(communication_id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES platform_communication_recipient(recipient_id) ON DELETE SET NULL,
  raw_payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_communication
  ON platform_webhook_event(communication_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_email
  ON platform_webhook_event(email);
CREATE INDEX IF NOT EXISTS idx_webhook_event_type
  ON platform_webhook_event(event_type);

COMMENT ON TABLE platform_webhook_event IS 'Inbound webhook events from SendGrid (opens, clicks, bounces, unsubscribes)';
```

**Step 2: Apply the migration**

Run: `npx supabase migration new communications_v2`

Then paste the SQL into the generated file.

Run: `npx supabase db reset` (local only) to apply.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Verify types include new columns**

Open `packages/supabase/src/database.types.ts` and search for `sendgrid_template_id`, `opened_at`, `platform_webhook_event`.

**Step 5: Commit**

```bash
git add supabase/migrations/ packages/supabase/src/database.types.ts
git commit -m "feat(communications): add v2 schema — template data, tracking, webhook events"
```

---

## Task 2: SendGrid Dynamic Template Support

**Goal:** Update the notifications package to support sending via SendGrid dynamic templates (template_id + dynamic_template_data) alongside existing inline HTML templates.

**Files:**

- Modify: `packages/notifications/src/types.ts`
- Modify: `packages/notifications/src/sendgrid.ts`
- Modify: `packages/notifications/src/email-service.ts`
- Modify: `packages/notifications/src/compliance.ts`

### Step 1: Update types

Add to `packages/notifications/src/types.ts`:

```typescript
// Add "sendgrid-dynamic" as a template option
export type EmailTemplate =
  | "platform-announcement"
  | "workspace-notification"
  | "trial-reminder"
  | "payment-reminder"
  | "contract-reminder"
  | "sendgrid-dynamic";

// SendGrid dynamic template data matching Handlebars variables
export type SendGridTemplateData = {
  header: string;
  recipient?: string; // Auto-filled per recipient
  main_title?: string;
  message?: string;
  subTitle?: string;
  message2?: string;
  items?: Array<{
    image?: string;
    title: string;
    description?: string;
    benefits?: string[];
    link?: string;
  }>;
  linkText?: string;
  link?: string;
  footer_title?: string;
  footer_message?: string;
  hero_image?: string;
};

// Update EmailJobOptions to support dynamic templates
export type EmailJobOptions = {
  template: EmailTemplate;
  variables: Record<string, string>;
  audience: AudienceFilter;
  fromEmail?: string;
  adminId: string;
  // New: SendGrid dynamic template fields
  sendgridTemplateId?: string;
  templateData?: SendGridTemplateData;
};
```

### Step 2: Update SendGrid adapter

Add a new function to `packages/notifications/src/sendgrid.ts`:

```typescript
type DynamicTemplateMessage = {
  to: string;
  from: string;
  templateId: string;
  dynamicTemplateData: Record<string, unknown>;
};

export async function sendDynamicTemplateBatch(
  recipients: Array<{
    email: string;
    templateId: string;
    dynamicTemplateData: Record<string, unknown>;
  }>,
  fromEmail: string = DEFAULT_FROM,
): Promise<SendEmailResult> {
  const client = getSendGridClient();

  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const messages: DynamicTemplateMessage[] = batch.map((r) => ({
      to: r.email,
      from: fromEmail,
      templateId: r.templateId,
      dynamicTemplateData: r.dynamicTemplateData,
    }));

    // SendGrid accepts templateId + dynamic_template_data per message
    for (const msg of messages) {
      let lastError: unknown;
      let success = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await client.send({
            to: msg.to,
            from: msg.from,
            templateId: msg.templateId,
            dynamicTemplateData: msg.dynamicTemplateData,
          } as Parameters<typeof client.send>[0]);
          totalSent++;
          success = true;
          break;
        } catch (err: unknown) {
          lastError = err;
          if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          break;
        }
      }

      if (!success) {
        const errorMsg = lastError instanceof Error ? lastError.message : "Unknown send error";
        allErrors.push({ email: msg.to, error: errorMsg });
        totalFailed++;
      }
    }
  }

  return { sent: totalSent, failed: totalFailed, errors: allErrors };
}
```

### Step 3: Update email-service.ts

In `processEmailBatches`, add a branch for dynamic template mode:

```typescript
// Inside createEmailJob, after audience resolution:
if (opts.template === "sendgrid-dynamic" && opts.sendgridTemplateId && opts.templateData) {
  const result = await processDynamicTemplateBatches(
    activeRecipients.map((r) => ({
      email: r.email,
      name: r.name,
      locale: r.locale,
    })),
    opts.sendgridTemplateId,
    opts.templateData,
    fromEmail,
  );
  // ... set job stats from result
}
```

Add `processDynamicTemplateBatches` function:

```typescript
async function processDynamicTemplateBatches(
  recipients: Array<{ email: string; name: string; locale: string }>,
  templateId: string,
  templateData: SendGridTemplateData,
  fromEmail: string,
): Promise<SendEmailResult> {
  const emailsToSend = recipients.map((r) => ({
    email: r.email,
    templateId,
    dynamicTemplateData: {
      ...templateData,
      recipient: r.name,
    },
  }));

  return sendDynamicTemplateBatch(emailsToSend, fromEmail);
}
```

### Step 4: Update compliance.ts

Add classification for the new template type:

```typescript
const TEMPLATE_CLASSIFICATION: Record<EmailTemplate, EmailClassification> = {
  // ... existing entries
  "sendgrid-dynamic": "broadcast",
};
```

### Step 5: Update package exports

Ensure new types and functions are exported from `packages/notifications/src/index.ts`.

### Step 6: Run typecheck

Run: `pnpm --filter @smartout/notifications exec tsc --noEmit`
Expected: 0 errors.

### Step 7: Commit

```bash
git add packages/notifications/
git commit -m "feat(notifications): add SendGrid dynamic template support"
```

---

## Task 3: Compose Email Redesign — Rich Text + Template Fields

**Goal:** Replace the existing side-sheet compose modal with a full-page compose view that maps to SendGrid template variables, uses Tiptap for rich text, and includes collapsible optional sections.

**Files:**

- Create: `apps/web/src/app/platform-admin/communications/compose/page.tsx` (server)
- Create: `apps/web/src/app/platform-admin/communications/compose/_components/compose-page-client.tsx` (client)
- Create: `apps/web/src/app/platform-admin/communications/compose/_components/email-rich-editor.tsx` (Tiptap wrapper)
- Create: `apps/web/src/app/platform-admin/communications/compose/_components/items-builder.tsx` (image+title+link list)
- Create: `apps/web/src/app/platform-admin/communications/compose/_components/email-preview.tsx` (iframe preview)
- Modify: `apps/web/src/app/platform-admin/communications/_components/communications-client.tsx` (update Compose button to navigate)

### Step 1: Create the compose page (server component)

File: `apps/web/src/app/platform-admin/communications/compose/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";
import { ComposePageClient } from "./_components/compose-page-client";

export default async function ComposePage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  return <ComposePageClient />;
}
```

### Step 2: Create the compose page client

File: `apps/web/src/app/platform-admin/communications/compose/_components/compose-page-client.tsx`

This is the main component. It contains:

- Left side (60%): Form fields matching SendGrid template variables
- Right side (40%): Live HTML preview

Form sections (collapsible with Collapsible from shadcn/ui):

1. **Audience + Template** (always visible)
   - AudienceSelector (reuse existing)
   - Template dropdown (existing 5 + "Custom (SendGrid)" option)
   - When "Custom (SendGrid)" selected: show SendGrid Template ID input

2. **Hero** (collapsible, open by default)
   - Hero image upload/URL input
   - Header text (required — maps to `{{header}}`)

3. **Content** (always visible)
   - Main title input (maps to `{{main_title}}`)
   - Message — Tiptap rich text editor (maps to `{{message}}`)
   - AI correction button in toolbar

4. **Items** (collapsible, closed by default)
   - Section subtitle input (maps to `{{subTitle}}`)
   - Dynamic item list builder (maps to `{{items}}`)
   - Extra message textarea (maps to `{{message2}}`)

5. **CTA Button** (collapsible, closed by default)
   - Button text input (maps to `{{linkText}}`)
   - Button URL input (maps to `{{link}}`)

6. **Info Box** (collapsible, closed by default)
   - Title input (maps to `{{footer_title}}`)
   - Message textarea (maps to `{{footer_message}}`)

7. **Actions** (always visible, sticky bottom)
   - Dry Run button
   - Preview toggle
   - Send button

The form state is a single `useReducer` or `useState` object of type `SendGridTemplateData` plus audience/subject fields.

### Step 3: Create the Tiptap rich editor component

File: `apps/web/src/app/platform-admin/communications/compose/_components/email-rich-editor.tsx`

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link,
  List,
  ListOrdered,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";

type EmailRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onAiCorrect?: (text: string) => Promise<string>;
  placeholder?: string;
};

export function EmailRichEditor({
  value,
  onChange,
  onAiCorrect,
  placeholder,
}: EmailRichEditorProps) {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TiptapLink.configure({ openOnClick: false }),
      TiptapPlaceholder.configure({ placeholder: placeholder ?? "Write your message..." }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-3 py-2",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  async function handleAiCorrect() {
    if (!editor || !onAiCorrect) return;
    const text = editor.getText();
    if (!text.trim()) return;

    setIsAiLoading(true);
    try {
      const corrected = await onAiCorrect(text);
      editor.commands.setContent(corrected);
    } finally {
      setIsAiLoading(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="border-border rounded-md border">
      {/* Toolbar */}
      <div className="border-border flex items-center gap-1 border-b px-2 py-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Toggle>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>

        {onAiCorrect && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAiCorrect}
              disabled={isAiLoading}
              className="gap-1 text-xs"
            >
              {isAiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI
            </Button>
          </>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Note:** Install `@tiptap/extension-link` if not already installed:

```bash
cd apps/web && pnpm add @tiptap/extension-link
```

### Step 4: Create the items builder component

File: `apps/web/src/app/platform-admin/communications/compose/_components/items-builder.tsx`

A dynamic list where each item has:

- Image URL input (with optional upload to Supabase Storage)
- Title input (required)
- Description textarea (optional)
- Benefits bullet list (optional, add/remove)
- Link URL input (optional)
- Remove item button

Uses `useFieldArray`-style pattern (manual state management, no form library dependency).

### Step 5: Create the preview component

File: `apps/web/src/app/platform-admin/communications/compose/_components/email-preview.tsx`

- Takes the current `SendGridTemplateData` as props
- Renders a preview HTML string matching the SendGrid template structure
- Displays in a sandboxed `<iframe>` with `srcDoc`
- Updates live as the user types (debounced 500ms)
- Toggle between desktop (600px) and mobile (375px) widths

### Step 6: Update communications client — navigation

In `apps/web/src/app/platform-admin/communications/_components/communications-client.tsx`:

Change the Compose button from opening a sheet to navigating:

```tsx
import { useRouter } from "next/navigation";

// In CommunicationsClient:
const router = useRouter();

// Replace: onClick={() => openCompose()}
// With:    onClick={() => router.push("/platform-admin/communications/compose")}
```

Keep the `ComposeEmailSheet` for Quick Send (simple sends still use the sheet).
The Compose button navigates to the full compose page for rich emails.

### Step 7: Run typecheck

Run: `pnpm turbo typecheck`
Expected: 0 errors.

### Step 8: Commit

```bash
git add apps/web/src/app/platform-admin/communications/compose/ apps/web/src/app/platform-admin/communications/_components/
git commit -m "feat(communications): compose page with Tiptap editor and template fields"
```

---

## Task 4: AI Text Correction

**Goal:** Add an API endpoint that takes text and returns AI-corrected version. Wire it into the Tiptap editor's AI button.

**Files:**

- Create: `apps/web/src/app/api/platform-admin/communications/ai-correct/route.ts`
- Modify: `apps/web/src/app/platform-admin/communications/compose/_components/compose-page-client.tsx` (wire callback)

### Step 1: Create the AI correction API route

File: `apps/web/src/app/api/platform-admin/communications/ai-correct/route.ts`

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";

const RequestSchema = z.object({
  text: z.string().min(1).max(10000),
  locale: z.enum(["no", "en"]).default("no"),
});

export async function POST(request: Request) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = RequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { text, locale } = body.data;

  try {
    const adminClient = createAdminClient();
    const openrouterKey = await getServiceKey(adminClient, "openrouter");

    const systemPrompt =
      locale === "no"
        ? "Du er en profesjonell korrekturleser for norsk forretningskommunikasjon. Korriger grammatikk, tegnsetting og ordvalg. Behold meningen og tonen, men gjør teksten mer profesjonell og klar. Returner kun den korrigerte teksten, ingen forklaringer."
        : "You are a professional proofreader for business communications. Correct grammar, punctuation, and word choice. Keep the meaning and tone, but make the text more professional and clear. Return only the corrected text, no explanations.";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const corrected = data.choices?.[0]?.message?.content?.trim();

    if (!corrected) {
      return NextResponse.json({ error: "No response from AI" }, { status: 502 });
    }

    return NextResponse.json({ corrected });
  } catch (err) {
    console.error("AI correction error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### Step 2: Wire into compose page

In `compose-page-client.tsx`, pass the AI callback to `EmailRichEditor`:

```typescript
async function handleAiCorrect(text: string): Promise<string> {
  const res = await fetch("/api/platform-admin/communications/ai-correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, locale: "no" }),
  });
  if (!res.ok) {
    toast.error("AI correction failed");
    return text;
  }
  const data = await res.json();
  return data.corrected;
}

// In JSX:
<EmailRichEditor
  value={templateData.message ?? ""}
  onChange={(html) => setTemplateData((prev) => ({ ...prev, message: html }))}
  onAiCorrect={handleAiCorrect}
  placeholder="Write your message..."
/>
```

### Step 3: Run typecheck

Run: `pnpm turbo typecheck`
Expected: 0 errors.

### Step 4: Commit

```bash
git add apps/web/src/app/api/platform-admin/communications/ai-correct/
git add apps/web/src/app/platform-admin/communications/compose/
git commit -m "feat(communications): AI text correction via OpenRouter"
```

---

## Task 5: Multilingual Sending

**Goal:** When sending emails, group recipients by language and auto-translate content for non-default-language recipients via AI.

**Files:**

- Create: `apps/web/src/app/api/platform-admin/communications/translate/route.ts`
- Modify: `packages/notifications/src/email-service.ts` (batch by locale)

### Step 1: Create translation API route

File: `apps/web/src/app/api/platform-admin/communications/translate/route.ts`

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";

const RequestSchema = z.object({
  text: z.string().min(1).max(10000),
  fields: z.record(z.string()).optional(), // For translating multiple fields at once
  fromLocale: z.enum(["no", "en"]).default("no"),
  toLocale: z.enum(["no", "en"]),
});

export async function POST(request: Request) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = RequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { text, fields, fromLocale, toLocale } = body.data;

  if (fromLocale === toLocale) {
    return NextResponse.json({ translated: text, translatedFields: fields });
  }

  try {
    const adminClient = createAdminClient();
    const openrouterKey = await getServiceKey(adminClient, "openrouter");

    const langNames: Record<string, string> = { no: "Norwegian", en: "English" };
    const contentToTranslate = fields
      ? Object.entries(fields)
          .map(([key, val]) => `[${key}]: ${val}`)
          .join("\n---\n")
      : text;

    const systemPrompt = `Translate the following from ${langNames[fromLocale]} to ${langNames[toLocale]}. Preserve formatting, HTML tags, and line breaks. Return only the translation. ${fields ? "Each section is labeled with [key]: — preserve the labels." : ""}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentToTranslate },
        ],
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Translation service error" }, { status: 502 });
    }

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();

    if (!translated) {
      return NextResponse.json({ error: "No translation received" }, { status: 502 });
    }

    // Parse field translations if fields mode
    if (fields) {
      const translatedFields: Record<string, string> = {};
      const sections = translated.split(/\n---\n/);
      const keys = Object.keys(fields);
      keys.forEach((key, i) => {
        const section = sections[i] ?? "";
        translatedFields[key] = section.replace(new RegExp(`^\\[${key}\\]:\\s*`), "").trim();
      });
      return NextResponse.json({ translatedFields });
    }

    return NextResponse.json({ translated });
  } catch (err) {
    console.error("Translation error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### Step 2: Update email-service for locale batching

In `processDynamicTemplateBatches`, group recipients by locale and translate template data for non-default locales:

```typescript
async function processDynamicTemplateBatches(
  recipients: Array<{ email: string; name: string; locale: string }>,
  templateId: string,
  templateData: SendGridTemplateData,
  fromEmail: string,
  translatedVersions?: Map<string, SendGridTemplateData>, // pre-translated by caller
): Promise<SendEmailResult> {
  // Group recipients by locale
  const byLocale = new Map<string, typeof recipients>();
  for (const r of recipients) {
    const locale = r.locale || "no";
    const group = byLocale.get(locale) ?? [];
    group.push(r);
    byLocale.set(locale, group);
  }

  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: Array<{ email: string; error: string }> = [];

  for (const [locale, localeRecipients] of byLocale) {
    const data = translatedVersions?.get(locale) ?? templateData;

    const emailsToSend = localeRecipients.map((r) => ({
      email: r.email,
      templateId,
      dynamicTemplateData: { ...data, recipient: r.name },
    }));

    const result = await sendDynamicTemplateBatch(emailsToSend, fromEmail);
    totalSent += result.sent;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
  }

  return { sent: totalSent, failed: totalFailed, errors: allErrors };
}
```

### Step 3: Add UI toggle in compose page

Add a "Multilingual" switch in the compose UI:

- When enabled, shows a preview of auto-detected recipient languages
- After dry run, shows "X recipients in Norwegian, Y in English"
- Translation happens at send time (server-side)

### Step 4: Update send route

In the send API route, if multilingual is enabled:

1. Dry run to get recipient locales
2. Group unique locales
3. Call translate API for each non-default locale
4. Pass translated versions to `processDynamicTemplateBatches`

### Step 5: Run typecheck

Run: `pnpm turbo typecheck`
Expected: 0 errors.

### Step 6: Commit

```bash
git add apps/web/src/app/api/platform-admin/communications/translate/
git add packages/notifications/src/email-service.ts
git add apps/web/src/app/platform-admin/communications/compose/
git commit -m "feat(communications): multilingual sending with AI translation"
```

---

## Task 6: SendGrid Webhook Receiver (Read Receipts)

**Goal:** Create a Supabase Edge Function that receives SendGrid webhook events (opens, clicks, bounces, unsubscribes) and updates the recipient tracking data.

**Files:**

- Create: `supabase/functions/sendgrid-webhook/index.ts`
- Modify: `supabase/config.toml` (add function config with `verify_jwt = false`)

### Step 1: Create the Edge Function

File: `supabase/functions/sendgrid-webhook/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("SENDGRID_WEBHOOK_VERIFICATION_KEY");

// SendGrid Event Webhook payload shape
type SendGridEvent = {
  email: string;
  event: string; // "open" | "click" | "bounce" | "unsubscribe" | "delivered" | "dropped" | "spamreport"
  timestamp: number;
  sg_message_id?: string;
  url?: string; // For click events
  reason?: string; // For bounce events
  type?: string; // For bounce: "bounce" | "blocked"
  [key: string]: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify webhook signature (SendGrid Signed Event Webhook)
  // In production, verify the signature using the WEBHOOK_SECRET
  // For now, check that the secret header exists
  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  if (WEBHOOK_SECRET && !signature) {
    return new Response("Missing signature", { status: 401 });
  }

  let events: SendGridEvent[];
  try {
    events = await req.json();
    if (!Array.isArray(events)) {
      return new Response("Expected array", { status: 400 });
    }
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const processedEvents = [];

  for (const event of events) {
    const { email, event: eventType, timestamp } = event;
    if (!email || !eventType) continue;

    const eventTime = new Date(timestamp * 1000).toISOString();

    // Store raw event
    processedEvents.push({
      provider: "sendgrid",
      event_type: eventType,
      email: email.toLowerCase(),
      raw_payload: event,
      processed_at: eventTime,
    });

    // Update recipient record based on event type
    switch (eventType) {
      case "open": {
        // Find recipient by email in recent communications (last 30 days)
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id, communication_id, open_count")
          .eq("email", email.toLowerCase())
          .is("opened_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          const r = recipients[0];
          await supabase
            .from("platform_communication_recipient")
            .update({
              opened_at: eventTime,
              open_count: (r.open_count ?? 0) + 1,
            })
            .eq("recipient_id", r.recipient_id);

          // Increment communication-level counter
          await supabase.rpc("increment_communication_counter", {
            p_communication_id: r.communication_id,
            p_field: "opened_count",
          });
        }
        break;
      }

      case "click": {
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id, communication_id, click_count")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          const r = recipients[0];
          await supabase
            .from("platform_communication_recipient")
            .update({
              clicked_at: r.clicked_at ?? eventTime, // Only set first click
              click_count: (r.click_count ?? 0) + 1,
            })
            .eq("recipient_id", r.recipient_id);

          await supabase.rpc("increment_communication_counter", {
            p_communication_id: r.communication_id,
            p_field: "clicked_count",
          });
        }
        break;
      }

      case "bounce":
      case "dropped": {
        // Update recipient status
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          await supabase
            .from("platform_communication_recipient")
            .update({
              status: "bounced",
              error_message: event.reason ?? `${eventType}: ${event.type ?? "unknown"}`,
            })
            .eq("recipient_id", recipients[0].recipient_id);
        }

        // Add to suppression list (hard bounces)
        if (event.type === "bounce") {
          await supabase
            .from("platform_email_suppression")
            .upsert(
              { email: email.toLowerCase(), reason: "bounce", source: "sendgrid_webhook" },
              { onConflict: "email" },
            );
        }
        break;
      }

      case "unsubscribe":
      case "spamreport": {
        await supabase.from("platform_email_suppression").upsert(
          {
            email: email.toLowerCase(),
            reason: eventType === "spamreport" ? "complaint" : "unsubscribe",
            source: "sendgrid_webhook",
          },
          { onConflict: "email" },
        );
        break;
      }

      case "delivered": {
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id")
          .eq("email", email.toLowerCase())
          .eq("status", "sent")
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          await supabase
            .from("platform_communication_recipient")
            .update({ status: "delivered", delivered_at: eventTime })
            .eq("recipient_id", recipients[0].recipient_id);
        }
        break;
      }
    }
  }

  // Bulk insert webhook events
  if (processedEvents.length > 0) {
    await supabase.from("platform_webhook_event").insert(processedEvents);
  }

  return new Response(JSON.stringify({ processed: processedEvents.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Step 2: Add SQL function for counter increment

Add to the migration (or create a new migration):

```sql
CREATE OR REPLACE FUNCTION increment_communication_counter(
  p_communication_id uuid,
  p_field text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_field = 'opened_count' THEN
    UPDATE platform_communication_log
    SET opened_count = opened_count + 1, updated_at = now()
    WHERE communication_id = p_communication_id;
  ELSIF p_field = 'clicked_count' THEN
    UPDATE platform_communication_log
    SET clicked_count = clicked_count + 1, updated_at = now()
    WHERE communication_id = p_communication_id;
  END IF;
END;
$$;
```

### Step 3: Update Edge Function config

Add to `supabase/config.toml`:

```toml
[functions.sendgrid-webhook]
verify_jwt = false
```

### Step 4: Configure SendGrid

In SendGrid dashboard:

1. Go to Settings > Mail Settings > Event Webhook
2. Set HTTP POST URL: `https://<project-ref>.supabase.co/functions/v1/sendgrid-webhook`
3. Enable events: Delivered, Opens, Clicks, Bounces, Unsubscribes, Spam Reports
4. Enable Signed Event Webhook and save the verification key as `SENDGRID_WEBHOOK_VERIFICATION_KEY` in Vault

### Step 5: Run typecheck + deploy locally

Run: `npx supabase functions serve sendgrid-webhook --no-verify-jwt`

Test with curl:

```bash
curl -X POST http://localhost:54321/functions/v1/sendgrid-webhook \
  -H "Content-Type: application/json" \
  -d '[{"email":"test@example.com","event":"open","timestamp":1709337600}]'
```

Expected: `{"processed":1}`

### Step 6: Commit

```bash
git add supabase/functions/sendgrid-webhook/ supabase/config.toml supabase/migrations/
git commit -m "feat(communications): SendGrid webhook receiver for delivery tracking"
```

---

## Task 7: Communication History Enhancements

**Goal:** Update the Communication History table to show open/click tracking stats and add expandable row detail.

**Files:**

- Modify: `apps/web/src/app/platform-admin/communications/_components/communications-client.tsx`
- Modify: `apps/web/src/app/platform-admin/communications/page.tsx`
- Create: `apps/web/src/app/platform-admin/communications/_components/communication-detail.tsx`

### Step 1: Update history table columns

Add new columns to `communications-client.tsx`:

```typescript
// After the "Sent / Failed" column:
{
  id: "engagement",
  header: "Opened / Clicked",
  cell: ({ row }) => {
    const total = row.original.recipientCount;
    const opened = row.original.openedCount;
    const clicked = row.original.clickedCount;

    if (total === 0) return <span className="text-muted-foreground text-xs">—</span>;

    return (
      <span className="text-xs">
        <span className="text-blue-500" title={`${opened} opened`}>
          {opened}
        </span>
        {" / "}
        <span className="text-purple-500" title={`${clicked} clicked`}>
          {clicked}
        </span>
        <span className="text-muted-foreground ml-1">
          ({Math.round((opened / total) * 100)}%)
        </span>
      </span>
    );
  },
},
```

### Step 2: Update the CommunicationEntry type

```typescript
type CommunicationEntry = {
  id: string;
  subject: string;
  template: string;
  classification: string;
  audienceFilter: Record<string, unknown> | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number; // NEW
  clickedCount: number; // NEW
  status: string;
  createdAt: string;
};
```

### Step 3: Update server page to fetch new columns

In `page.tsx`, update the Supabase query to include `opened_count, clicked_count`.

### Step 4: Create expandable row detail component

File: `apps/web/src/app/platform-admin/communications/_components/communication-detail.tsx`

Shows per-recipient delivery status when a row is expanded:

- Table: email, name, status, sent_at, delivered_at, opened_at, clicked_at
- Summary bar: X delivered, Y opened, Z clicked, W bounced

### Step 5: Run typecheck

Run: `pnpm turbo typecheck`
Expected: 0 errors.

### Step 6: Commit

```bash
git add apps/web/src/app/platform-admin/communications/
git commit -m "feat(communications): tracking stats in history table + expandable detail"
```

---

## Task 8: Update Send Route for Dynamic Templates

**Goal:** Update the existing send API route to support the new dynamic template mode.

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/communications/send/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/communications/dry-run/route.ts`

### Step 1: Update send route Zod schema

Add new fields to the request schema:

```typescript
const SendSchema = z.object({
  audience: AudienceFilterSchema,
  template: z.string(),
  subject: z.string().min(1),
  message: z.string().optional(), // Optional for dynamic template mode
  // New dynamic template fields:
  sendgridTemplateId: z.string().optional(),
  templateData: z
    .object({
      header: z.string(),
      main_title: z.string().optional(),
      message: z.string().optional(),
      subTitle: z.string().optional(),
      message2: z.string().optional(),
      items: z
        .array(
          z.object({
            image: z.string().optional(),
            title: z.string(),
            description: z.string().optional(),
            benefits: z.array(z.string()).optional(),
            link: z.string().optional(),
          }),
        )
        .optional(),
      linkText: z.string().optional(),
      link: z.string().optional(),
      footer_title: z.string().optional(),
      footer_message: z.string().optional(),
      hero_image: z.string().optional(),
    })
    .optional(),
  multilingual: z.boolean().default(false),
});
```

### Step 2: Update send logic

Add dynamic template branch:

```typescript
if (body.data.sendgridTemplateId && body.data.templateData) {
  // Dynamic template mode
  const jobOptions: EmailJobOptions = {
    template: "sendgrid-dynamic",
    variables: { subject: body.data.subject },
    audience: body.data.audience,
    adminId,
    sendgridTemplateId: body.data.sendgridTemplateId,
    templateData: body.data.templateData,
  };

  const job = await createEmailJob(adminClient, jobOptions);
  // ... store in platform_communication_log with sendgrid_template_id and template_data
}
```

### Step 3: Store template data in communication log

Update the database insert to include the new columns:

```typescript
await adminClient.from("platform_communication_log").insert({
  // ... existing fields
  sendgrid_template_id: body.data.sendgridTemplateId ?? null,
  template_data: body.data.templateData ?? null,
});
```

### Step 4: Update dry-run route

Add language breakdown to dry-run response:

```typescript
// After resolving audience:
const localeBreakdown: Record<string, number> = {};
for (const r of recipients) {
  const locale = r.locale || "no";
  localeBreakdown[locale] = (localeBreakdown[locale] ?? 0) + 1;
}

return NextResponse.json({
  recipientCount: recipients.length,
  preview: recipients
    .slice(0, 10)
    .map((r) => `${r.name} <${r.email}>`)
    .join(", "),
  localeBreakdown,
});
```

### Step 5: Run typecheck

Run: `pnpm turbo typecheck`
Expected: 0 errors.

### Step 6: Commit

```bash
git add apps/web/src/app/api/platform-admin/communications/
git commit -m "feat(communications): send route supports dynamic templates + multilingual"
```

---

## Dependency Graph

```
Task 1 (Schema)
  ├── Task 2 (SendGrid templates) ← depends on schema
  │     └── Task 8 (Send route update) ← depends on package changes
  │           └── Task 5 (Multilingual) ← depends on send route
  ├── Task 3 (Compose UI) ← depends on schema + types
  │     └── Task 4 (AI correction) ← depends on compose UI
  ├── Task 6 (Webhook receiver) ← depends on schema
  │     └── Task 7 (History enhancements) ← depends on webhooks
  └── Task 7 (History enhancements) ← depends on schema
```

**Recommended execution order:** 1 → 2 → 3 → 4 → 8 → 5 → 6 → 7

Tasks 3+4 and 6+7 can run in parallel after Task 2 is done.

---

## ADR Triggers

The following decisions should be documented as ADRs:

1. **ADR: Tiptap for email rich text editing** — Why Tiptap over Lexical/Slate (already installed, proven in contract editor)
2. **ADR: SendGrid dynamic templates over inline HTML** — Keep existing templates for programmatic sends, add dynamic templates for admin-composed emails
3. **ADR: OpenRouter for AI features** — Text correction and translation routed through OpenRouter for model flexibility

---

## Out of Scope (v3 / Future)

- Drag-and-drop email builder (YAGNI for v2)
- Custom webhook endpoint management UI (admin can configure in SendGrid dashboard)
- A/B testing for email variants
- Scheduled sends (cron-based queue)
- Email analytics dashboard (separate module)
- Per-workspace footer templates (v3)
