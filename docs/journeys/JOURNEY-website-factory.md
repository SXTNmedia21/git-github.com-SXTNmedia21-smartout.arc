---
title: User Journeys — Website Factory
status: done
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [website, builder, journeys, spokesperson]
---

# User Journeys — Website Factory

## Journey: Admin Creates Website from Template

**Precondition:** Workspace exists, admin is logged in, no website exists yet (`has_website = false`).

1. Admin navigates to `/dashboard/website` → System redirects to `/dashboard/website/setup`
2. Admin sees setup wizard Step 1 (Velg mal) → System shows template gallery with tier badges and category filters
3. Admin clicks "Forhåndsvisning" on a template → System opens full-page preview overlay with device switcher
4. Admin navigates templates with ← → arrows or keyboard → System updates preview
5. Admin clicks "Velg denne malen" → System highlights template, enables "Neste" button
6. Admin proceeds to Step 2 (Tilpass) → System pre-fills name from workspace, shows color pickers and font selector
7. Admin adjusts branding and clicks "Neste" → System shows Step 3 (Ferdig) summary
8. Admin clicks "Opprett nettside" → System calls `createWebsiteFromTemplate()`:
   - Creates website row with template key and theme
   - Creates pages from template manifest
   - Creates sections with defaults per page
   - Creates domain `{slug}.smartout.info`
   - Sets `has_website = true`
   - Creates draft revision
   - Emits `website setup completed` telemetry
9. Admin sees overview page → System shows site name, status badge, stats, page list

**Postcondition:** Website exists in draft state, all template pages and sections created.

**Error paths:**

- Template not found → Error toast, stays on Step 1
- Slug already taken → Error toast on Step 3, admin must change name
- Network error → Error toast, form state preserved

---

## Journey: Admin Edits Section Content

**Precondition:** Website exists, admin is on overview page.

1. Admin clicks a page row in page list → System navigates to `/dashboard/website/pages/{pageId}`
2. Admin sees 2-column editor: section sidebar (left) + form area (right) → System loads sections via `useSections()`
3. Admin clicks a section in sidebar → System highlights it, loads editor form for that section type
4. Admin edits form fields (text, images, toggles) → System marks form as dirty ("Ulagrede endringer" orange pill)
5. Admin presses Cmd+S → System saves via `updateSectionContent()`, creates draft revision, shows "Lagret" green pill
6. If admin doesn't save manually, autosave fires after 60s → System saves with `source = 'autosave'`

**Postcondition:** Section content persisted, draft revision created.

**Error paths:**

- Zod validation fails → Error toast with field-level message
- Network error during save → Error toast, content preserved in form
- Session expired → Redirect to login

---

## Journey: Admin Reorders Sections

**Precondition:** Page has multiple sections.

1. Admin hovers over section in sidebar → System reveals grip handle
2. Admin drags section to new position → System shows drag preview with reduced opacity
3. Admin drops section → System optimistically updates order, calls `reorderSections()` mutation
4. System emits `website sections reordered` telemetry

**Postcondition:** Section sort_order updated in database.

**Error paths:**

- Reorder fails → Reverts to previous order, error toast

---

## Journey: Admin Manages Pages

**Precondition:** Website exists with at least one page.

1. Admin clicks "Legg til side" → System opens dialog with title, page type, and slug inputs
2. Admin fills form, clicks create → System calls `createPage()`, validates against page limit
3. New page appears in list → Admin can click to edit sections
4. Admin toggles eye icon on a page → System calls `togglePageVisibility()`, page hidden from public site
5. Admin clicks trash on non-home page → System shows confirmation, calls `deletePage()` (soft delete)
6. Admin drags page rows → System reorders (home page stays pinned at top)

**Postcondition:** Pages created/hidden/deleted/reordered as requested.

**Error paths:**

- Page limit exceeded → Error toast with max page count
- Delete home page → Button disabled, not possible
- Duplicate slug → Error toast

---

## Journey: Admin Configures Section Settings

**Precondition:** Section is selected in editor sidebar.

1. Admin clicks "Innstillinger" in sidebar below section list → System expands collapsible settings panel
2. Admin changes background variant (Standard/Dempet/Aksent/Mork/Bilde) → System updates with 500ms debounce
3. Admin changes container width (Smal/Standard/Bred/Full) → System persists via `updateSectionSettings()`
4. Admin changes spacing (Ingen/Liten/Medium/Stor/Ekstra stor) → System persists

**Postcondition:** Section settings updated in database, reflected on next publish.

---

## Journey: Admin Publishes Website

**Precondition:** Website has unpublished changes.

1. Admin clicks "Publiser endringer" on overview or editor → System calls `publishWebsite()`:
   - Builds snapshot from all current pages, sections, menus, assets
   - Computes SHA-256 hash for dedup
   - Creates immutable snapshot record with version number
   - Revalidates ISR cache
   - Emits `website published` telemetry
