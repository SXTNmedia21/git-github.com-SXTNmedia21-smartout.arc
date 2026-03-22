---
title: Website Factory — Plan B Builder UI Design Spec
status: approved
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [website, builder, ui, templates, editor, spokesperson, mobile, telemetry]
---

# Website Factory — Plan B Builder UI Design Spec

> Complete design specification for the Website Factory Builder UI. Covers the admin-facing editor at `/dashboard/website` — template system, setup wizard, section editor, system-connected sections, spokesperson approval flow, recurring content tasks, mobile app screens, and telemetry.

## Executive Summary

Plan B is the admin-facing builder that sits on top of Plan A's foundation (schema, package, middleware, renderers, publish pipeline). It gives workspace admins a structured, form-driven editor to create and manage their public website without any coding or freeform HTML.

**Key design principles:**

- **Template-first** — Every site starts from a curated hospitality template. No blank canvas.
- **Form-driven editing** — Section content is edited via structured forms, not WYSIWYG. Preview opens in a separate tab.
- **System-connected sections** — Menu, opening hours, and spokesperson sections bridge to live Smartout data.
- **Mobile-native approval** — Spokesperson assignment flows through the mobile app with push notifications.
- **Separate-tab preview** — Preview is never inline in the editor. Always a full browser tab rendering the actual public site.

**Scope:** This spec covers UI/UX design decisions only. Data model is defined in Plan A (`2026-03-21-website-factory-design.md`). No schema changes needed beyond what Plan A provides.

---

## 1. Architecture Overview

### Route Structure

```
/dashboard/website/
  page.tsx                → Overview (redirects to /setup if no website)
  /setup/
    page.tsx              → 3-step setup wizard
  /pages/
    [pageId]/
      page.tsx            → Section editor (2-column layout)
  /menus/
    [menuId]/
      page.tsx            → Menu category + item editor
  /theme/
    page.tsx              → Theme token editor
  /settings/
    page.tsx              → Domain, SEO, booking, social, contact
  /history/
    page.tsx              → Draft revisions + publish events
```

### Component Architecture

- Server components for data loading (page list, section list, menu data)
- Client components for interactive editing (`"use client"` pushed deep)
- TanStack Query for all data fetching + mutations
- Zod validation on every section content save (from `@smartout/website` package)
- Manual save with autosave fallback (60s interval if dirty, `source = 'autosave'`)

### Sidebar Navigation

"Nettside" entry with Globe icon in the **Administrasjon** group (positioned after Organisasjon, before Vakt). Gated by `workspace.has_website` feature flag. Only visible to `admin` and `owner` roles.

---

## 2. Template System

### 2.1 Template Gallery

20 hospitality page-type templates organized into 3 tiers:

| Tier              | Templates                                                                                      | Access               |
| ----------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| **Basic** (5)     | Casual Bistro, Family Restaurant, Career Page, Location Finder, About/Story                    | Free — all plans     |
| **Basic Pro** (8) | Fast Casual, Brunch, Rooftop Bar, Farm-to-Table, Gift Card, Seasonal Menu, Loyalty, Grab & Go  | Included in Pro plan |
| **Premium** (7)   | Fine Dining, Hotel Restaurant, Chef's Table, Luxury Resort, Private Dining, Franchise, Omakase | Paid add-on          |

Full design prompts for all 20 templates: `docs/superpowers/specs/website-factory-page-type-prompts.md`

### 2.2 Gallery Layout

- **Category filter bar** at top: Alle, Restaurant, Kafe & Bar, Fine Dining, Hotell, Bakeri, Street Food
- **Grid of template cards** (3 columns on desktop, 2 on tablet, 1 on mobile)
- Each card renders a **mini-website preview** with real photography (Unsplash, hospitality-specific)
- **Tier badge** on each card: green "Gratis", blue "Pro", purple "Premium"
- **Hover state** reveals two buttons:
  - "Velg denne malen" (primary, green) — selects template and advances to step 2
  - "Forhåndsvisning" (secondary, outline) — opens full-page preview

