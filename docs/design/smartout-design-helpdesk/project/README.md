# Smartout — Nordic Split Design System

**Smartout** is an Employee Readiness System for shift-based companies in Norway — primarily restaurants, hotels and service businesses. This design system ("Nordic Split") is the visual language that runs across Smartout's marketing site, web dashboard, and mobile app.

> "Elegant Nordic cleanness meets warm, glowing tones. White space, spring motion, and weight. The system feels alive — never flat, never cold. Scandinavian minimalism with a warm, organic heart."

The name comes from the signature two-panel layout: a dark brand panel alive with ambient orbs, split against a clean light form surface.

---

## Products covered

| Product | Stack | Purpose |
| --- | --- | --- |
| **Marketing site** (`apps/landing`) | Next.js + Tailwind + shadcn | smartout.ai — content blocks, demo journeys, docs, blog |
| **Web dashboard** (`apps/web`) | Next.js + Tailwind + shadcn + Framer Motion | Manager app — shifts, employees, training, HMS, onboarding wizards |
| **Mobile app** (`apps/mobile`) | React Native / Expo | Employee app — today's shift, tasks, channels, payroll |

The mobile app is **employee-centric** — no admin/manager views. Managers use the web dashboard. The mobile app answers one question: *"What do I need to know and do for my shift today?"*

---

## Sources consulted

