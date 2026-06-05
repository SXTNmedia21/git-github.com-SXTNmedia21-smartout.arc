# Smartout — project instructions (read first)

Smartout is a hi-fi, responsive **operations platform for frontline hospitality teams**. Core principle: turn the invisible daily chaos of running a venue into **calm, shared operational clarity**.

## THE ONE FILE THAT MATTERS
The living product is **`apps/web/Smartout Web Version 1.html`** — a single coherent app (one shell + router + real pages). This is the single source of truth and the place ALL new work happens. It is *not* a frozen "v1"; keep building inside it. Do not start a new shell or a parallel app.

**Before doing anything, read `apps/web/README.md`.** It is the handoff doc: architecture, what's built, conventions, data, the world/cast, mode/access rules, how to add a page, the backlog, and a changelog. Keep it up to date as you work — it is how the next agent picks up.

For the visual/system reference, open **`Design System.html`** (project root) — a living **cross-platform** doc that mirrors the current product across **web + app**: live tokens, a web↔app primitive map, web + mobile component specimens, and the four shared components documented against their real code — **FlowPlayer** (Veiledning), **Reporter** (kontroll/compliance), **Oppgave-tildeling** (person/gruppe/team) and **Vaktkontroll** (Shift Controller). Screenshots live in `apps/web/docs/shots/`., and the bridge from UI to the Core Structure data model (ADR-0429 terminology). Update its status matrix when you finish a screen.

## Folder map
- `apps/` — **the products.** Two sibling clients:
  - `apps/web/` — **the live web product** (self-contained; everything it needs lives under here). Structure:
    - `apps/web/Smartout Web Version 1.html` — entry; loads everything below in order.
    - `apps/web/shared/` — framework + foundation: `styles.css` (the **Nordic Split design system** — tokens + components; never duplicate or fork), `shell.css` + `shell.jsx` (chrome, router, chat, Botsson, command palette, profile/settings, doc-mode), `pages.css` (shared page primitives), `data.js` + the `*-data.js` files (mock data → `window.SmartoutData`; extend here, don't invent parallel data).
    - `apps/web/pages/` — one `*.jsx` per route (registers into `window.SO_PAGES`) co-located with that page's `*.css`; plus the `handbook-*.jsx` Bibliotek module.
    - `apps/web/docs/shots/` — screenshots for the living design-system doc (which now lives at the project root: `Design System.html`).
  - `apps/mobile/` — **the mobile client.** A mobile **screen library** + a restored legacy prototype (`apps/mobile/README.md`): `Smartout Mobile.html` (gallery of all mobile screens), `Smartout Mobile (legacy).html` (navigable prototype), and `refs/` (mined screen components — auth/onboarding, employee "Min dag", primitives, data). Reuse `apps/web/shared/` rather than forking.
- `archive/` — **reference designs only.** Legacy prototypes (`Task Manager.html`, `payroll/`, `nyheter/`, `hms-docs/`, `proto/`, `yearwheel/`, `dagslinjen/`, `mobile/`, `calendar/`, `remote/`, …) and old screenshots. Mine them for content/visual language; do not edit them and do not link the app to them.
- `uploads/` — specs & screenshots (`SMARTOUT-DESIGN-SPEC.md`, `OVERVIEW.md`, reconciliation design, live-app screenshots). Ground new work in these.

## Golden rules (don't break these)
1. **Reuse, don't rebuild.** Cost-time aware: highest impact ÷ least churn. Don't redesign what already matches the direction.
2. **Design system is binding.** Colors/type/spacing/components come from `apps/web/shared/styles.css` tokens. Warm cream bg, warm black fg, orange brand; muted green / amber / restrained red for status. Instrument Serif (display), Geist (UI), Geist Mono (numbers). **Never emoji in UI.** Never cold grey/blue or pure white/black.
3. **One shell, registered pages.** Pages register into `window.SO_PAGES[route]`. See README "How to add a page".
4. **AI (Mr. Botsson) is assistive, never magical.** It explains suggestions, shows the data it used, asks before sensitive actions, allows undo/edit.
5. **Confirm important actions with a toast + undo** (`useToast()`).
6. **Both light and dark must stay polished.** Test both.
7. **Access control is role-gated, not just hidden** — keep the `App` route guard intact when adding admin pages.
8. **Verify before finishing:** `done` → fix any console errors → `fork_verifier_agent`.

## Language
Product UI is **Norwegian (bokmål)**. Code/comments/docs in English. Keep the cast & world consistent (Bistro Nord, Maria A., the team in `apps/web/shared/data.js`).