### 2.3 Full-Page Template Preview

When user clicks "Forhåndsvisning" on a template card, a full-page overlay opens:

**Sticky top toolbar:**

- Back button (← Tilbake til maler)
- Template name + tier badge
- Counter: "1 / 20" (current position in filtered set)
- Device switcher: Desktop | Nettbrett | Mobil (resizes preview viewport)
- "Velg denne malen" CTA button (green)

**Navigation:**

- Left/right arrows fixed on viewport sides
- Arrows have tooltips showing next/previous template name
- Keyboard: arrow keys navigate between templates

**Preview area:**

- Scrollable full website preview (nav, hero, all sections, footer)
- Rendered from template manifest defaults with placeholder content
- Device switcher constrains preview width: 100% / 768px / 375px

---

## 3. Setup Wizard

3-step wizard flow. Sequential, no skip. Progress bar at top.

### Step 1: Velg mal

Template gallery (section 2.2). Selecting a template highlights it and enables "Neste" button.

### Step 2: Tilpass

**Smart bootstrap** — pre-fills from workspace data:

| Field          | Source                               | Editable            |
| -------------- | ------------------------------------ | ------------------- |
| Nettstedsname  | `company.name`                       | Yes                 |
| Logo           | Workspace logo from storage          | Yes (upload new)    |
| Primerfarge    | Workspace branding `primary_color`   | Yes (color picker)  |
| Sekundarfarge  | Workspace branding `secondary_color` | Yes (color picker)  |
| Bakgrunnsfarge | Template default                     | Yes (color picker)  |
| Skrifttype     | Template default                     | Yes (font selector) |

No AI generation in this phase — pure data mapping from existing workspace state.

### Step 3: Ferdig

**On confirm:**

1. Creates `websites.website` row with `template_key`, `template_version`, theme tokens
2. Creates `websites.website_page` rows from template manifest `defaultPages`
3. Creates `websites.website_section` rows from template manifest section composition, with defaults
4. Creates `websites.website_domain` row for `{site_slug}.smartout.info`
5. Sets `workspace.has_website = true`
6. Creates `websites.website_draft_revision` with `source = 'template_apply'`
7. Redirects to `/dashboard/website` (overview page)

All in a single transaction via server action.

---

## 4. Overview Page (`/dashboard/website`)

The main landing page after setup. Shows site health and quick actions.

### Redirect Logic

If `workspace.has_website = false` → redirect to `/dashboard/website/setup`.

### Layout

**Top section:**

- Site name + status badge (`Utkast` / `Publisert` / `Frakoblet`)
- Domain URL (clickable, opens public site)

**4 stat cards (horizontal row):**

| Card      | Value                                                | Icon       |
| --------- | ---------------------------------------------------- | ---------- |
| Sider     | Count of visible pages                               | FileText   |
| Seksjoner | Total section count across all pages                 | LayoutGrid |
| Versjon   | Current published snapshot version (or "—" if draft) | GitBranch  |
| Domene    | Primary domain                                       | Globe      |

**Page list:**

- Each row: drag handle, page title, section count badge, visibility toggle (eye icon)
- Drag-to-reorder updates `sort_order` with optimistic UI
- Click row → navigates to section editor for that page
- "Legg til side" button at bottom (opens page type picker)

**Action bar (top right):**

- **Forhåndsvisning** — opens public site preview in new tab (uses preview token)
- **Innstillinger** — navigates to `/dashboard/website/settings`
- **Publiser endringer** — runs publish pipeline, green button, disabled if no changes since last publish

---

## 5. Section Editor (`/dashboard/website/pages/[pageId]`)

The core editing experience. 2-column layout.

### 5.1 Top Bar

| Element          | Position | Behavior                                                            |
| ---------------- | -------- | ------------------------------------------------------------------- |
| Breadcrumb       | Left     | `← Nettside / {Sidenavn} / {Seksjonsnavn}` — each segment clickable |
| Save status pill | Center   | "Lagret", "Lagrer...", "Ulagrede endringer" with dot indicator      |
| Forhåndsvisning  | Right    | Blue button with eye icon, opens preview in new tab                 |
| Angre            | Right    | Undo last change (client-side history)                              |
| Publiser         | Right    | Green button, publishes all changes                                 |