| What | Where |
| --- | --- |
| Canonical spec (Norwegian) | `design-docs/SMARTOUT-DESIGN-SPEC.md` |
| Tokens (TS) | `design-docs/tokens.ts` — mirrored from `packages/design-tokens/src/tokens.ts` |
| Tokens (CSS) | `design-docs/tokens.css` — mirrored from `packages/design-tokens/src/tokens.css` |
| Native tokens (RN) | `design-docs/native.ts` — mirrored from `packages/design-tokens/src/native.ts` |
| Patterns (Nordic Split panel, wizard, login gate) | `design-docs/patterns.md` |
| Colors / type / motion / components / mobile | `design-docs/*.md` |
| Interactive styleguide (live) | [design.smartout.ai](https://design.smartout.ai) · `docs/design/ren-og-varm-styleguide.html` in the repo |
| Logo / icon assets | lifted from `apps/web/public/` |
| Login pattern reference | `apps/web/src/app/login/page.tsx` |
| Demo / hero blocks | `apps/landing/src/components/blocks/HeroBlock.tsx`, `demo/*` |
| GitHub repo | `SXTNmedia21/smartout.ai` (private) |

Mobile UI components were not read from source — only from the Norwegian spec. UI-kit fidelity for mobile is "spec-accurate," not "code-accurate."

---

## Index

| File / folder | Contents |
| --- | --- |
| `README.md` | This file — context, content & visual foundations, iconography |
| `SKILL.md` | Agent-skill front-matter for portability |
| `colors_and_type.css` | Single-file CSS tokens + semantic type classes (`.t-hero`, `.t-kpi`, etc.) |
| `assets/` | Logos and icons (`smartout-logo.png`, `smartout-icon.png`, white variants) |
| `design-docs/` | Canonical source docs — spec, tokens, patterns |
| `preview/` | Preview cards registered in the Design System tab |
| `ui_kits/web/` | Web dashboard UI kit — shell, sidebar, KPI cards, shift table, Nordic Split auth |
| `ui_kits/mobile/` | Mobile app UI kit — home (during shift), channel, payroll, tab bar |
| `ui_kits/landing/` | Marketing site UI kit — hero, features, CTA, footer |

---

## Content Fundamentals

**Language: Norwegian first.** Smartout's UI ships in **Bokmål**. Marketing is bilingual (NO/EN). When writing mocks, use Norwegian unless the audience is explicitly English.

**Voice.** *Professional but human. Never corporate. Never playful. Calm authority with warmth.*

**You vs I.** Addresses the user as **du / deg / din** (informal "you" — standard in Norwegian product UI). Greetings are personal: *"God morgen, Sofia"*, *"Der er du jo."* (*"There you are."*). Reassurances are direct: *"Dashboardet ditt er klart."* (*"Your dashboard is ready."*)

**Casing.** Sentence case on buttons, labels and headings. **Never ALL CAPS** except for micro-labels: badges (9px), section dividers (10px), table headers. Uppercase micro-copy uses `letter-spacing: 2px`.

**Tone examples pulled from production copy:**

- Hero: *"Teamet ditt, klar fra dag en."* ("Your team, ready from day one.") — short, declarative, warm.
- Signup: *"Sett opp bedriften din på under fem minutter. Ingen kredittkort. Ingen forpliktelser."* — practical promise + reassurance.
- Logging-in state: *"Der er du jo."* — intimate, a single line of warmth at the moment the user arrives.
- Loading hype sequence: *"Et øyeblikk..." → "Fremtiden er her." → "Er du klar?"* — three beats, each ~1.5s, building anticipation.
- Error: *"Feil e-post eller passord."* — no blame, no exclamation points.

**Rules.**
- Never exclamation points except in celebration moments (punch-in, quiz win).
- Never emoji in product UI. Emoji may appear in *user-generated* content (chat messages) but not in labels, buttons, empty states, or system copy.
- Never jargon. Never "leverage," "unlock," "empower." Never "users" — always "ansatte" (employees) or direct "du".
- Numbers belong to Geist Mono — *always* for money (`32 450 kr`), hours (`24t`), supplements (`+15.65/t`), KPIs.
- Norwegian units: `t` for timer (hours), `kr` for kroner, `24-timer` not `24h`.

---

## Visual Foundations

**Philosophy.** *Nordic Split* is Scandinavian minimalism with a warm, organic heart. Never flat. Never cold. Motion is spring physics — weighty, deliberate, like a heavy pendulum. Surfaces are warm cream and warm dark (not white, not black). The signature is the two-panel auth screen: a dark brand panel alive with drifting orbs, split against a clean light form.

### Colors
- **Warm neutrals only.** Neutral hues live in OKLCH range 45–60 (golden/beige). Never hue 200+ (cold/blue-gray). Never `#6b7280` or `#9ca3af` — use `oklch(0.52 0.01 52)` instead.
- **Never pure white, never pure black.** Background is warm cream `oklch(0.99 0.004 60)`. Foreground is warm black `oklch(0.145 0.01 50)`. Dark mode is a warm dark `oklch(0.12 0.015 50)` — inverted lightness, but **chroma is preserved**.
- **Brand orange** `oklch(0.65 0.22 40)` — CTAs, active nav, the FAB, focus rings. Only one brand color in play at a time.
- **Semantic at 10% opacity backgrounds.** A success badge is success-green text on 10% success-green fill. Never a full fill.
- **Domain colors** (departments — kitchen/floor/bar/event/storage) appear as 4px left accent bars on cards and as small chips. They are *categorical*, never used as primary surfaces.

### Type
- Three families: **Instrument Serif** (headings + brand moments), **Geist Sans** (everything else), **Geist Mono** (numbers only — KPIs, money, time).
- Serif gives "editorial authority and warmth." Never use it for body. Never use mono for labels.
- Headings sit at `letter-spacing: -0.02em` (tight). Micro-labels (badges, section dividers) sit at `letter-spacing: 2px` uppercase.
- Weights: 400 body, 500 labels/nav, 600 buttons & card titles, 700 page/section headings, 900 KPI numbers (Geist Mono `font-black`).

### Spacing
- Five tokens: **32 / 24 / 20 / 12 / 8** (page / section / card / element / tight). Mobile adds **4** (xs).
- Dashboard content is capped at **max-width 1280px**, sidebar at **240px** (64px collapsed). Auth form at **360px**.

### Backgrounds
- **No full-bleed imagery.** No hero photography. The hero moment is typographic + ambient orbs.
- **Ambient orbs** are the signature: two radial-gradient blobs (warm glow + deep glow), autonomously drifting, mouse-tracking with 0.6–0.8s delay. Only on the Nordic Split dark panel, never on content pages.
- **Noise overlay.** Subtle fractal noise SVG, `baseFrequency: 0.8`, opacity `0.025` (light) / `0.04` (dark), `mix-blend-mode: overlay`. Adds tactile depth without weight.
- **No gradients on surfaces.** Orange-to-purple gradients are forbidden. The only gradients permitted are: the orbs (radial), the skeleton shimmer (1.8s sweep), and edge vignettes on dark panels.

### Animation
- **Spring physics only** for entrance/exit. Never linear. Three presets: `panelSpring` (35/22/2.2), `swapSpring` (45/24/2.0), `expandSpring` (30/20/2.5).
- **Minimum durations:** 250ms exit, 500ms enter. Panel flex shifts take **1200ms** — slow, weighty, deliberate.
- **Stagger:** list items stagger by 60ms.
- **Named animations:** *Typewriter* (BRREG auto-fill), *Punch* (scale 0.88 → 1.0 + burst ring) for confirmations, *Ambient glow* (mouse-tracked orbs).
- **No `transition-all`.** Always specify properties (`transform, box-shadow, border-color`).

### Hover & press states
- **Hover never changes color alone** — always shadow intensification *and* a subtle lift (`translateY(-2px)`).
- **Press** compresses: buttons `scale(0.96)` over 150ms. Mobile taps `scale(0.92)`.
- **No hover states on mobile** — press-only.
- **Focus** is always a 2–3px ring at brand-orange 8–30% opacity. Visible. Never suppressed.

### Borders & radii
- `1px` borders, always in `--border` color. Never `2px` decorative borders.
- Radii: **6 / 8 / 10 / 14 / 16** and `9999px` for pills. **16px is the default card**.
- Inputs: 12px radius, 40px height (48 large), 12px horizontal padding.
- Buttons: 10px radius standard, `9999px` for pills in nav/auth.

### Shadows & elevation
- Four levels: `sm` (1px), `md` (4–6), `lg` (10–15), `card-hover` (8–24 at 15%).
- **Brand glow** is a specific shadow: `0 2px 12px rgba(249,115,22,0.25)` — only on primary CTAs and FAB.
- Shadows use `rgba()`, never Tailwind's shadow utilities (they're cold).
- **No inner shadows** except as focus rings.

