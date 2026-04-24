---
title: "Nordic Split — Typography"
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [nordic-split, design, typography]
---

# Typography

Source of truth: `packages/design-tokens/src/tokens.ts` — font stacks and scale values live there.

---

## Fonts

| Font             | Class          | Role                               |
| ---------------- | -------------- | ---------------------------------- |
| Instrument Serif | `font-heading` | Headings, brand moments, hero text |
| Geist Sans       | (default body) | All UI text, labels, body copy     |
| Geist Mono       | `font-mono`    | Numbers, data, KPIs, code          |

Instrument Serif carries warmth and editorial authority. Geist Sans keeps the UI clean and modern. Geist Mono makes numbers feel precise and trustworthy.

---

## Type Scale

| Name          | Size                             | Usage                         |
| ------------- | -------------------------------- | ----------------------------- |
| Hero          | clamp(3.5rem, 6vw, 6rem)         | Landing, brand panel main     |
| Brand Panel   | 42px                             | Panel headline                |
| Page Heading  | 32px                             | Dashboard page title          |
| Section       | 24px                             | Section header                |
| Card Title    | 20px                             | Card header                   |
| Subsection    | 18px                             | Sub-header, dialog title      |
| Body Large    | 16px                             | Lead text, key description    |
| Body          | 15px                             | Default body copy             |
| UI Text       | 14px                             | Labels, nav items, buttons    |
| Form Label    | 13px                             | Input labels, field hints     |
| Caption       | 12px                             | Secondary metadata            |
| Meta          | 11px                             | Timestamps, micro-copy        |
| Section Label | 10px, uppercase, tracking-widest | Group dividers, table headers |
| Badge         | 9px, uppercase                   | Status chips, tags            |
| KPI Number    | 30px, font-black, font-mono      | Dashboard metrics             |

---

## Weights

| Weight           | Usage                               |
| ---------------- | ----------------------------------- |
| 400              | Body text, descriptions             |
| 500              | Labels, navigation links            |
| 600              | Buttons, card titles, emphasized UI |
| 700              | Page headings, section titles       |
| 900 (font-black) | KPI numbers, hero accent            |

---

## Letter Spacing

| Context                 | Value                      |
| ----------------------- | -------------------------- |
| Headings                | -0.02em (tight)            |
| Body                    | 0 (normal)                 |
| Section labels / badges | 2px wide (tracking-widest) |

---

## Icons

- **Lucide React only.** No emoji in UI. No other icon libraries.
- Default size: 20px
- Small / inline: 16px
- Always match icon weight visually to surrounding text weight
- Icons inherit `currentColor` — never hardcode icon colors
