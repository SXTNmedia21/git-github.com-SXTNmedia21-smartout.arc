---
title: "User Journeys — Landing Page Builder"
status: done
updated: 2026-03-02
created: 2026-03-02
module: landing
tags: [journeys, landing, admin, page-builder]
---

# User Journeys — Landing Page Builder

## Journey 1: Platform Admin Creates a New Landing Variant

**Precondition:** Admin is logged in with godmode access. At least one published default variant exists.

1. Admin navigates to `/platform-admin/landing/variants` → System shows variant list table with all existing variants (name, slug, status, default badge)
2. Admin clicks "Ny variant" → System opens the block editor for a new variant with empty metadata form
3. Admin fills in Name ("Kock-variant"), Slug auto-generates ("kock-variant") → System shows metadata form with name, slug, status (draft), theme picker
4. Admin selects accent color "orange" from ThemePicker → System updates theme preview
5. Admin fills in Meta title and Meta description → System auto-saves after 1 second (indicator shows "Lagret")
6. Admin clicks "Legg til seksjon" → System opens AddBlockDialog with 15 block types as cards
7. Admin clicks "Hero" card → System adds a Hero block to the list, expanded with empty form
8. Admin fills in heading, subheading, CTA button text + link → System auto-saves each change
9. Admin adds more blocks (Features Grid, CTA Section) by repeating step 6-8
10. Admin drags a block to reorder → System updates sort_order, saves, shows "Lagret"
11. Admin clicks "Forhandsvisning" → System opens preview page with iframe showing the variant at `/v?preview=true&id={uuid}`
12. Admin toggles between Mobile/Tablet/Desktop views → System resizes iframe
13. Admin returns to editor, clicks "Publiser" → System sets status to "published", triggers cache revalidation
14. Admin verifies at `smartout.ai?v=kock-variant` → Visitor sees the published variant

**Postcondition:** New variant is published and accessible via URL parameter.

**Error paths:**

- Duplicate slug → Supabase unique constraint error, admin must choose different slug
- Empty name/slug → Save button disabled, fields show required state
- Revalidation fails → Console warning, variant still saved in DB but may take up to 5 minutes to appear (cache TTL)

---

## Journey 2: Platform Admin Edits an Existing Variant

**Precondition:** Admin has godmode access. At least one variant exists.

1. Admin navigates to `/platform-admin/landing/variants` → System shows variant table
2. Admin clicks "Rediger" on a variant row → System opens block editor with loaded metadata + blocks
3. Admin expands a block card by clicking the chevron → System shows the block-specific form (e.g., Hero form with heading, subheading, buttons)
4. Admin changes the heading text → System auto-saves after 1 second, indicator shows "Lagrer..." then "Lagret"
5. Admin toggles a block's visibility via eye icon → System updates `is_visible`, block appears dimmed
6. Admin deletes a block via trash icon → System removes block from list and deletes from DB
7. Admin clicks "Lagre" to force-save → System saves all pending changes immediately

**Postcondition:** Variant updated in DB. If published, changes visible after revalidation.

**Error paths:**

- Editing while another admin edits same variant → Last write wins (no collaborative editing)
- Network failure during save → Indicator stays on "Ulagrede endringer", retries on next change

---

## Journey 3: Platform Admin Manages Variant Lifecycle

**Precondition:** Admin has godmode access. Multiple variants exist.

1. Admin navigates to variant list → System shows all variants with status badges (Draft/Published/Archived)
2. Admin clicks Actions → "Sett som standard" on a variant → System sets `is_default = true` on selected, `false` on previous default
3. Admin clicks Actions → "Dupliser" on a variant → System creates new variant with copied blocks, status "draft", slug suffixed with "-kopi"
4. Admin clicks Actions → "Arkiver" on a variant → System sets status to "archived", variant no longer shown to visitors
5. Admin changes published variant to "Avpubliser" → System sets status to "draft", triggers revalidation

**Postcondition:** Variant lifecycle managed. Default variant shown at `smartout.ai` without `?v=` parameter.

**Error paths:**

- Archiving the default variant → System should prevent this (exactly one default must exist)
- Archiving the only published variant → Visitors see fallback message at root URL

---

## Journey 4: Visitor Views a Landing Variant

**Precondition:** At least one published variant exists with `is_default = true`.

1. Visitor opens `smartout.ai` → System fetches default variant from DB (cached), renders blocks via BlockRenderer with ThemeProvider
2. Visitor sees hero section, feature grid, CTA buttons, voice widget — all rendered from DB content
3. Visitor clicks CTA button → System fires `cta_click` tracking event, navigates to target URL

**Alternative: Campaign URL**

1. Visitor opens `smartout.ai?v=chef` → System fetches variant with slug "chef"
2. If slug exists and is published → Variant renders
3. If slug not found → System shows fallback/default variant

**Postcondition:** Visitor sees variant content. Tracking events logged to `landing_event` table.

**Error paths:**

- Invalid slug → Fallback to default variant
- No published variants in DB → Simple fallback message displayed
- Supabase unavailable → Cache serves stale data (up to 5 min TTL)

---

## Journey 5: Platform Admin Uploads Media

**Precondition:** Admin is editing a variant block that has an image field (Hero, Testimonial, Image Section, Logo Strip).

1. Admin expands a block with image field → System shows MediaPicker (currently MVP placeholder)
2. Admin enters media_id manually or uploads file → System stores in `landing-media` Storage bucket
3. Admin fills in alt text → System saves media reference in block content
4. Published variant shows image via `next/image` with automatic AVIF/WebP optimization

**Postcondition:** Image stored in Supabase Storage, referenced in block content, optimized on delivery.

**Error paths:**

- Upload fails → Error shown, block content unchanged
- Invalid image format → Supabase Storage rejects upload
- Missing alt text → Accessibility warning (not blocking)

---

## Journey 6: Cache Revalidation After Publishing

**Precondition:** Admin has just published or unpublished a variant.

1. Admin clicks "Publiser" or "Avpubliser" → System saves status change to DB
2. System calls `POST /api/revalidate` on the landing app with secret → Landing app calls `revalidateTag("landing")`
3. Next visitor request fetches fresh data from DB → Variant content updated within seconds

**Postcondition:** Landing page cache invalidated. Fresh content served on next request.

**Error paths:**

- Revalidation secret mismatch → 401 error, admin sees warning, cache expires naturally (5 min)
- Landing app unreachable → Warning logged, cache serves stale data until TTL expires
