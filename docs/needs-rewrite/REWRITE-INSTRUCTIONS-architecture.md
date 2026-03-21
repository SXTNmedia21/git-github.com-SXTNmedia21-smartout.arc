---
title: "Rewrite Instructions — Architecture Files"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [rewrite, cascade, architecture]
---

# Rewrite Instructions — Architecture Files

## SMARTOUT_IMPLEMENTATION_GUIDE.md

- **Extract:** Phase 0 Foundation description (still valid as permanent reference)
- **Drop:** Phases 1-11 build order (superseded by cascade Phase A-D)
- **Target:** Create a new `architecture/SMARTOUT_IMPLEMENTATION_FOUNDATIONS.md` with Phase 0 content
- **Or:** Simply archive if BUILD_ORDER.md covers the same ground

## SMARTOUT_UI_ARCHITECTURE.md

- **Extract:** Four-persona journey maps and UX principles (still useful)
- **Drop:** Module-phased screen inventory (superseded by cascade + current routes)
- **Target:** Create updated screen inventory aligned with current ROUTES.md
- **Or:** Merge persona definitions into SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md

## SMARTOUT_ADMIN_KEY_MANAGEMENT.md

- **Extract:** Admin UI routes and dashboard layout for key management
- **Drop:** Old key model references if they predate ADR-0028
- **Target:** Merge into SMARTOUT_SECRET_API_INFRASTRUCTURE.md as "Admin UI" section
