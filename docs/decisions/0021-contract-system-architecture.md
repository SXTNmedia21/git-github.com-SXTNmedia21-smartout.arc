# ADR-0021: Contract System Architecture

**Status:** Accepted
**Date:** 2026-02-28

## Context and Problem Statement

Smartout needs a contract system that handles B2B client contracts (Smartout <-> Restaurant), with future support for employee contracts, HACCP sign-offs, training acknowledgments, and season agreements. The system must integrate with e-signature infrastructure, support AI-assisted template creation, and gate workspace access based on contract status. Multiple architectural decisions needed to be made simultaneously: signing provider, deployment model, editor choice, content format, signing UX, and database naming.

## Decision Drivers

- The contract system is cross-cutting infrastructure consumed by 6+ modules (onboarding, HR, HACCP, training, settings, AI)
- Must comply with Norwegian legal requirements (Avtaleloven, GDPR/Personopplysningsloven, E-handelsloven)
- Must scale from initial B2B client contracts to employee contracts and acknowledgments
- Competitive advantage is the AI experience, not PDF plumbing — build vs. buy accordingly
- Edge Functions have a 60-second timeout limit which conflicts with long-running contract operations
- The template editor needs AI integration for conversational contract building

## Considered Options

### Signing Infrastructure

1. **DocuSeal Cloud** — Managed e-signature service at $0.20/document
2. **DocuSeal self-hosted** — Self-managed Docker instance
3. **Build custom** — Own PDF generation + signing implementation

### Deployment Model

1. **Standalone Fastify microservice** — Dedicated service abstracting DocuSeal
2. **Supabase Edge Functions** — Serverless functions within existing infrastructure
3. **Next.js API routes** — Backend logic in the web application

### Template Editor

1. **Tiptap (ProseMirror-based)** — Headless rich text editor with extension system
2. **DocuSeal template builder** — Built-in template editor from DocuSeal
3. **Custom HTML editor** — Plain textarea with HTML input

### Content Format

1. **HTML with placeholder resolution** — Templates store HTML with `{{placeholder}}` tokens
2. **Markdown** — Templates store Markdown, converted to HTML at send time
3. **JSON document format** — Structured document model

### Signing Experience

1. **Embedded in Smartout domain** — `@docuseal/react` DocusealForm component at smartout.io/sign/[token]
2. **DocuSeal redirect** — Redirect to DocuSeal's hosted signing page
3. **Custom signing UI** — Build own signing interface

### Database Naming

1. **Rename platform*contract*\_ to contract\_\_** — Clean names, single migration
2. **Keep platform*contract*\* prefix** — Maintain existing naming convention

## Decision Outcome

### DocuSeal Cloud over self-hosted

Chosen: **DocuSeal Cloud**, because the $0.20/document cost is negligible at current scale and eliminates all ops burden. The microservice abstraction layer protects against vendor lock-in — switching to self-hosted or another provider only requires changing the microservice implementation, not any consuming code.

### Standalone Fastify microservice over Edge Functions

Chosen: **Standalone Fastify microservice** (port 3100), because:

- Reusable across 6+ contract types (client, employee, HACCP, training, season, NDA)
- Own scaling independent of the web application
- Supports background jobs (reminder scheduling, PDF processing, webhook retries)
- Edge Functions have 60-second timeout limits incompatible with document processing workflows
- Dedicated process for contract lifecycle management
- Worth the 2-3 days extra initial investment

The microservice runs as a Docker container (node:22-alpine) deployable to Fly.io or Railway. Service-to-service authentication uses a shared `X-Service-Key` header stored in 1Password.

### Tiptap editor over DocuSeal builder

Chosen: **Tiptap**, because:

- Headless architecture allows full UI customization matching Smartout's design system
- Schema-aware editing prevents AI from breaking document structure
- Extension-based — custom nodes for contract sections, placeholder fields, signature blocks
- AI toolkit available for Vercel AI SDK integration
- HTML output maps directly to DocuSeal's template format
- ProseMirror foundation is battle-tested and well-documented

### HTML content format with placeholder resolution

Chosen: **HTML with `{{placeholder}}` tokens**, because:

- DocuSeal's `POST /templates/html` endpoint is the most code-friendly creation method
- Tiptap outputs HTML natively — no conversion layer needed
- Placeholders are resolved at send time by the microservice
- CSS styling (accent colors, section formatting) is preserved
- Templates are inspectable and debuggable as plain HTML

### Embedded signing in Smartout domain

Chosen: **Embedded via `@docuseal/react`**, because:

- Full brand control — signing happens at smartout.io/sign/[token]
- Consistent user experience without external redirects
- DocuSeal's React component handles signature capture, field validation, and submission
- Signing events are captured via webhooks for audit trail

### Table rename strategy (platform*contract*\_ to contract\_\_)

Chosen: **Rename to clean names**, because:

- `contract` and `contract_template` are clearer than `platform_contract_instance` and `platform_contract_template`
- The `platform_` prefix was used during the initial platform-admin implementation but contracts are cross-cutting, not platform-admin-specific
- Single migration handles the rename with proper foreign key updates
- Existing code references (page.tsx, webhook) are updated in the same changeset

## Rules & Consequences enforced for Agents

- **Good, because** all contract operations go through the microservice, creating a clean abstraction boundary. No code outside `services/contract-service/` should import DocuSeal SDKs directly.
- **Good, because** HTML templates with placeholders are simple to understand, test, and debug. AI agents can read and modify templates without special tooling.
- **Good, because** the embedded signing experience keeps users within smartout.io, maintaining brand consistency.
- **Bad, because** the standalone microservice adds deployment complexity (separate Docker container, health checks, service key management).
- **Bad, because** Tiptap has a learning curve for custom extension development.
- **Agent Impact:**
  - Never import `@docuseal/api` outside `services/contract-service/` — use the microservice API instead
  - Use `contract` and `contract_template` table names (NOT `platform_contract_instance` or `platform_contract_template`)
  - Contract-related API routes authenticate via `X-Service-Key` header for service-to-service calls
  - The `contract_status` enum is already taken by `employment_contract` (migration 00012) — workspace contract status uses plain text column
  - New contract tables (`contract_event`, `contract_reminder`, `message_template`, `clause_library`) have no RLS — accessed via service role only
  - Template content is always HTML, never Markdown
  - The signing page route is `/sign/[token]` (public, no auth required)
