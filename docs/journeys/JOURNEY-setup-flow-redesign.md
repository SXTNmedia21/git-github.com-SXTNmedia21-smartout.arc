---
title: "User Journeys — setup-flow-redesign"
status: done
updated: 2026-03-22
created: 2026-03-22
module: onboarding
tags: [journeys, data-pipeline, design-tokens]
---

# User Journeys — setup-flow-redesign

## Journey: Owner — Complete Setup Flow (Join → Onboarding → Dashboard Wizard)

**Precondition:** User has no account. Arrives at /join.

### Phase 1: /join (Account Creation)

1. User enters company name and selects industry → System maps industry to NACE code via INDUSTRY_NACE_MAP
2. User enters org number, address → System stores in brreg block with naceCode
3. System scrapes website → extracts email, phone, socialLinks, openingHours, logoUrl, images, menus, reservationUrl
4. AI generates aboutUs, ourHistory, ourConcept, restaurantType, cuisineTypes, priceCategory, menuDescription → User confirms/edits
5. User completes signup → `completeSignup()` writes to company, company_details (with field_sources JSONB), company_opening_hours, company_social_media, workspace.intelligence_data
6. User sees redirect to /onboarding

**Postcondition:** Account created, all scraped + AI-generated + user-input data persisted with source tracking.

### Phase 2: /onboarding (Workspace Setup)

1. User arrives at /onboarding → System calls resume(), reads workspace.intelligence_data
2. System restores ALL join data: business info + ourHistory, ourConcept, restaurantType, cuisineTypes, priceCategory, menuDescription, socialLinks, logoUrl, reservationUrl, menuLinks → User sees pre-filled sections
3. System uses NACE code to pre-select departments from I1 bootstrap → User toggles/adds departments
4. User adds locations and zones
5. System pre-selects procedures from NACE → User toggles/adds procedures
6. User configures first season (name, dates, optional revenue/margin)
7. User clicks Finalize → System calls finalize_onboarding_workspace RPC:
   - Creates departments, locations, procedures, season
   - UPSERTS company_details with all narrative/menu fields + field_sources
   - Updates company with phone/email
   - Upserts company_social_media
   - Marks workspace.onboarding_completed = true
8. User redirected to dashboard

**Postcondition:** Workspace fully bootstrapped. All data in DB tables (not just intelligence_data).

### Phase 3: Dashboard Wizard (Post-Onboarding Configuration)

1. User enters dashboard wizard → System queries company, company_details, company_opening_hours, company_social_media via TanStack Query
2. WelcomeStep shows ALL data: name, address, phone, email, industry, Google rating, aboutUs, socialLinks → User can inline-edit any fact
3. User edits a fact → System persists to company/company_details on blur, updates field_sources to "user_input"
4. GovernanceStep → If user uploaded documents with policies, system auto-selects matching templates; existing procedures from onboarding pre-selected
5. PayrollStep → Extracted tariff name matched; extracted supplements (kveldstillegg, helgetillegg) pre-fill fields
6. EmploymentStep → Extracted noticePeriod pre-fills the notice period field
7. TeamStep → User selects department → System suggests template positions from POSITION_MAP (Kokk, Servitor, etc.)
8. HandbookStep → Chapters enriched with real data:
   - Identity/mission: aboutUs, ourHistory, ourConcept, cuisineTypes, menuDescription
   - Communication: socialLinks, phone, email, website
   - Quality/service: restaurantType, priceCategory, cuisineTypes
   - Document extraction overrides static content when available
9. User completes wizard → All content generated with source badges

**Postcondition:** Full workspace configuration complete. All content reflects real business data, not boilerplate.

**Error paths:**

- Scrape fails → User enters data manually, source tracked as "user_input"
- NACE code not in map → Falls back to default departments/procedures
- Resume with no intelligence_data → Falls back to onboarding_session table (legacy)
- Document extraction empty → Steps use industry defaults, chapters use static content
- Inline edit fails to persist → Toast error, local state preserved, retry on next blur

---

## Journey: Owner — Design Token Consistency

**Precondition:** User navigates any of the three flows.

1. /join → All colors use CSS variable tokens (--brand-orange, --success, --warning, --destructive). Font headings use font-heading class.
2. /onboarding → Semantic status colors use tokens (destructive, success, warning, info). Dark theme intentional whites preserved.
3. Dashboard wizard → No isDark ternaries. All components use border-border, bg-muted, text-foreground, text-muted-foreground. Dark mode handled automatically by CSS variable system.

**Postcondition:** Visual consistency across all three flows. Theme changes propagate automatically.

**Error paths:** None — design tokens are compile-time, not runtime.