### 5.2 Section Sidebar (Left Column)

**Width:** 280px fixed.

**Section list:**

- Each section: Lucide icon (by type) + section name + drag handle (visible on hover)
- Active section highlighted with accent border + subtle background
- Click section → loads its form in the right column
- Drag-to-reorder with optimistic sort_order update

**Section settings panel** (below list, for active section):

- Visibility toggle (show/hide on published site)
- Background variant: Default, Muted, Accent, Dark, Image
- Container width: Narrow, Default, Wide, Full
- Spacing: None, SM, MD, LG, XL

**Add section button** ("+" icon) — opens section picker dialog (section 6).

**Custom scrollbar:** 6px wide, ghost thumb (semi-transparent), track invisible.

### 5.3 Form Editor (Right Column)

Each section type renders a form driven by its Zod schema from `@smartout/website`.

**Form layout rules:**

- Short fields (text, select, toggle): 2-column grid
- Long fields (textarea, rich text): full width
- Image fields: full width with preview
- Grouped into collapsible sections: **Innhold**, **Layout**, **Media**

**Image upload widget:**

- Current image preview (thumbnail)
- "Bytt bilde" button (opens file picker)
- "Fjern" button (clears image reference)
- File metadata display: filename, dimensions (WxH), file size, upload date
- Alt-text field (required for accessibility)

### 5.4 Preview

Preview is **never** inline in the editor. Clicking "Forhåndsvisning" opens the actual public site rendering in a separate browser tab using a preview token. This ensures WYSIWYG fidelity — what you see in preview is exactly what gets published.

---

## 6. Section Picker Dialog

Opens when clicking "+" in the section sidebar.

### Layout

- Modal dialog with semi-transparent backdrop
- Search field at top (filters sections by name)
- Grid of available section types (3 columns)
- Each card: icon + name + short description

### Section Categories

**Content sections:**

| Type           | Name          | Icon              | Description                        |
| -------------- | ------------- | ----------------- | ---------------------------------- |
| `hero`         | Hero          | Image             | Full-width hero med bilde og tekst |
| `rich_text`    | Rik tekst     | Type              | Formatert tekst med overskrifter   |
| `text_image`   | Tekst + bilde | Columns           | Tekst ved siden av bilde           |
| `feature_grid` | Feature Grid  | Grid3x3           | Ikonkort i rutenett                |
| `gallery`      | Galleri       | Images            | Bildegalleri med lightbox          |
| `cta`          | CTA           | MousePointerClick | Handlingsoppfordring med knapp     |
| `testimonials` | Anmeldelser   | Quote             | Kundeanmeldelser                   |
| `faq`          | FAQ           | HelpCircle        | Sporsmal og svar                   |
| `map`          | Kart          | MapPin            | Innbygget kart                     |
| `footer`       | Footer        | PanelBottom       | Bunntekst med kontaktinfo          |

**System-connected sections** (marked with blue "System" badge):

| Type           | Name         | Icon            | Bridge Target           |
| -------------- | ------------ | --------------- | ----------------------- |
| `menu_full`    | Meny         | UtensilsCrossed | Menu module data        |
| `hours`        | Apningstider | Clock           | `company_opening_hours` |
| `spokesperson` | Talsperson   | UserCircle      | Employee profile        |

System sections pull live data from Smartout modules. Changes in these sections can propagate back to the source system (with appropriate warnings).

---

## 7. System-Connected Section Editors (Bridge Pattern)

Each system section creates a **bridge** between the website and live Smartout data. The pattern is consistent: blue info banner at top explaining the data source, inline editing where appropriate, yellow warning when changes affect the broader system.

### 7.1 Meny Editor (menu_full / menu_preview)

**Info banner (blue):**

> "Denne seksjonen henter data fra Menymodulen i Smartout."

