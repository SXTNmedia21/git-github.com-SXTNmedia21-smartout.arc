---
id: ADR-0026
title: Template Editor Redesign with PDF Attachments
status: Accepted
date: 2026-02-28
layer: decision
---

# ADR-0026: Template Editor Redesign with PDF Attachments

## Context and Problem Statement

The contract template editor (`template-editor.tsx`) was functional but bare-bones: it only used StarterKit + Underline (missing all 6 custom Tiptap extensions), had a flat top bar with native `<select>`, no metadata management, no PDF attachment support, and no document navigation.

Meanwhile, the AI-powered `contract-editor.tsx` already used all 6 extensions (ClauseBlock, PlaceholderField, SignatureField, DateField, SectionSummary, HighlightSection). The template editor needed parity.

Additionally, Smartout sends contracts with PDF attachments (DPA, Vedlegg 1/2, onboarding docs) and needed a way to attach and manage these files.

## Decision Drivers

- Template editor must render the same extensions as the contract editor
- Two real contract types need seed templates (Onboarding & Drift, SaaS License)
- PDF attachments needed for DPA, vedlegg, supplementary docs
- Better UX: metadata management, tabbed sidebar, document outline

## Considered Options

1. **Redesign template editor only** — Add extensions + new toolbar, no attachments
2. **Full redesign + attachments + seed templates** — Complete overhaul
3. **Merge with contract editor** — Single editor component for both use cases

## Decision Outcome

Option 2: Full redesign with attachments and two seed templates based on real contracts (Spatind Fjellhotell, Villa Mat AS).

## Changes Made

- **Database**: `attachments` JSONB column on `contract_template`, `contract-attachments` storage bucket
- **Seed data**: Two system templates — "Onboarding & Drift" and "Lisens- og brukeravtale"
- **Server actions**: `upload-action.ts` (PDF upload to Storage), `delete-attachment-action.ts`
- **6 new components**: MetadataBar, EditorToolbarV2 (with Insert Section/Field dropdowns), SidebarPanel (tabs), AttachmentsPanel (drag-drop), DocumentOutline, StatusBar
- **Template editor rewrite**: All 6 Tiptap extensions, Ctrl+S, Publish button, dirty tracking

## Rules & Consequences

- Template content uses `data-type="clause-block"` HTML attributes for Tiptap parsing
- Attachments are stored as JSONB array on the template row (metadata only — files in Storage)
- Storage bucket `contract-attachments` is private, PDF-only, 10MB limit
- Upload goes through server actions (service role) — no direct client upload
- After running migration, regenerate `database.types.ts` to remove type assertions
