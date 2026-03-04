---
title: "Journey — Landing Mobile Fix"
status: done
updated: 2026-03-19
created: 2026-03-19
module: landing
tags: [mobile, responsive, landing, journey]
---

# Journey — Landing Mobile Fix

## Journey: Visitor views landing page on mobile device

**Precondition:** User opens smartout.ai on a phone (viewport < 640px)

1. User loads the page → Hero text renders at 3xl (smooth, no overflow) → User sees clean headline
2. User sees two CTA buttons stacked vertically, full-width → Buttons have 44px+ touch targets (py-4)
3. User scrolls past hero → Dashboard mockup is hidden on mobile (no wasted whitespace)
4. User reaches partner logos → Logos display at text-lg with tighter gap (gap-12) → No horizontal overflow
5. User scrolls to procedures section → Grid displays as single column → Cards are full-width, easy to read
6. User taps navigation hamburger → Mobile menu opens with proper touch targets (py-3 per link)
7. User taps "Kom i gang" CTA in nav → Button has proper touch target (py-2.5) → Navigates to onboarding

**Postcondition:** User can navigate the entire landing page without horizontal scroll, cramped text, or undersized touch targets

**Error paths:**

- Viewport between 640-768px (sm breakpoint): Two-column layouts engage, buttons go side-by-side
- Very narrow viewport (<320px): Text wraps naturally, no overflow due to relative sizing

## Journey: Visitor views pricing page on mobile device

**Precondition:** User navigates to /pricing on a phone

1. User sees pricing cards → Cards have reduced padding (p-6 instead of p-10) and rounded-3xl border-radius
2. User scrolls between Essential and Pro plans → Cards stack vertically in single column
3. User taps "Velg Pro" or "Kom i gang" → Full-width CTA button, easy to tap

**Postcondition:** Pricing cards are readable and not cramped on mobile screens

## Journey: Visitor views footer on mobile device

**Precondition:** User scrolls to bottom of any landing page

1. User sees footer → Links display in single column (grid-cols-1) → No cramped two-column layout
2. User taps any footer link → Navigates correctly
3. User taps "Toppen" → Smooth scroll to top

**Postcondition:** Footer is fully readable and navigable on mobile