**Layout:**

- Tab selector for menu (Hovedmeny, Lunsjmeny, Barmeny, Smaksmeny — from `websites.website_menu`)
- Custom section title + subtitle fields
- Course/category list with:
  - Checkbox to include/exclude each course on website
  - Inline price editing (overrides for website display)
  - "Rediger rett →" link per item — opens the item in the menu module (cross-module navigation)

**Warning banner (yellow):**

> "Endringer i menymodulen pavirker hele systemet, inkludert denne nettsiden."

**Data flow:** One-way read from menu module → website display. Price overrides are website-local (stored in section `content` JSONB). Menu module remains source of truth for item names, descriptions, allergens.

### 7.2 Apningstider Editor (hours)

**Info banner (blue):**

> "Disse er firmaets offisielle apningstider fra Smartout."

**Layout:**

- 7-row grid (Monday-Sunday)
- Each row: day name, open time input, close time input, open/closed toggle
- Current values pulled from `company_opening_hours`

**Warning banner (yellow):**

> "Endringer her oppdaterer firmaets offisielle apningstider i hele Smartout."

**Data flow:** Bidirectional. Editing hours here updates `company_opening_hours` (NOT `department_operating_hours`). This is intentional — the website shows company-level hours, not department-level. Changes require confirmation dialog.

### 7.3 Talsperson Editor (spokesperson)

The spokesperson section assigns a workspace employee as the public face on the website.

**Layout:**

- Person card: avatar, name, role (from `profile`)
- "Bytt person" button → opens employee picker (dropdown of workspace profiles)
- "Rolle pa nettsiden" text field (e.g., "Kjokkensjef", "Daglig leder")
- "Sitat" text field (displayed as pull-quote on website)
- "Beskrivelse" textarea (bio/description)
- Content schedule toggles:
  - Ukentlig foto (weekly photo upload task)
  - Manedlig sitat (monthly quote update task)
  - Skriv tekst (text content task)

**On assignment:** Triggers the spokesperson approval flow (section 10).

---

## 8. CTA Section Editor

Simple conversion-focused section.

**Fields:**

| Field            | Type     | Description                               |
| ---------------- | -------- | ----------------------------------------- |
| Overskrift       | text     | Main heading                              |
| Undertittel      | textarea | Supporting text                           |
| Knappetekst      | text     | Button label                              |
| Destinasjons-URL | url      | Third-party link (e.g., booking provider) |
| Apne i           | toggle   | "Ny fane" / "Samme vindu"                 |

The destination URL links to external services (DinnerBooking, OpenTable, custom booking). No internal routing.

---

## 9. Footer Section Editor

Toggleable content blocks with legal/GDPR compliance.

### Content Blocks (toggleable)

| Block            | Toggle | Content                                                                     |
| ---------------- | ------ | --------------------------------------------------------------------------- |
| Adresse          | on/off | Street, city, postal code (from `website.contact_address`)                  |
| Telefon & e-post | on/off | Phone + email (from `website.contact_phone/email`)                          |
| Sosiale medier   | on/off | Instagram, Facebook, TripAdvisor, Google Maps (from `website.social_links`) |
| Apningstider     | on/off | Compact hours display (from `company_opening_hours`)                        |
| Kart             | on/off | Embedded map of business location                                           |

### Legal Section (GDPR)

| Field                 | Type | Description                                       |
| --------------------- | ---- | ------------------------------------------------- |
| Personvernerklaering  | url  | Privacy policy link                               |
| Vilkar og betingelser | url  | Terms of service link                             |
| Cookies               | url  | Cookie policy link                                |
| Allergeninformasjon   | url  | Allergen info link                                |
| Organisasjonsnummer   | text | Norwegian org number                              |
| Copyright-tekst       | text | Auto-generated default: "© {year} {company.name}" |

All legal links are optional but recommended. Missing links show no entry (not broken links).

---

## 10. Spokesperson Approval Flow

When an admin assigns a spokesperson, a multi-step approval process ensures the employee consents to being a public representative.

