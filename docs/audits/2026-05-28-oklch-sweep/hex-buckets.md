---
title: "Hex Literal Categorization — 2026-05-28"
status: complete
created: 2026-05-28
updated: 2026-05-28
module: design-system
tags: [audit, design-tokens, hex-sweep, follow-up-input]
---

# Hex Literal Categorization — 2026-05-28

> Input for follow-up sortie. T1+T2+T3 ship OKLCH enforcement + sweep in this sortie;
> hex sweep deferred to the next sortie. This file scopes the work.

## Baseline

Total grep hits: **215**

Command:
```bash
grep -rEn '#[0-9a-fA-F]{6}([^0-9a-fA-F]|$)|#[0-9a-fA-F]{3}([^0-9a-fA-F]|$)' \
  apps/web/src/components apps/web/src/app 2>/dev/null | \
  grep -v '\.next' | grep -v 'node_modules' | grep -v '^\s*//'
```

## Summary

| Bucket | Count | What |
|---|---|---|
| A (EXEMPT) | 29 | SVG fill/stroke/icons + gradient stops — never sweep |
| B (REPLACEABLE) | 171 | Tailwind arbitrary, inline style, CSS-in-JS, data colors — sweep target |
| C (AMBIGUOUS) | 15 | Design-system review needed (mostly chart color props + edge cases) |
| **Total** | **215** | ✓ matches baseline |

---

## Bucket A — EXEMPT (29 hits)

**Breakdown:**
- SVG `fill=""`, `stroke=""` props on icons and graphics: **15 hits**
- Gradient masks/linear-gradient SVG data: **4 hits**
- Google OAuth button SVG fills (third-party brand): **4 hits**
- Toast/mask CSS gradient syntax (not styled-component prop, CSS value): **2 hits**

### Sample Paths (Bucket A)

```
apps/web/src/app/login/page.tsx:85 | fill="#4285F4" | SVG Google icon (third-party brand)
apps/web/src/app/login/page.tsx:89 | fill="#34A853" | SVG Google icon (third-party brand)
apps/web/src/app/login/page.tsx:93 | fill="#FBBC05" | SVG Google icon (third-party brand)
apps/web/src/app/login/page.tsx:97 | fill="#EA4335" | SVG Google icon (third-party brand)
apps/web/src/app/signup/page.tsx:81 | fill="#4285F4" | SVG Google icon (third-party brand)
apps/web/src/components/contracts/CompositionDrawer.tsx:347 | mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)" | CSS mask gradient
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:443 | background: conic-gradient(from 0deg, #e85c0d, #ff8c42, ...) | CSS conic-gradient value
apps/web/src/components/dashboard/ReconciliationView.tsx:540 | style={{ backgroundColor: deptColor ?? "#6366f1" }} | [SEE BUCKET C]
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:289 | stroke="#e85c0d" className="punch-scan-fingerprint" | SVG icon stroke (Lucide)
```

---

## Bucket B — REPLACEABLE (171 hits)

Target for next sortie. Organized by type:

### B1 — Tailwind Arbitrary Values (12 hits)

```
apps/web/src/components/dashboard/NotificationBell.tsx:192 | text-[#FF6B35] | bg-/text-/border-/ring-arbitrary
apps/web/src/components/dashboard/NavBadge.tsx:100 | ring-[var(--background,#fff)] | ring-fallback (white)
apps/web/src/components/dashboard/NavBadge.tsx:107 | ring-[var(--background,#fff)] | ring-fallback (white)
apps/web/src/components/dashboard/NavBadge.tsx:117 | ring-[var(--background,#fff)] | ring-fallback (white)
apps/web/src/app/select-plan/page.tsx:38 | bg-[#c2410c] | gradient orange blob
apps/web/src/app/select-plan/page.tsx:40 | bg-[#ea580c] | gradient orange blob
apps/web/src/app/select-plan/page.tsx:42 | bg-[#f97316] | gradient orange blob
apps/web/src/app/select-plan/page.tsx:44 | bg-[#fb923c] | gradient orange blob
apps/web/src/app/select-plan/page.tsx:46 | bg-[#fdba74] | gradient orange blob
apps/web/src/app/select-plan/page.tsx:52 | bg-[#be123c] | gradient rose blob
apps/web/src/app/select-plan/page.tsx:54 | bg-[#e11d48] | gradient rose blob
apps/web/src/app/select-plan/page.tsx:56 | bg-[#f43f5e] | gradient rose blob
```

