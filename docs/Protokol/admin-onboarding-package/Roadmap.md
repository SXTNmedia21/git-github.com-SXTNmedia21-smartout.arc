---
title: "Roadmap: Admin Onboarding"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: onboarding
tags: [roadmap, onboarding, owner]
---

# Roadmap: Admin Onboarding

## Package Identity

- Package ID: `JP-R001-ADMIN-ONBOARDING`
- Roadmap ID: `R-001`
- Journey ID: `J-001`
- Mission ID: `M-001`
- License ID: `L-001`

Related package docs:

- `docs/Roadmaps/Admin onboarding/Journey.md`
- `docs/Roadmaps/Admin onboarding/Mission.md`
- `docs/Roadmaps/Admin onboarding/Lisence.md`

## Business Intent

A new business owner signs up for Smartout and needs to go from zero to an operational workspace — with departments, locations, procedures, season, and a contract template — in roughly five minutes. This is the critical first impression: if onboarding is slow or confusing, the owner never returns.

Botsson (the AI assistant) acts as a co-pilot, using voice conversation to search Norwegian business registries (Brreg), enrich with Google Places data, scrape the company website, and propose industry-appropriate defaults. The owner confirms or corrects. Manual fallback exists for every AI-assisted step. The result is a fully configured workspace ready to receive employees.

## Actor & Platform

| Field    | Value         |
| -------- | ------------- |
| Actor    | Owner (admin) |
| Platform | Web (desktop) |
| Priority | P0            |
| Module   | onboarding    |

## Scope

### In scope

- Account creation (email/password or Google SSO)
- Company identification via Brreg search and org.nr lookup
- Data enrichment via Google Places API and web scraping (Scrapling)
- AI-assisted mode (Botsson voice via Ultravox) and manual mode
- Season setup with industry-based suggestions
- Department generation from NACE code
- Location and zone setup (with scrape-sourced pre-fill)
- Procedure baseline selection from industry defaults
- Contract template generation
- Workspace finalization (Edge Function: finalize-workspace)
- Redirect to dashboard on completion

### Out of scope

- Employee invitation flow (J-002)
- Stripe billing setup (happens automatically via trial trigger)
- Post-onboarding workspace editing (separate CRUD journeys)
- Mobile onboarding (desktop only for admin)
- Multi-workspace creation in a single session
- Custom procedure authoring (only selection from defaults)

## Success Criteria

1. Owner completes onboarding and lands on dashboard with a functional workspace in under 5 minutes (assisted mode)
2. Workspace contains at least one department, one location, one season, and one procedure after finalization
3. Admin profile is created with role=owner and linked to the workspace
4. All auto-generated data retains provenance metadata (source: brreg/places/scrape/user)
5. Interruption at any step preserves progress — onboarding can be resumed

## Related Journeys

| Relation | Journey                             | Why                                                            |
| -------- | ----------------------------------- | -------------------------------------------------------------- |
| Leads to | J-002 Employee Accepts Invite       | After workspace is created, owner invites employees            |
| Leads to | J-003 Login & Route to Context      | After onboarding, owner logs in and routes to dashboard        |
| Leads to | J-004 Complete Trainee Core Journey | Establishes the workspace that trainee journeys execute within |

## Acceptance Criteria

These map directly to verification gates in the License:

1. User can complete each onboarding step and correct AI-generated suggestions (User Test)
2. Admin can explain what was auto-generated vs manually confirmed, and knows where to edit entities post-onboarding (Knowledge Test)
3. Finalization creates workspace, departments, locations, season, procedures, contract template, and admin profile with valid relationships (Function Test)
4. Full signup -> onboarding -> finalize -> dashboard route passes automated assertions (E2E Test)

## Event Motor Pattern

- **Start-hook:** User clicks "Kom i gang" on landing page, completes auth, has no existing workspace, and navigates to `/onboarding`
- **Events:**
  - `company.searched` — Brreg query executed
  - `company.identified` — Org.nr confirmed, enrichment complete
  - `website.scraped` — Company website data extracted
  - `season.proposed` — Industry-based season dates suggested
  - `departments.proposed` — NACE-derived departments generated
  - `locations.proposed` — Scrape-sourced locations pre-filled
  - `procedures.proposed` — Industry default procedures offered
  - `contract.generated` — Contract template created
  - `workspace.finalized` — Edge Function creates all entities
- **Stop-hook:** `workspace.finalized` succeeds, admin profile created with role=owner, user redirected to `/dashboard`