### Flow Steps

```
Tilordnet → Sendt → Venter svar → Aktiv (or Avvist)
```

**Step-by-step:**

1. **Admin assigns person** — selects employee from workspace profiles, configures role title, content schedule
2. **System sends push notification** — via mobile app notification system
3. **Employee receives notification** — sees full details of what they're being asked to do
4. **Employee reviews and decides:**
   - **Godkjenn** → spokesperson becomes active, recurring tasks created in Engine
   - **Avvis** → admin notified, can reassign (employee optionally provides reason)
5. **On approval:** spokesperson data published to website on next publish cycle

### Admin View

Assignment card showing:

- Person (avatar, name, role)
- Website role title
- Responsibilities list (configured content tasks)
- Deadline for response
- Event timeline (sent, viewed, responded)
- Status badge: Venter (yellow), Aktiv (green), Avvist (red)

---

## 11. Mobile App Screens

### 11.1 Approval Screen (Push Notification)

**Notification card:**

- Restaurant name + "Talsperson-forespørsel"
- Person's own avatar and name
- Role on website (e.g., "Kjokkensjef og medgründer")
- What will be visible publicly:
  - Ditt navn og bilde
  - Din rolle
  - Sitat fra deg
  - Kort beskrivelse
- Responsibilities:
  - Last opp ukentlig foto
  - Oppdater sitat manedlig
  - Skriv tekst nar du onsker
- Frist for svar: date

**Action buttons:**

- "Godta" (green, primary)
- "Avslà" (red outline, secondary)
- Privacy note: small text explaining what data becomes public

### 11.2 After Approval

**Confirmation card:**

- Success message
- "Du er na talsperson for {restaurant}"
- Task list with status (pending/completed)
- Profile preview (how they appear on website)

### 11.3 Decline Screen

- Optional reason textarea ("Fortell oss gjerne hvorfor (valgfritt)")
- Confirmation dialog: "Er du sikker? Du kan alltid akseptere senere hvis du ombestemmer deg."

### 11.4 Content Creation

**Task list:**

- Overdue tasks (red badge)
- Upcoming tasks (yellow badge)
- Completed tasks (green checkmark)
- History feed

**Create content:**

- Upload photos (multi-image support)
- Write text with AI assist button
- **AI Writing Panel:**
  - 3 AI-generated suggestions based on uploaded image + restaurant profile
  - Custom prompt field for specific direction
  - Select suggestion → edit → submit
- Published content appears on website (on next publish or auto-publish if configured)

---

## 12. Recurring Content Tasks

### Admin Configuration (per spokesperson)

Each spokesperson can have multiple recurring tasks:

| Task Type      | Description                    | Configurable                            |
| -------------- | ------------------------------ | --------------------------------------- |
| Upload bilde   | Photo of kitchen, dining, team | Frequency, deadline day, instructions   |
| Skriv innlegg  | Blog-style text post           | Frequency, min/max length, instructions |
| Oppdater sitat | Fresh quote for website        | Frequency, deadline day                 |
| Egendefinert   | Custom task                    | All fields                              |

**Per-task configuration:**

- Frequency: Ukentlig / Annenhver uke / Manedlig
- Deadline: day of week/month
- Instructions: free text guidance for employee
- AI hint: "AI-hjelp aktiveres automatisk" (always on)

### Engine Integration

On spokesperson approval:

1. Create `engine_process` for recurring content workflow
2. Create `engine_state` instance for this spokesperson
3. Engine schedules tasks based on configured frequency
4. Tasks appear in employee's mobile task list
5. Completed tasks feed into website content pipeline

---

## 13. Mobile Admin (Responsive Web)

The admin builder at `/dashboard/website` is responsive for tablet/mobile access. Not a separate React Native screen — same route, Tailwind responsive classes.

### Overview (Mobile)

- Status card with site name, badge, domain link
- "Publiser" button (full width)
- Page list (stacked cards, tap to edit)
- "Vis nettside" link

### Section Editor (Mobile)