### Glassmorphism
- **Panels and overlays only** — never regular cards. `rgba(255,255,255,0.06)` + `backdrop-blur(20px)` on dark; `bg-card/70` + blur on light.

### Transparency & blur
- Use sparingly. Only in: glassmorphic overlays, orb gradients, noise overlay, semantic badge backgrounds (10% opacity).
- Never animate opacity alone for entrance — pair with Y-translate.

### Imagery vibe
- When imagery appears (rare — hero mockups, phone frames), it's **warm, indoor, slightly desaturated**. Restaurant interiors, hands on a tablet. Never stock, never glossy, never cold.
- Phone frame in marketing: 320×600, 32px radius, 3px border, shadow `0 20px 60px rgba(0,0,0,0.4)`.

### Cards
- Default: `bg-card` + 1px border + **16px radius** + 20–24px padding + `transition: transform, box-shadow, border-color 300ms`.
- Hover: `translateY(-2px)` + `shadow-card-hover`.
- **KPI card:** base + `relative overflow-hidden` + a 120px blurred orange orb at 15% opacity that brightens to 35% on hover.
- **Task / Shift / Protocol card:** base + 4px left accent bar in domain/status color.
- **List card (compact):** no shadow, only `border-bottom`, 12px vertical padding, 8px status dot left.

### Layout rules
- **Max-width 1280px** on dashboard content. **360px** auth form. **320px** phone frame.
- **Page padding: 32px.** Section gap: 24px. Card gap: 20px.
- **Dashboard sidebar:** 240px, never wider. 64px collapsed.
- **Safe areas on mobile** always respected (notch, home indicator).

---

## Iconography

**Icon library: Lucide React.** No emoji in UI. No other icon libraries. No hand-rolled SVG decoration. No PNG icons in the product (PNGs are for logos only).

**Usage.**
- Default size **20px**. Inline / small size **16px**. Never larger than 24px without a specific reason.
- Icons inherit `currentColor` — never hardcode icon colors.
- Icon weight matches surrounding text weight visually.
- Touch-target on mobile: **44×44px minimum** even when the icon glyph is 20–24px.

**In this design system** the Smartout project doesn't ship its own icon set — it uses Lucide as-is. For mocks here, we link Lucide from the CDN:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<!-- then <i data-lucide="home"></i>  + lucide.createIcons() -->
```

For React: `import { Home, Calendar, MessageSquare } from "lucide-react"`.

**Common Smartout icon mapping** (based on the spec + login/dashboard code):
- Shift / schedule → `Calendar`, `Clock`
- Channels / chat → `MessageSquare`, `Mic` (walkie-talkie PTT)
- Money / payroll → `Wallet`, `Receipt`
- Task / todo → `CheckSquare`, `ListTodo`
- HMS / protocol → `ShieldCheck`, `ThermometerSun` (HACCP)
- Deviation / incident → `AlertTriangle`
- AI assistant (Botsson) → `Sparkles`
- Nav (sidebar): `Home`, `Calendar`, `Users`, `BookOpen`, `ShieldCheck`, `Settings`

**Logo assets.** `assets/smartout-logo.png` is the stacked orange mark + wordmark. `assets/smartout-icon.png` is the chat-bubble-in-circle mark only. White variants exist for dark panels.

**Brand illustration / mascot.** None. The brand has no illustrations or mascot. Visual personality comes from the ambient orbs on the Nordic Split panel, not decoration.

**Emoji policy.** Not used in UI. Users may emoji in chat — that's user content, not design. System copy, empty states, toasts, buttons — never. (Exception: a hand-drawn prototype wireframe in `mobile-layout.md` uses emoji as placeholder icons; production never does.)

---

## Flagged substitutions (please verify or replace)

- **Instrument Serif** is loaded from Google Fonts — matches the production font.
- **Geist Sans / Geist Mono** are loaded via jsdelivr from the `geist` npm package — matches production.
- **Noise texture SVG**: inlined via CSS (no file needed). The production repo generates it inline too.
- **Lucide icons**: loaded via UMD CDN in HTML files for parity with `lucide-react`.

If you want the actual orb-generator config from `docs/design/orb-generator.html` baked into a shared helper, let me know.