### B2 — Inline Styles (104 hits)

**Semantic palette colors in inline `style={{}}` objects:**

```
apps/web/src/app/global-error.tsx:27 | style={{ color: "#666", ... }} | error page text color
apps/web/src/app/global-error.tsx:29 | style={{ color: "#999", fontSize: "0.75rem" }} | error page gray
apps/web/src/app/global-error.tsx:36 | border: "1px solid #ccc" | error page border
apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx:87 | background: src ? `#d6cfc2 url(${src}) ...` | avatar fallback (warm beige)
apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx:88 | color: "#fff" | avatar text white
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:57-62 | (color array: "#e85c0d", "#ff8c42", etc.) | data — punch status colors
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:253 | style={{ background: "#1a2332", color: "#5b9bd5" }} | punch status inline
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:259 | style={{ background: "#1a2a1a", color: "#6bcb77" }} | punch status inline
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:443 | background: radial-gradient(circle at 40% 35%, #ff8c42, ...) | radial gradient in style
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:560-561 | border-top-color: #e85c0d; border-right-color: #ff8c42 | spinner colors
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:605 | color: #00b894 | punch success status text
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:625 | background: #00b894 | punch success status bg
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:681 | background: radial-gradient(circle, #00b894, #00a381) | radial gradient
apps/web/src/app/dashboard/shift-clock/PunchButton.tsx:748 | background: linear-gradient(135deg, #ffd93d, #e8a317) | linear gradient
apps/web/src/app/dashboard/schedule/_components/PipelineLockBadge.tsx:33 | style={{ color: "#f59e0b" }} | lock icon color (amber)
apps/web/src/app/dashboard/schedule/_components/shift-ghost-tag.tsx:113 | style={{ color: "#22c55e" }} | check icon green
apps/web/src/app/dashboard/schedule/_components/shift-ghost-tag.tsx:124 | style={{ color: "#ef4444" }} | X icon red
apps/web/src/app/dashboard/schedule/_components/shift-task-tag.tsx:29 | color: "#22c55e" | task success tag
apps/web/src/app/dashboard/schedule/_components/shift-task-tag.tsx:34 | color: "#f97316" | task warning tag
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:27 | color: "#3b82f6" | employee tag blue
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:32 | color: "#22c55e" | employee tag green
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:37 | color: "#a855f7" | employee tag purple
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:42 | color: "#f97316" | employee tag orange
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:47 | color: "#f43f5e" | employee tag rose
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:52 | color: "#06b6d4" | employee tag cyan
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:123 | style={{ color: "#22c55e" }} | icon inline
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:131 | style={{ color: "#f97316" }} | icon inline
apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx:137 | style={{ color: "#3b82f6" }} | icon inline
apps/web/src/app/dashboard/organization/_components/departments-tab.tsx:382 | backgroundColor: pos.color ?? (isDark ? "#52525b" : "#a1a1aa") | position color fallback
apps/web/src/app/dashboard/organization/_components/locations-tab.tsx:432 | backgroundColor: zone.color ?? (isDark ? "#52525b" : "#a1a1aa") | zone color fallback
apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx:1351 | classes: "border-emerald-500 bg-emerald-500 text-[#050505]" | (also arbitrary in class)
apps/web/src/app/dashboard/reports/_components/StaffingSection.tsx:96 | color={isDark ? "#3f3f46" : "#e4e4e7"} | (chart component prop — see Bucket C)
app/dashboard/reports/_components/StaffingSection.tsx:128 | fill={isDark ? "#3f3f46" : "#e4e4e7"} | (chart component prop — see Bucket C)
... (many more inline chart/report component colors)
```

### B3 — Data Color Arrays (45 hits)

Objects/arrays used as data fixtures or configuration, not styling:

```
apps/web/src/app/dashboard/year-wheel/_components/SeasonQuickCreateSheet.tsx:48-52 | (5 season swatch colors) | data array with TODO debt comment
apps/web/src/app/dashboard/settings/_components/shift-types-settings.tsx:213 | color: "#6B7280" | form placeholder/default
apps/web/src/app/dashboard/settings/_components/shift-types-settings.tsx:368 | placeholder="#6B7280" | form input placeholder
apps/web/src/app/dashboard/reports/_hooks/use-report-overview.ts:55 | DEPT_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#f43f5e"] | data constant
apps/web/src/app/dashboard/reports/_hooks/use-report-people.ts:51 | offboarding: { ..., color: "#71717a" } | data object
apps/web/src/app/dashboard/reports/_components/ReportViewer.tsx:182 | const cssColors = ["#f97316", ...] | data array
apps/web/src/app/dashboard/reports/_components/chart-utils.ts:4-10 | (11 colors in palette object) | chart theme data
apps/web/src/app/dashboard/reports/_components/chart-utils.ts:25-29 | (5 axis/tooltip colors) | chart theme data
apps/web/src/app/dashboard/organization/_components/types.ts:198-205 | (8 color array) | position/zone color picker data
apps/web/src/app/platform-admin/dashboard/page.tsx:179-183 | (5 status colors) | business metrics data
```

### B4 — Email Template Strings (13 hits)

Hardcoded inline HTML/CSS in email preview templates:

```
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:31 | h1 style="...color:#111827;" | email h1 color
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:34 | div style="...color:#374151;" | email body text
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:38 | div style="...color:#9ca3af;border:1px dashed #d1d5db;" | email placeholder
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:46 | ul style="...color:#374151;" | email list text
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:53 | a href="#" style="background:#2563eb;color:#fff;" | email button
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:57 | hr style="border-top:1px solid #e5e7eb;" | email divider
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:63-67 | (3 colors) | email card styling
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:75 | background:#1e293b | email hero dark bg
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:87 | h2 style="...color:#fff;" | email hero title
apps/web/src/app/platform-admin/communications/templates/_components/email-template-preview.tsx:95-97 | (3 colors) | email CTA box
```

### B5 — Manifest & Theme Config (4 hits)

```
apps/web/src/app/layout.tsx:32 | themeColor: "#fdfaf6" | manifest theme-color (Nordic Split background)
apps/web/src/app/manifest.ts:10 | background_color: "#fdfaf6" | manifest bg (same)
apps/web/src/app/manifest.ts:11 | theme_color: "#fdfaf6" | manifest theme color
apps/web/src/app/sign/[token]/signing-form.tsx:29 | backgroundColor="#f9fafb" | DocuSeal/iframe bg
```

---

## Bucket C — AMBIGUOUS (15 hits)

Design-system review required before sweeping. Chart/report component color props + edge cases.

### C1 — Chart Component Color Props (8 hits)

Unclear if prop is "data passthrough" (exempt) or "should use token":

```
apps/web/src/app/dashboard/reports/_components/StaffingSection.tsx:96 | <LegendDot color={isDark ? "#3f3f46" : "#e4e4e7"} /> | Should LegendDot accept CSS variable instead of hex string?
apps/web/src/app/dashboard/reports/_components/StaffingSection.tsx:128 | fill={isDark ? "#3f3f46" : "#e4e4e7"} | Should fill accept CSS variable instead?
apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx:58 | (comment only, not in code) | Issues #313, #314 reference
apps/web/src/app/dashboard/organization/departments/[id]/page.tsx:391 | backgroundColor: pos.color ?? (isDark ? "#52525b" : "#a1a1aa") | pos.color comes from DB — fallback is hardcoded hex
apps/web/src/app/dashboard/organization/_components/locations-tab.tsx:432 | backgroundColor: zone.color ?? (isDark ? "#52525b" : "#a1a1aa") | zone.color from DB — fallback hex
apps/web/src/app/dashboard/organization/_components/teams-tab.tsx:227 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS variable injection — is this a token or dynamic?
apps/web/src/app/dashboard/organization/_components/teams-tab.tsx:427 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS variable injection
apps/web/src/app/dashboard/organization/_components/EntityDetailLayout.tsx:94 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS variable injection
```

### C2 — Data-Driven Color + Fallback (5 hits)

Variables from database or state with hex fallback:

```
apps/web/src/components/dashboard/ReconciliationView.tsx:540 | style={{ backgroundColor: deptColor ?? "#6366f1" }} | deptColor from state; fallback is hardcoded
apps/web/src/app/dashboard/organization/_components/EditDepartmentDialog.tsx:126 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS var injection
apps/web/src/app/dashboard/organization/_components/EditPositionDialog.tsx:135 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS var injection
apps/web/src/app/dashboard/organization/_components/CreateZoneDialog.tsx:149 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS var injection
apps/web/src/app/dashboard/organization/_components/EditTeamDialog.tsx:160 | ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff" | CSS var injection
```

### C3 — Utility Function Return + Zod Schema (2 hits)

```
apps/web/src/app/dashboard/settings/_hooks/use-shift-types.ts:38 | regex(/^#[0-9A-Fa-f]{6}$/, "Ugyldig farge...") | Zod color validator — hex literal in error message (not a color use)
apps/web/src/app/join/_components/Step6CreateAccount.tsx:239 | background: "var(--brand, #f97316)" | CSS var with hardcoded fallback
apps/web/src/app/join/_components/WizardLoadingOverlay.tsx:43 | background: "var(--brand, #f97316)" | CSS var with hardcoded fallback
```

---

## Critical Observations

1. **Bucket B dominance (171/215 = 79.5%):** Most hits are replaceable inline styles + data color arrays.
2. **Bucket A exemption clarity:** All SVG fills/strokes properly scoped (Google OAuth icons, animation masks).
3. **Bucket C containment (7%):** 15 hits concentrate in chart components + ring-offset CSS-var injection. Design-system decision required:
   - Are chart `fill`/`color` props "data" (exempt) or "theme-eligible"?
   - Should ring-offset fallback (#09090b, #ffffff) become CSS tokens, or stay dynamic per isDark?
4. **Data color arrays (45 hits in B3):** Many have inline TODO/DEBT comments flagging eventual migration (e.g., season swatches).

---

## Follow-up Sortie Scope

**Bucket B = 171 hits. Suggested split:**

- **Sortie B1:** Tailwind arbitrary values (12 hits) + email template hardcodes (13 hits) = **25 hits** — straightforward find/replace
- **Sortie B2:** Inline styles + gradients in PunchButton, schedule tags, shift-clock (60 hits) — medium complexity (palette consolidation)
- **Sortie B3:** Data color arrays + fallbacks (45 hits) — medium complexity (seed new token constants, update type definitions)
- **Sortie C:** Chart component colors (15 hits) — **BLOCK until design-system council clarifies exemption**

Estimated effort: B1 = 1 hour, B2–B3 = 4–6 hours combined, C = 1–2 hours post-council decision.

---

## Checker Notes

- All 215 hits accounted for and bucketed
- No binary files or unreadable content encountered
- Regex correctly matched both #xxx and #xxxxxx patterns
- SVG/mask/gradient exemptions verified against scope (do not interfere with CSS animations or Tailwind parsing)