- Stacked layout (no 2-column split)
- Section list as horizontal scrollable tabs at top
- Form fields below
- **Edit / Preview tab toggle** at top — switches between form and mini-preview
- Preview tab shows section rendered in mobile viewport width

---

## 14. Telemetry Events

24 events across 6 categories. All emit via `@smartout/telemetry` `emit()`.

### Publisering (4)

| Event                     | Trigger                         | PostHog | Trail | Engine | Logger |
| ------------------------- | ------------------------------- | ------- | ----- | ------ | ------ |
| `website.published`       | Admin publishes changes         | x       | x     | x      | x      |
| `website.unpublished`     | Admin takes site offline        | x       | x     | x      | x      |
| `website.rollback`        | Admin restores previous version | x       | x     | x      | x      |
| `website.preview_created` | Preview token generated         |         | x     |        | x      |

### Innhold (8)

| Event                       | Trigger                    | PostHog | Trail | Engine | Logger |
| --------------------------- | -------------------------- | ------- | ----- | ------ | ------ |
| `website.page_created`      | New page added             | x       | x     |        | x      |
| `website.page_deleted`      | Page removed               | x       | x     |        | x      |
| `website.page_reordered`    | Page sort order changed    |         | x     |        | x      |
| `website.section_created`   | Section added to page      | x       | x     |        | x      |
| `website.section_updated`   | Section content saved      |         | x     |        | x      |
| `website.section_deleted`   | Section removed            | x       | x     |        | x      |
| `website.section_reordered` | Section sort order changed |         | x     |        | x      |
| `website.asset_uploaded`    | Image/PDF uploaded         |         | x     |        | x      |

### Talsperson (5)

| Event                                    | Trigger                    | PostHog | Trail | Engine | Logger | Notifications |
| ---------------------------------------- | -------------------------- | ------- | ----- | ------ | ------ | ------------- |
| `website.spokesperson_assigned`          | Admin assigns spokesperson | x       | x     | x      | x      | x             |
| `website.spokesperson_approved`          | Employee accepts           | x       | x     | x      | x      | x             |
| `website.spokesperson_declined`          | Employee declines          | x       | x     | x      | x      | x             |
| `website.spokesperson_content_submitted` | Employee submits content   | x       | x     | x      | x      |               |
| `website.spokesperson_task_overdue`      | Task passes deadline       |         | x     | x      | x      | x             |

### System-koblinger (3)

| Event                          | Trigger                                  | PostHog | Trail | Engine | Logger |
| ------------------------------ | ---------------------------------------- | ------- | ----- | ------ | ------ |
| `website.menu_synced`          | Menu data refreshed from module          |         | x     |        | x      |
| `website.hours_updated`        | Opening hours changed via website editor | x       | x     |        | x      |
| `website.system_section_added` | System-connected section added           | x       | x     |        | x      |

### Domene & Preview (2)

| Event                       | Trigger                       | PostHog | Trail | Engine | Logger |
| --------------------------- | ----------------------------- | ------- | ----- | ------ | ------ |
| `website.domain_configured` | Custom domain added (Phase 2) | x       | x     |        | x      |
| `website.slug_changed`      | Site slug updated             | x       | x     |        | x      |

### Template (2)

| Event                       | Trigger                         | PostHog | Trail | Engine | Logger |
| --------------------------- | ------------------------------- | ------- | ----- | ------ | ------ |
| `website.template_selected` | Template chosen in setup wizard | x       | x     |        | x      |
| `website.setup_completed`   | Setup wizard finished           | x       | x     | x      | x      |

**Total: 24 events** (4 + 8 + 5 + 3 + 2 + 2)

---

## 15. Data Model Notes

Plan B uses the schema defined in Plan A (`2026-03-21-website-factory-design.md`). No additional tables needed.

**New section types to add to CHECK constraint:**

- `spokesperson` — for the spokesperson/talsperson section

This requires a migration to extend the `section_type` CHECK constraint on `websites.website_section`:

