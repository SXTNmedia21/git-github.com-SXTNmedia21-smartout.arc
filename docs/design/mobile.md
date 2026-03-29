---
title: "Nordic Split — Mobile"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design, mobile]
---

# Mobile

Mobile tokens: `packages/design-tokens/src/native.ts`

All web dashboard features must be designed for mobile from the start. Shared data hooks go in `packages/`, not `apps/web/`. Mobile UI can ship in a follow-up PR, but architecture must never be web-only.

---

## Phone Frame (Design Mockups)

Used in landing pages and marketing views to showcase the app.

- Width: 320px
- Height: 600px
- Radius: `rounded-[32px]`
- Border: 3px, muted/border color
- Shadow: `0 20px 60px rgba(0,0,0,0.4)` (deep, floating)
- Notch: 120px wide × 24px tall, centered at top

---

## Tab Bar

- Height: 64px
- Items: 5 (Home, Vakter, FAB center, Komm, Meg)
- Background: panel surface or `bg-card` with top border
- Active item: brand color (`text-brand`), font-weight 600
- Inactive: muted foreground
- Press feedback: `scale(0.92)`

**FAB (center action button):**

- Size: 52px circle
- Position: elevated -20px above tab bar baseline
- Background: brand orange
- Shadow: `0 4px 16px rgba(249,115,22,0.4)`
- Icon: white, 24px

---

## Chat Bubbles

| Who          | Radius             | Background                         |
| ------------ | ------------------ | ---------------------------------- |
| Own messages | 16px 16px 4px 16px | Brand orange bg, white text        |
| Other / AI   | 16px 16px 16px 4px | `bg-card` / bg2, `text-foreground` |

Timestamps: 11px, muted, centered below message group.

---

## Active Shift Card

Displayed when an employee is clocked in on a shift.

- Background: brand orange
- Timer: monospace 22px font-bold (Geist Mono), live-counting
- Content: department name + shift time range
- Action: End Shift button (full width, white text, brand bg with white border)

---

## Task List Items

- Vertical padding: 12px
- Status indicator: 8px dot, status color (left-aligned)
- Text: UI Text (14px) body weight
- Right: chevron-right icon, muted

---

## Payroll View

- Month header: Section font (24px), bold, with month/year
- Earnings breakdown: each line item is label (left) + amount (right), Geist Mono for amounts
- Supplement badges: inline after line item, semantic bg at 10% with trust label (e.g. "Kveldstillegg")
- Total row: bold, larger (20px), separated by border

---

## Rules

- Touch targets minimum 44px height (Apple HIG compliance)
- No hover states on mobile — use press states (`scale(0.92)` or opacity feedback)
- Safe area insets: always account for notch and home bar (`SafeAreaView`)
- Native tokens (`native.ts`) for colors — never import CSS variables into React Native
- Fonts: same names (`font-heading`, `font-mono`) but loaded via Expo font system