2. Admin sees updated version number in stats → Public site reflects changes within ISR window

**Postcondition:** Snapshot published, public site updated.

**Error paths:**

- No changes since last publish → Hash dedup prevents duplicate snapshot
- Snapshot too large → Error with size limit message

---

## Journey: Admin Previews Website

**Precondition:** Website exists.

1. Admin clicks "Forhåndsvisning" → System calls `createPreviewToken()`, generates 24h token
2. System opens `{slug}.smartout.info?preview={token}` in new browser tab
3. Preview renders current draft content (not published snapshot)

**Postcondition:** Admin sees WYSIWYG preview of current draft.

---

## Journey: Admin Assigns Spokesperson

**Precondition:** Website has a spokesperson section added to a page.

1. Admin selects spokesperson section in editor → System shows EmployeePicker
2. Admin searches for employee by name → System filters workspace profiles
3. Admin selects employee, fills role title → System shows "Tilordne talsperson" button
4. Admin configures content tasks (photo upload weekly, quote monthly, etc.) → ContentTaskConfig
5. Admin clicks assign → System calls `assignSpokesperson()`:
   - Creates `website_spokesperson` record with status `pending`
   - Emits `website spokesperson_assigned` telemetry
6. Admin sees SpokespersonApprovalCard with "Venter" yellow badge

**Postcondition:** Spokesperson assigned, waiting for employee response.

**Error paths:**

- Employee already assigned as spokesperson → Upsert replaces existing
- Network error → Error toast

---

## Journey: Employee Approves Spokesperson Role (Mobile)

**Precondition:** Admin assigned employee as spokesperson, notification received.

1. Employee opens mobile app, navigates to spokesperson approval screen
2. Employee sees ApprovalCard: restaurant name, role, what becomes visible, task list, deadline
3. Employee reads privacy note about public data
4. Employee taps "Godta" → System updates status to `approved`, sets responded_at
5. System emits `website spokesperson_approved` telemetry
6. Employee sees confirmation: "Du er na talsperson for {restaurant}"

**Postcondition:** Spokesperson active, recurring tasks can be created by engine.

**Error paths:**

- Employee taps "Avslå" → Optional reason TextInput, Alert confirmation
- On decline: status set to `declined`, admin notified, admin can reassign

---

## Journey: Employee Creates Content (Mobile)

**Precondition:** Employee is an approved spokesperson with active content tasks.

1. Employee opens ContentTaskList → System shows tasks with status badges (overdue red, upcoming yellow, completed green)
2. Employee taps an overdue or upcoming task → System opens ContentCreator
3. Employee uploads photos via camera/gallery (up to 5) → System shows image previews
4. Employee taps "AI-hjelp" → System opens AiWritingPanel with 3 suggestions
5. Employee taps a suggestion → Text fills into editor, employee can edit
6. Employee taps "Send inn" → System submits content, emits `website spokesperson_content_submitted`

**Postcondition:** Content submitted, appears on website on next publish.

**Error paths:**

- No photos → Can still submit text-only
- AI panel fails → Stub suggestions shown, custom prompt available
- Network error → Error alert, content preserved locally

---

## Journey: Admin Configures System Bridge — Hours

**Precondition:** Hours section added to a page.

1. Admin selects hours section → System loads HoursEditor with company_opening_hours data
2. Admin sees blue banner: "Disse er firmaets offisielle apningstider fra Smartout."
3. Admin edits opening/closing times for each day, toggles "Stengt" for closed days
4. Admin sees yellow warning: "Endringer her oppdaterer firmaets offisielle apningstider i hele Smartout."
5. Admin clicks save → System shows AlertDialog confirmation
6. Admin confirms → System calls `updateCompanyHours()`, updates company_opening_hours table
7. System emits `website hours_updated` telemetry

**Postcondition:** Company-level opening hours updated across all Smartout systems.

**Error paths:**

- Admin cancels confirmation → No changes saved
- Invalid time format → Validation error

---

## Journey: Admin Configures System Bridge — Menu

**Precondition:** Menu section added to a page, workspace has menus in menu module.

1. Admin selects menu_full section → System loads MenuFullEditor with workspace menus
2. Admin sees blue banner: "Denne seksjonen henter data fra Menymodulen i Smartout."
3. Admin uses tabs to switch between menus (Hovedmeny, Lunsjmeny, etc.)
4. Admin toggles include/exclude for each menu → Updates menuIds in section content
5. Admin configures display toggles (prices, descriptions, allergens, images)
6. Admin sees yellow warning: "Endringer i menymodulen pavirker hele systemet."

**Postcondition:** Menu display configured, data sourced live from menu module on publish.

**Error paths:**

- No menus exist → Empty state with link to `/dashboard/menu`
- Menu module data changes → Website reflects changes on next publish