```sql
ALTER TABLE websites.website_section
  DROP CONSTRAINT website_section_section_type_check,
  ADD CONSTRAINT website_section_section_type_check
    CHECK (section_type IN (
      'hero', 'rich_text', 'text_image', 'feature_grid', 'gallery',
      'testimonials', 'cta', 'hours', 'map', 'contact',
      'menu_preview', 'menu_full', 'faq', 'booking_cta',
      'pdf_viewer', 'footer', 'spokesperson'
    ));
```

**Spokesperson data storage:** Spokesperson assignment metadata (profile reference, role title, quote, description, approval status, content schedule config) is stored in the section `content` JSONB column, validated by a `spokesperson` Zod schema in `@smartout/website`.

---

## 16. Implementation Phases

### Phase B1: Core Builder (MVP)

**Goal:** Admins can create a website from a template, edit sections, and publish.

| Task                                                                                                 | Priority |
| ---------------------------------------------------------------------------------------------------- | -------- |
| Setup wizard (3 steps)                                                                               | P0       |
| Overview page                                                                                        | P0       |
| Section editor (2-column layout)                                                                     | P0       |
| Section picker dialog                                                                                | P0       |
| Content section editors (hero, rich_text, text_image, feature_grid, gallery, testimonials, cta, faq) | P0       |
| Footer section editor                                                                                | P0       |
| Image upload widget                                                                                  | P0       |
| Page management (add, delete, reorder, visibility)                                                   | P0       |
| Save + autosave                                                                                      | P0       |
| Sidebar navigation entry                                                                             | P0       |
| Template gallery (start with 4-5 templates)                                                          | P1       |
| Full-page template preview                                                                           | P1       |
| Drag-to-reorder (sections + pages)                                                                   | P1       |
| Section settings panel (background, width, spacing)                                                  | P1       |
| Responsive mobile admin                                                                              | P1       |

### Phase B2: System Sections + Spokesperson

**Goal:** Bridge to Smartout data modules and spokesperson flow.

| Task                                     | Priority |
| ---------------------------------------- | -------- |
| Menu editor (bridge pattern)             | P0       |
| Opening hours editor (bridge pattern)    | P0       |
| Spokesperson editor + employee picker    | P0       |
| Spokesperson approval flow (admin side)  | P0       |
| Mobile app: approval notification screen | P0       |
| Mobile app: accept/decline flow          | P0       |
| Recurring content task configuration     | P1       |
| Mobile app: content creation + AI assist | P1       |
| AI writing panel (3 suggestions)         | P1       |
| Content task engine integration          | P1       |

### Phase B3: Polish + Scale

**Goal:** Full template library, premium tiers, advanced features.

| Task                                     | Priority |
| ---------------------------------------- | -------- |
| All 20 templates implemented             | P1       |
| Template tier gating (Basic/Pro/Premium) | P1       |
| Premium template payment integration     | P2       |
| Theme editor page                        | P1       |
| History/revision browser                 | P1       |
| Undo/redo (client-side)                  | P2       |
| Map section (embed)                      | P2       |
| Contact section                          | P2       |
| Menu PDF viewer section                  | P2       |

---

## 17. Constraints and Non-Goals

### Constraints

- **No freeform HTML** — all content through structured Zod-validated forms
- **No inline WYSIWYG** — preview is always separate tab
- **No custom CSS** — styling via theme tokens and section settings only
- **No drag-and-drop between pages** — sections belong to one page
- **One website per workspace** — MVP limitation
- **Admin/owner only** — managers and employees cannot access builder

### Non-Goals (out of scope for Plan B)

- Custom domain management (Phase 2)
- Contact form submissions (Phase 2)
- Blog/news page type (future)
- Multi-language website support (future)
- A/B testing (future)
- Analytics dashboard for public site (future — PostHog handles this)
- E-commerce / online ordering integration (future)
- SEO editor beyond meta title/description (future)

---

## Changelog

| Date       | Change                                                                |
| ---------- | --------------------------------------------------------------------- |
| 2026-03-22 | Initial version — complete Plan B design spec from brainstorm mockups |
