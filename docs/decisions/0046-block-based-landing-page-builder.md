---
title: "Block-based Landing Page Builder"
id: ADR_0046
status: accepted
layer: decision
created: 2026-03-02
updated: 2026-03-02
---

# ADR-0046: Block-based Landing Page Builder

## Context and Problem Statement

The landing page has 7 hardcoded variant components (~5700 lines of TypeScript) targeting different personas. All content is baked into code — changing a headline requires a code deploy. We need a system where platform admins can create, edit, and publish landing page variants without developer intervention.

## Decision Drivers

- Non-technical admins must be able to edit landing content
- Unlimited variants needed for campaigns and A/B testing
- Layout consistency must be maintained (no broken pages)
- Performance cannot degrade (Lighthouse > 90)
- Must integrate with existing PostHog tracking and Ultravox voice

## Considered Options

1. **Block-based Page Builder** — Admin combines ~15 predefined block types (Hero, Features, CTA, etc.) with structured content in Zod-validated JSONB. Rendered server-side.
2. **Free Canvas WYSIWYG** — Full drag-and-drop editor like Wix/Squarespace. Total layout freedom.
3. **Template + Content Override** — Keep 7 coded layouts as templates. Admin only swaps text/images via forms.

## Decision Outcome

Chosen option: **"Block-based Page Builder"**, because it gives admins full WYSIWYG flexibility while maintaining structural safety. Blocks are pre-designed to be responsive and accessible — admins cannot accidentally break layouts.

## Rules & Consequences

- **Good, because** admins can create unlimited variants by combining blocks
- **Good, because** each block is Zod-validated — no broken JSONB content
- **Good, because** server-side rendering with caching maintains performance
- **Bad, because** new block types require code changes
- **Bad, because** initial build is larger than Option 3 (15 block components + admin UI)
- **Agent Impact:** Landing page content is now in `landing_variant` + `landing_block` tables, not in component files. Never hardcode landing content. New block types: create schema in `block-schemas.ts`, component in `components/blocks/`, form in admin `forms/`.

---
