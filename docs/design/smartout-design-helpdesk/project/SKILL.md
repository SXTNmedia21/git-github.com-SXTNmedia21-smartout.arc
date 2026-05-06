---
name: smartout-design
description: Use this skill to generate well-branded interfaces and assets for Smartout (Nordic Split design system), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Smartout is a Norwegian Employee Readiness System for shift-based companies (restaurants, hotels, service). The design system is called **Nordic Split** — Scandinavian minimalism with warm glowing tones. Three surfaces: marketing site, web dashboard, mobile app. UI ships in Norwegian Bokmål.

**Essentials:**
- Link `colors_and_type.css` for tokens + type styles (`.t-hero`, `.t-kpi`, etc.)
- Warm neutrals only — never `#6b7280`, never pure white/black
- Brand orange `oklch(0.65 0.22 40)` = CTAs + focus rings
- Instrument Serif (headings) + Geist Sans (body) + Geist Mono (numbers)
- Lucide icons, 20px default, no emoji in UI
- Spring physics motion (not linear) — Framer Motion for enter/exit
- Ambient orbs only on the Nordic Split dark auth panel

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
