---
title: "Plan — helpdesk-primitives"
feature: helpdesk-primitives
status: draft
created: 2026-04-24
updated: 2026-04-24
module: Helpdesk
tags: [plan, helpdesk, design-primitives, nordic-split]
design-source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx
---

# Helpdesk Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared visual primitives (Orb, LighthouseAvatar, StatusLabel, Pill) from the Claude Design Helpdesk Prototype as canonical reusable components in both web (Tailwind + inline style) and mobile (React Native StyleSheet) idioms, with a preview route for visual QA. Zero consumers are modified; this is pure foundation.

**Architecture:** Two parallel component trees — `apps/web/src/components/helpdesk-orb/` for web (Framer Motion + Tailwind classes consuming Nordic Split CSS vars) and `apps/mobile/src/components/orb/` for React Native (StyleSheet + native token resolution via `@/theme`). API mirrors the JSX prototype exactly so existing prototype examples translate 1:1. An isolated preview route `/platform-admin/helpdesk-preview` renders every primitive in every state for visual QA and screenshot-diff regression.

**Tech Stack:** React 19 + Next.js 15 (web, Tailwind v4, Framer Motion 11), React Native + Expo SDK 52 (mobile, Reanimated 3), TypeScript strict, Vitest + Playwright for tests.

**Scope:** Foundation primitives only. No consumer rewrite. No redesign of existing TicketHeader/ChannelList/etc. That's Phase 2–5.

**Design source of truth:** `docs/design/smartout-design-helpdesk/project/prototype/shared.jsx` lines 82-212 (Orb, LighthouseAvatar, Avatar extension, StatusLabel, Switch, Radio, Btn, Pill) + `.noise-overlay` / `@keyframes orb-pulse` at lines 262-280.

---

## File Structure

### Web (`apps/web/src/components/helpdesk-orb/`)

| File | Responsibility |
|---|---|
| `Orb.tsx` | Pure radial-gradient orb, status prop drives chroma, optional pulse animation |
| `Orb.module.css` | `@keyframes orb-pulse` (2.8s ease-in-out infinite; scale 1 → 1.06; opacity 1 → 0.82) |
| `LighthouseAvatar.tsx` | Avatar with radial halo (1.5× container), initials fallback, halo intensity by `halo` prop |
| `StatusLabel.tsx` | Uppercase mono 11px VENTER/AKTIV/LØST |
| `Pill.tsx` | Mono 11px pill, tone: muted/brand/success |
| `NoiseOverlay.tsx` | `::after` SVG fractalNoise overlay helper for glass surfaces |
| `types.ts` | `OrbStatus`, `HaloIntensity`, `PillTone` type exports |
| `index.ts` | Public API re-exports |

### Mobile (`apps/mobile/src/components/orb/`)

| File | Responsibility |
|---|---|
| `Orb.tsx` | Native radial gradient via `expo-linear-gradient` + masked circle, Reanimated pulse |
| `LighthouseAvatar.tsx` | Native avatar + blurred halo `View` |
| `StatusLabel.tsx` | Native Text with native mono font |
| `Pill.tsx` | Native View pill, tone-driven bg/fg |
| `types.ts` | Shared types |
| `index.ts` | Public API |

### Preview route (web)

| File | Responsibility |
|---|---|
| `apps/web/src/app/platform-admin/helpdesk-preview/page.tsx` | Server Component shell |
| `apps/web/src/app/platform-admin/helpdesk-preview/_components/PrimitivesGallery.tsx` | Client gallery rendering every primitive × every state |

### Mobile preview

| File | Responsibility |
|---|---|
| `apps/mobile/app/(app)/(me)/design-preview.tsx` | Dev-only route, renders gallery |

### Tests

| File | Responsibility |
|---|---|
| `apps/web/src/components/helpdesk-orb/__tests__/Orb.test.tsx` | Unit: chroma maps to status, pulse class applied when `pulse` |
| `apps/web/src/components/helpdesk-orb/__tests__/LighthouseAvatar.test.tsx` | Unit: halo size = 1.5× avatar, initials fallback, src override |
| `apps/web/src/components/helpdesk-orb/__tests__/StatusLabel.test.tsx` | Unit: all three states render correct text |
| `apps/web/src/components/helpdesk-orb/__tests__/Pill.test.tsx` | Unit: all three tones render correct classes |
| `apps/e2e/tests/helpdesk-primitives-preview.spec.ts` | Playwright: preview route loads, all primitives rendered, screenshot baseline |

---

## Canonical prop API (must match across web + mobile)

### Orb

```ts
type OrbStatus = 'waiting' | 'active' | 'complete';

interface OrbProps {
  size?: number;           // default 48
  status?: OrbStatus;      // default 'waiting'
  pulse?: boolean;         // default false
  withCheck?: boolean;     // default false — renders center check icon
  className?: string;      // web only
  style?: React.CSSProperties | ViewStyle;
  'aria-label'?: string;   // a11y for status communication
}
```

**Chroma mapping (per prototype shared.jsx:84):**
- `active` → 0.12
- `complete` → 0.04
- `waiting` (default) → 0.08

**Gradient formula (per prototype shared.jsx:85-89):**
```
radial-gradient(circle at 45% 35%,
  oklch(0.82 ${chroma} 50) 0%,
  oklch(0.72 ${chroma * 0.7} 50 / 0.75) 35%,
  oklch(0.62 ${chroma * 0.4} 50 / 0.35) 60%,
  transparent 75%)
```

Additional styling: `filter: blur(1px)` on the gradient div for softness.

### LighthouseAvatar

```ts
type HaloIntensity = 'idle' | 'waiting' | 'active';

interface LighthouseAvatarProps {
  name?: string;
  size?: number;           // default 56 — avatar diameter
  src?: string;            // image URL, overrides initials
  halo?: HaloIntensity;    // default 'idle'
  className?: string;
  style?: React.CSSProperties | ViewStyle;
}
```

**Halo container size:** `size * 1.5`
**Chroma mapping (per prototype shared.jsx:110-111):**
- `idle` → 0.06
- `waiting` → 0.10
- `active` → 0.12

**Halo gradient:** `radial-gradient(circle at 45% 40%, oklch(0.80 ${chroma} 50 / 0.55) 0%, oklch(0.70 ${chroma * 0.6} 50 / 0.25) 45%, transparent 70%)` with `filter: blur(2px)`

**Avatar fill fallback:** `linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))` with white initials
**Initials:** first letter of each space-separated word, up to 2, uppercase, Geist Sans 500, font-size `size * 0.36`

### StatusLabel

```ts
interface StatusLabelProps {
  status: OrbStatus;
  className?: string;
}
```

**Text mapping (per prototype shared.jsx:167):**
- `waiting` → `VENTER`
- `active` → `AKTIV`
- `complete` → `LØST`

**Style:** Geist Mono 11px, weight 500, uppercase, `letter-spacing: 0.12em`, color `var(--muted-foreground)`.

### Pill

```ts
type PillTone = 'muted' | 'brand' | 'success';

interface PillProps {
  tone?: PillTone;         // default 'muted'
  children: React.ReactNode;
  className?: string;
}
```

**Tone → color mapping (per prototype shared.jsx:243-247):**
- `muted`: bg `var(--muted)`, fg `var(--foreground)`
- `brand`: bg `oklch(0.65 0.22 40 / 0.10)`, fg `var(--brand-orange-dark)` (need token — see Task 3 Step 3)
- `success`: bg `oklch(0.68 0.15 145 / 0.10)`, fg `oklch(0.45 0.15 145)`

**Shape:** `rounded-full` pill, padding `2px 8px`, Geist Mono 11px, no line-height per prototype.

---

## Prerequisites (verify before Task 1)

- [ ] Confirm `--brand-orange-dark` token exists in `packages/design-tokens/src/tokens.css`. If missing, add `oklch(0.55 0.22 40)` under `:root` and `.dark` before Task 3. Grep: `grep -n "brand-orange-dark" packages/design-tokens/src/tokens.css`.
- [ ] Confirm Framer Motion installed in `apps/web` (`grep '"framer-motion"' apps/web/package.json`). Expected: installed.
- [ ] Confirm `expo-linear-gradient` installed in `apps/mobile` (`grep 'expo-linear-gradient' apps/mobile/package.json`). If missing: `cd apps/mobile && pnpm add expo-linear-gradient`.
- [ ] Confirm Reanimated installed in `apps/mobile`. Expected: installed.

---

## Task 1: Web — Orb primitive (TDD)

**Files:**
- Create: `apps/web/src/components/helpdesk-orb/types.ts`
- Create: `apps/web/src/components/helpdesk-orb/Orb.tsx`
- Create: `apps/web/src/components/helpdesk-orb/Orb.module.css`
- Create: `apps/web/src/components/helpdesk-orb/__tests__/Orb.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/helpdesk-orb/__tests__/Orb.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Orb } from '../Orb';

describe('Orb', () => {
  it('renders with default size 48 and waiting status', () => {
    const { container } = render(<Orb aria-label="ticket status" />);
    const root = container.firstChild as HTMLDivElement;
    expect(root).toHaveStyle({ width: '48px', height: '48px' });
    expect(screen.getByLabelText('ticket status')).toBeInTheDocument();
  });

  it('maps status=active to chroma 0.12', () => {
    const { container } = render(<Orb status="active" aria-label="active" />);
    const gradient = container.querySelector('[data-orb-gradient]') as HTMLDivElement;
    expect(gradient.style.background).toContain('0.12');
  });

  it('maps status=complete to chroma 0.04', () => {
    const { container } = render(<Orb status="complete" aria-label="complete" />);
    const gradient = container.querySelector('[data-orb-gradient]') as HTMLDivElement;
    expect(gradient.style.background).toContain('0.04');
  });

  it('maps status=waiting to chroma 0.08', () => {
    const { container } = render(<Orb status="waiting" aria-label="waiting" />);
    const gradient = container.querySelector('[data-orb-gradient]') as HTMLDivElement;
    expect(gradient.style.background).toContain('0.08');
  });

  it('applies pulse class when pulse=true', () => {
    const { container } = render(<Orb pulse aria-label="pulsing" />);
    const gradient = container.querySelector('[data-orb-gradient]') as HTMLDivElement;
    expect(gradient.className).toMatch(/orb-pulse/);
  });

  it('renders check icon when withCheck=true', () => {
    const { container } = render(<Orb withCheck aria-label="done" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/__tests__/Orb.test.tsx
```

Expected: FAIL — "Cannot find module '../Orb'".

- [ ] **Step 3: Create the types file**

Create `apps/web/src/components/helpdesk-orb/types.ts`:

```ts
export type OrbStatus = 'waiting' | 'active' | 'complete';
export type HaloIntensity = 'idle' | 'waiting' | 'active';
export type PillTone = 'muted' | 'brand' | 'success';
```

- [ ] **Step 4: Create the Orb CSS module**

Create `apps/web/src/components/helpdesk-orb/Orb.module.css`:

```css
.orbPulse {
  animation: orb-pulse 2.8s ease-in-out infinite;
}

@keyframes orb-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.82;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orbPulse {
    animation: none;
  }
}
```

- [ ] **Step 5: Create the Orb component**

Create `apps/web/src/components/helpdesk-orb/Orb.tsx`:

```tsx
import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { OrbStatus } from './types';
import styles from './Orb.module.css';

const CHROMA: Record<OrbStatus, number> = {
  waiting: 0.08,
  active: 0.12,
  complete: 0.04,
};

export interface OrbProps {
  size?: number;
  status?: OrbStatus;
  pulse?: boolean;
  withCheck?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

export function Orb({
  size = 48,
  status = 'waiting',
  pulse = false,
  withCheck = false,
  className,
  style,
  'aria-label': ariaLabel,
}: OrbProps) {
  const chroma = CHROMA[status];
  const gradient = `radial-gradient(circle at 45% 35%, oklch(0.82 ${chroma} 50) 0%, oklch(0.72 ${chroma * 0.7} 50 / 0.75) 35%, oklch(0.62 ${chroma * 0.4} 50 / 0.35) 60%, transparent 75%)`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        data-orb-gradient
        className={pulse ? styles.orbPulse : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: gradient,
          filter: 'blur(1px)',
        }}
      />
      {withCheck && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            color: 'var(--foreground)',
            opacity: 0.85,
          }}
        >
          <Check size={size * 0.42} strokeWidth={2.25} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the test — verify it passes**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/__tests__/Orb.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/helpdesk-orb/types.ts \
        apps/web/src/components/helpdesk-orb/Orb.tsx \
        apps/web/src/components/helpdesk-orb/Orb.module.css \
        apps/web/src/components/helpdesk-orb/__tests__/Orb.test.tsx
git commit -m "feat(helpdesk-primitives): web Orb component with 3 statuses + pulse"
```

---

## Task 2: Web — LighthouseAvatar primitive (TDD)

**Files:**
- Create: `apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx`
- Create: `apps/web/src/components/helpdesk-orb/__tests__/LighthouseAvatar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/helpdesk-orb/__tests__/LighthouseAvatar.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { LighthouseAvatar } from '../LighthouseAvatar';

describe('LighthouseAvatar', () => {
  it('renders with default size 56 avatar inside 84px container (1.5x)', () => {
    const { container } = render(<LighthouseAvatar name="Linn Andersen" />);
    const root = container.firstChild as HTMLDivElement;
    expect(root).toHaveStyle({ width: '84px', height: '84px' });
  });

  it('renders initials from name when no src', () => {
    const { container } = render(<LighthouseAvatar name="Linn Andersen" />);
    expect(container.textContent).toBe('LA');
  });

  it('renders single initial for single-word name', () => {
    const { container } = render(<LighthouseAvatar name="Linn" />);
    expect(container.textContent).toBe('L');
  });

  it('renders background image when src provided', () => {
    const { container } = render(
      <LighthouseAvatar name="Linn" src="/avatar.png" />
    );
    const avatar = container.querySelector('[data-avatar]') as HTMLDivElement;
    expect(avatar.style.background).toContain('/avatar.png');
  });

  it('maps halo=waiting to chroma 0.10', () => {
    const { container } = render(
      <LighthouseAvatar name="Linn" halo="waiting" />
    );
    const halo = container.querySelector('[data-halo]') as HTMLDivElement;
    expect(halo.style.background).toContain('0.1');
  });

  it('maps halo=active to chroma 0.12', () => {
    const { container } = render(
      <LighthouseAvatar name="Linn" halo="active" />
    );
    const halo = container.querySelector('[data-halo]') as HTMLDivElement;
    expect(halo.style.background).toContain('0.12');
  });

  it('uses ? fallback when name is empty', () => {
    const { container } = render(<LighthouseAvatar />);
    expect(container.textContent).toBe('?');
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/__tests__/LighthouseAvatar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { HaloIntensity } from './types';

const CHROMA: Record<HaloIntensity, number> = {
  idle: 0.06,
  waiting: 0.10,
  active: 0.12,
};

export interface LighthouseAvatarProps {
  name?: string;
  size?: number;
  src?: string;
  halo?: HaloIntensity;
  className?: string;
  style?: CSSProperties;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return (
    name
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function LighthouseAvatar({
  name,
  size = 56,
  src,
  halo = 'idle',
  className,
  style,
}: LighthouseAvatarProps) {
  const haloSize = size * 1.5;
  const chroma = CHROMA[halo];
  const initials = getInitials(name);

  const haloGradient = `radial-gradient(circle at 45% 40%, oklch(0.80 ${chroma} 50 / 0.55) 0%, oklch(0.70 ${chroma * 0.6} 50 / 0.25) 45%, transparent 70%)`;
  const avatarFallback =
    'linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))';

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: haloSize,
        height: haloSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        data-halo
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: haloGradient,
          filter: 'blur(2px)',
        }}
      />
      <div
        data-avatar
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: src
            ? `#d6cfc2 url(${src}) center/cover`
            : avatarFallback,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: size * 0.36,
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.2)',
        }}
      >
        {!src && initials}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/__tests__/LighthouseAvatar.test.tsx
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx \
        apps/web/src/components/helpdesk-orb/__tests__/LighthouseAvatar.test.tsx
git commit -m "feat(helpdesk-primitives): web LighthouseAvatar with halo gradient"
```

---

## Task 3: Web — StatusLabel + Pill + brand-orange-dark token (TDD)

**Files:**
- Modify (if missing): `packages/design-tokens/src/tokens.css` (add `--brand-orange-dark`)
- Modify (if missing): `apps/web/src/app/globals.css` (map `--color-brand-orange-dark` in `@theme inline`)
- Create: `apps/web/src/components/helpdesk-orb/StatusLabel.tsx`
- Create: `apps/web/src/components/helpdesk-orb/Pill.tsx`
- Create: `apps/web/src/components/helpdesk-orb/__tests__/StatusLabel.test.tsx`
- Create: `apps/web/src/components/helpdesk-orb/__tests__/Pill.test.tsx`

- [ ] **Step 1: Verify or add `--brand-orange-dark` token**

Grep first: `grep -n "brand-orange-dark" packages/design-tokens/src/tokens.css`. If present, skip to Step 2.

If missing, in `packages/design-tokens/src/tokens.css` under the `:root` block where `--brand-orange` is defined, add:

```css
--brand-orange-dark: oklch(0.55 0.22 40);
```

And under `.dark`:

```css
--brand-orange-dark: oklch(0.55 0.22 40);
```

And in `apps/web/src/app/globals.css` `@theme inline` block add:

```css
--color-brand-orange-dark: var(--brand-orange-dark);
```

- [ ] **Step 2: Write failing tests for StatusLabel**

Create `apps/web/src/components/helpdesk-orb/__tests__/StatusLabel.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { StatusLabel } from '../StatusLabel';

describe('StatusLabel', () => {
  it('renders VENTER for waiting status', () => {
    const { container } = render(<StatusLabel status="waiting" />);
    expect(container.textContent).toBe('VENTER');
  });

  it('renders AKTIV for active status', () => {
    const { container } = render(<StatusLabel status="active" />);
    expect(container.textContent).toBe('AKTIV');
  });

  it('renders LØST for complete status', () => {
    const { container } = render(<StatusLabel status="complete" />);
    expect(container.textContent).toBe('LØST');
  });
});
```

- [ ] **Step 3: Write failing tests for Pill**

Create `apps/web/src/components/helpdesk-orb/__tests__/Pill.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { Pill } from '../Pill';

describe('Pill', () => {
  it('renders children', () => {
    const { container } = render(<Pill>3</Pill>);
    expect(container.textContent).toBe('3');
  });

  it('applies muted tone by default', () => {
    const { container } = render(<Pill>test</Pill>);
    const pill = container.firstChild as HTMLSpanElement;
    expect(pill.style.background).toContain('var(--muted)');
  });

  it('applies brand tone', () => {
    const { container } = render(<Pill tone="brand">test</Pill>);
    const pill = container.firstChild as HTMLSpanElement;
    expect(pill.style.background).toContain('0.22 40 / 0.1');
  });

  it('applies success tone', () => {
    const { container } = render(<Pill tone="success">test</Pill>);
    const pill = container.firstChild as HTMLSpanElement;
    expect(pill.style.background).toContain('0.15 145 / 0.1');
  });
});
```

- [ ] **Step 4: Run both tests — verify they fail**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/__tests__/StatusLabel.test.tsx src/components/helpdesk-orb/__tests__/Pill.test.tsx
```

Expected: module-not-found errors.

- [ ] **Step 5: Create StatusLabel**

Create `apps/web/src/components/helpdesk-orb/StatusLabel.tsx`:

```tsx
import type { OrbStatus } from './types';

const LABEL: Record<OrbStatus, string> = {
  waiting: 'VENTER',
  active: 'AKTIV',
  complete: 'LØST',
};

export interface StatusLabelProps {
  status: OrbStatus;
  className?: string;
}

export function StatusLabel({ status, className }: StatusLabelProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--muted-foreground)',
      }}
    >
      {LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 6: Create Pill**

Create `apps/web/src/components/helpdesk-orb/Pill.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { PillTone } from './types';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  muted: { bg: 'var(--muted)', fg: 'var(--foreground)' },
  brand: {
    bg: 'oklch(0.65 0.22 40 / 0.1)',
    fg: 'var(--brand-orange-dark)',
  },
  success: {
    bg: 'oklch(0.68 0.15 145 / 0.1)',
    fg: 'oklch(0.45 0.15 145)',
  },
};

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = 'muted', children, className }: PillProps) {
  const t = TONES[tone];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 9999,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        background: t.bg,
        color: t.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 7: Run both tests — verify they pass**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/__tests__/StatusLabel.test.tsx src/components/helpdesk-orb/__tests__/Pill.test.tsx
```

Expected: all 7 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/design-tokens/src/tokens.css \
        apps/web/src/app/globals.css \
        apps/web/src/components/helpdesk-orb/StatusLabel.tsx \
        apps/web/src/components/helpdesk-orb/Pill.tsx \
        apps/web/src/components/helpdesk-orb/__tests__/StatusLabel.test.tsx \
        apps/web/src/components/helpdesk-orb/__tests__/Pill.test.tsx
git commit -m "feat(helpdesk-primitives): web StatusLabel + Pill primitives

Adds --brand-orange-dark design token used by Pill tone=brand."
```

---

## Task 4: Web — barrel export

**Files:**
- Create: `apps/web/src/components/helpdesk-orb/index.ts`

- [ ] **Step 1: Create public API**

Create `apps/web/src/components/helpdesk-orb/index.ts`:

```ts
export { Orb } from './Orb';
export type { OrbProps } from './Orb';

export { LighthouseAvatar } from './LighthouseAvatar';
export type { LighthouseAvatarProps } from './LighthouseAvatar';

export { StatusLabel } from './StatusLabel';
export type { StatusLabelProps } from './StatusLabel';

export { Pill } from './Pill';
export type { PillProps } from './Pill';

export type { OrbStatus, HaloIntensity, PillTone } from './types';
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/helpdesk-orb/index.ts
git commit -m "feat(helpdesk-primitives): web barrel export"
```

---

## Task 5: Web — Preview route for visual QA

**Files:**
- Create: `apps/web/src/app/platform-admin/helpdesk-preview/page.tsx`
- Create: `apps/web/src/app/platform-admin/helpdesk-preview/_components/PrimitivesGallery.tsx`

- [ ] **Step 1: Create the Server Component shell**

Create `apps/web/src/app/platform-admin/helpdesk-preview/page.tsx`:

```tsx
import { PrimitivesGallery } from './_components/PrimitivesGallery';

export const metadata = {
  title: 'Helpdesk Primitives Preview',
};

export default function HelpdeskPreviewPage() {
  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}
      >
        Helpdesk Primitives
      </h1>
      <p
        style={{
          color: 'var(--muted-foreground)',
          fontSize: 15,
          marginBottom: 40,
        }}
      >
        Visual QA surface. Orb, LighthouseAvatar, StatusLabel, Pill.
      </p>
      <PrimitivesGallery />
    </div>
  );
}
```

- [ ] **Step 2: Create the gallery**

Create `apps/web/src/app/platform-admin/helpdesk-preview/_components/PrimitivesGallery.tsx`:

```tsx
'use client';

import {
  Orb,
  LighthouseAvatar,
  StatusLabel,
  Pill,
} from '@/components/helpdesk-orb';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted-foreground)',
          marginBottom: 16,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function PrimitivesGallery() {
  return (
    <div>
      <Section title="Orb — size 48, 3 statuses">
        <div data-variant="waiting">
          <Orb status="waiting" aria-label="waiting" />
          <div style={{ fontSize: 11, marginTop: 4 }}>waiting</div>
        </div>
        <div data-variant="active">
          <Orb status="active" aria-label="active" />
          <div style={{ fontSize: 11, marginTop: 4 }}>active</div>
        </div>
        <div data-variant="complete">
          <Orb status="complete" withCheck aria-label="complete" />
          <div style={{ fontSize: 11, marginTop: 4 }}>complete</div>
        </div>
      </Section>

      <Section title="Orb — pulse animation">
        <Orb size={14} status="waiting" pulse aria-label="pulse small" />
        <Orb size={48} status="waiting" pulse aria-label="pulse medium" />
        <Orb size={52} status="waiting" pulse aria-label="pulse large" />
      </Section>

      <Section title="LighthouseAvatar — 3 halo intensities">
        <LighthouseAvatar name="Linn Andersen" halo="idle" />
        <LighthouseAvatar name="Kari Holm" halo="waiting" />
        <LighthouseAvatar name="Ola Hansen" halo="active" />
      </Section>

      <Section title="LighthouseAvatar — sizes">
        <LighthouseAvatar name="Linn" size={32} halo="idle" />
        <LighthouseAvatar name="Linn" size={56} halo="idle" />
        <LighthouseAvatar name="Linn" size={80} halo="idle" />
      </Section>

      <Section title="StatusLabel — 3 states">
        <StatusLabel status="waiting" />
        <StatusLabel status="active" />
        <StatusLabel status="complete" />
      </Section>

      <Section title="Pill — 3 tones">
        <Pill tone="muted">3</Pill>
        <Pill tone="brand">#lønn</Pill>
        <Pill tone="success">AKTIV</Pill>
      </Section>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

```bash
cd apps/web && pnpm dev
```

Navigate to `http://localhost:3000/platform-admin/helpdesk-preview`. Expected: page renders without errors, shows all 6 sections, orbs animate, halos visible.

Press Ctrl+C to stop dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/helpdesk-preview/
git commit -m "feat(helpdesk-primitives): web preview route for visual QA"
```

---

## Task 6: Web — Playwright E2E screenshot baseline

**Files:**
- Create: `apps/e2e/tests/helpdesk-primitives-preview.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `apps/e2e/tests/helpdesk-primitives-preview.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('helpdesk primitives preview renders all sections', async ({ page }) => {
  await page.goto('/platform-admin/helpdesk-preview');

  await expect(page.getByRole('heading', { name: 'Helpdesk Primitives' })).toBeVisible();
  await expect(page.getByText('Orb — size 48, 3 statuses')).toBeVisible();
  await expect(page.getByText('Orb — pulse animation')).toBeVisible();
  await expect(page.getByText('LighthouseAvatar — 3 halo intensities')).toBeVisible();
  await expect(page.getByText('StatusLabel — 3 states')).toBeVisible();
  await expect(page.getByText('Pill — 3 tones')).toBeVisible();

  await expect(page.getByLabel('waiting')).toBeVisible();
  await expect(page.getByLabel('active')).toBeVisible();
  await expect(page.getByLabel('complete')).toBeVisible();

  await expect(page.getByText('VENTER')).toBeVisible();
  await expect(page.getByText('AKTIV')).toBeVisible();
  await expect(page.getByText('LØST')).toBeVisible();
});

test('helpdesk primitives preview — visual regression baseline', async ({ page }) => {
  await page.goto('/platform-admin/helpdesk-preview');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('helpdesk-primitives-preview.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});
```

- [ ] **Step 2: Generate baseline screenshot**

```bash
cd apps/e2e && pnpm exec playwright test tests/helpdesk-primitives-preview.spec.ts --update-snapshots
```

Expected: PASS. Baseline PNG created at `apps/e2e/tests/helpdesk-primitives-preview.spec.ts-snapshots/`.

- [ ] **Step 3: Re-run without update — verify it still passes**

```bash
cd apps/e2e && pnpm exec playwright test tests/helpdesk-primitives-preview.spec.ts
```

Expected: 2 PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/helpdesk-primitives-preview.spec.ts \
        apps/e2e/tests/helpdesk-primitives-preview.spec.ts-snapshots/
git commit -m "test(helpdesk-primitives): E2E smoke + screenshot baseline"
```

---

## Task 7: Mobile — Orb primitive (TDD)

**Files:**
- Create: `apps/mobile/src/components/orb/types.ts`
- Create: `apps/mobile/src/components/orb/Orb.tsx`
- Create: `apps/mobile/src/components/orb/__tests__/Orb.test.tsx`

- [ ] **Step 1: Ensure `expo-linear-gradient` installed**

```bash
cd apps/mobile && pnpm list expo-linear-gradient
```

If not installed: `pnpm add expo-linear-gradient`.

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/components/orb/__tests__/Orb.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Orb } from '../Orb';

describe('Orb (native)', () => {
  it('renders at default size 48', () => {
    const { getByTestId } = render(
      <Orb testID="orb" accessibilityLabel="ticket status" />
    );
    const orb = getByTestId('orb');
    expect(orb.props.style).toEqual(
      expect.objectContaining({ width: 48, height: 48 })
    );
  });

  it('renders accessibility label', () => {
    const { getByLabelText } = render(
      <Orb testID="orb" accessibilityLabel="waiting" />
    );
    expect(getByLabelText('waiting')).toBeTruthy();
  });

  it('renders check icon when withCheck=true', () => {
    const { getByTestId } = render(
      <Orb testID="orb" withCheck accessibilityLabel="done" />
    );
    expect(getByTestId('orb-check')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Create types**

Create `apps/mobile/src/components/orb/types.ts`:

```ts
export type OrbStatus = 'waiting' | 'active' | 'complete';
export type HaloIntensity = 'idle' | 'waiting' | 'active';
export type PillTone = 'muted' | 'brand' | 'success';
```

- [ ] **Step 4: Create the component**

Create `apps/mobile/src/components/orb/Orb.tsx`:

```tsx
import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { OrbStatus } from './types';

const CHROMA: Record<OrbStatus, number> = {
  waiting: 0.08,
  active: 0.12,
  complete: 0.04,
};

export interface OrbProps {
  size?: number;
  status?: OrbStatus;
  pulse?: boolean;
  withCheck?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Orb({
  size = 48,
  status = 'waiting',
  pulse = false,
  withCheck = false,
  style,
  testID,
  accessibilityLabel,
}: OrbProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (pulse && !reducedMotion) {
      scale.value = withRepeat(
        withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      opacity.value = withRepeat(
        withTiming(0.82, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      scale.value = 1;
      opacity.value = 1;
    }
  }, [pulse, reducedMotion, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const chroma = CHROMA[status];
  // OKLCH → RGBA approximation for RN (no native OKLCH support).
  // Resolved offline from the prototype's chroma × hue 50 gradient.
  const stops = {
    waiting: ['#c29a74', 'rgba(166,127,91,0.75)', 'rgba(125,94,65,0.35)', 'transparent'],
    active: ['#cf9765', 'rgba(180,119,73,0.75)', 'rgba(137,87,50,0.35)', 'transparent'],
    complete: ['#b7a89a', 'rgba(155,139,126,0.75)', 'rgba(117,103,93,0.35)', 'transparent'],
  }[status];

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={stops}
          locations={[0, 0.35, 0.6, 0.75]}
          start={{ x: 0.45, y: 0.35 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      {withCheck && (
        <Check
          testID="orb-check"
          size={size * 0.42}
          strokeWidth={2.25}
          color="#1c1814"
        />
      )}
    </View>
  );
}
```

- [ ] **Step 5: Run the test**

```bash
cd apps/mobile && pnpm exec jest src/components/orb/__tests__/Orb.test.tsx
```

Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/orb/types.ts \
        apps/mobile/src/components/orb/Orb.tsx \
        apps/mobile/src/components/orb/__tests__/Orb.test.tsx \
        apps/mobile/package.json apps/mobile/pnpm-lock.yaml
git commit -m "feat(helpdesk-primitives): mobile Orb component with Reanimated pulse"
```

---

## Task 8: Mobile — LighthouseAvatar, StatusLabel, Pill (single commit)

**Files:**
- Create: `apps/mobile/src/components/orb/LighthouseAvatar.tsx`
- Create: `apps/mobile/src/components/orb/StatusLabel.tsx`
- Create: `apps/mobile/src/components/orb/Pill.tsx`
- Create: `apps/mobile/src/components/orb/index.ts`
- Create: `apps/mobile/src/components/orb/__tests__/LighthouseAvatar.test.tsx`
- Create: `apps/mobile/src/components/orb/__tests__/StatusLabel.test.tsx`
- Create: `apps/mobile/src/components/orb/__tests__/Pill.test.tsx`

- [ ] **Step 1: Write failing tests for all three**

Create `apps/mobile/src/components/orb/__tests__/LighthouseAvatar.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { LighthouseAvatar } from '../LighthouseAvatar';

describe('LighthouseAvatar (native)', () => {
  it('renders initials from name', () => {
    const { getByText } = render(<LighthouseAvatar name="Linn Andersen" />);
    expect(getByText('LA')).toBeTruthy();
  });

  it('renders ? fallback when no name', () => {
    const { getByText } = render(<LighthouseAvatar />);
    expect(getByText('?')).toBeTruthy();
  });
});
```

Create `apps/mobile/src/components/orb/__tests__/StatusLabel.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { StatusLabel } from '../StatusLabel';

describe('StatusLabel (native)', () => {
  it('renders VENTER for waiting', () => {
    const { getByText } = render(<StatusLabel status="waiting" />);
    expect(getByText('VENTER')).toBeTruthy();
  });

  it('renders AKTIV for active', () => {
    const { getByText } = render(<StatusLabel status="active" />);
    expect(getByText('AKTIV')).toBeTruthy();
  });

  it('renders LØST for complete', () => {
    const { getByText } = render(<StatusLabel status="complete" />);
    expect(getByText('LØST')).toBeTruthy();
  });
});
```

Create `apps/mobile/src/components/orb/__tests__/Pill.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Pill } from '../Pill';

describe('Pill (native)', () => {
  it('renders children text', () => {
    const { getByText } = render(<Pill>3</Pill>);
    expect(getByText('3')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Create LighthouseAvatar (native)**

Create `apps/mobile/src/components/orb/LighthouseAvatar.tsx`:

```tsx
import { View, Text, type ViewStyle } from 'react-native';
import type { HaloIntensity } from './types';

const HALO_COLOR: Record<HaloIntensity, string> = {
  idle: 'rgba(180,150,120,0.28)',
  waiting: 'rgba(210,155,95,0.35)',
  active: 'rgba(224,150,70,0.40)',
};

export interface LighthouseAvatarProps {
  name?: string;
  size?: number;
  halo?: HaloIntensity;
  style?: ViewStyle;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return (
    name
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function LighthouseAvatar({
  name,
  size = 56,
  halo = 'idle',
  style,
}: LighthouseAvatarProps) {
  const haloSize = size * 1.5;
  const initials = getInitials(name);

  return (
    <View
      style={[
        {
          width: haloSize,
          height: haloSize,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: HALO_COLOR[halo],
          opacity: 0.55,
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#8a6f50',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: size * 0.36,
            fontWeight: '500',
          }}
        >
          {initials}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Create StatusLabel (native)**

Create `apps/mobile/src/components/orb/StatusLabel.tsx`:

```tsx
import { Text } from 'react-native';
import type { OrbStatus } from './types';

const LABEL: Record<OrbStatus, string> = {
  waiting: 'VENTER',
  active: 'AKTIV',
  complete: 'LØST',
};

export interface StatusLabelProps {
  status: OrbStatus;
}

export function StatusLabel({ status }: StatusLabelProps) {
  return (
    <Text
      style={{
        fontFamily: 'GeistMono',
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1.3,
        color: '#7a756e',
      }}
    >
      {LABEL[status]}
    </Text>
  );
}
```

- [ ] **Step 4: Create Pill (native)**

Create `apps/mobile/src/components/orb/Pill.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import type { PillTone } from './types';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  muted: { bg: '#f5f3f0', fg: '#1c1814' },
  brand: { bg: 'rgba(249,115,22,0.10)', fg: '#c2410c' },
  success: { bg: 'rgba(17,173,50,0.10)', fg: '#0e7d26' },
};

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

export function Pill({ tone = 'muted', children }: PillProps) {
  const t = TONES[tone];
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
        backgroundColor: t.bg,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: 'GeistMono',
          fontSize: 11,
          color: t.fg,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: Create barrel export**

Create `apps/mobile/src/components/orb/index.ts`:

```ts
export { Orb } from './Orb';
export type { OrbProps } from './Orb';

export { LighthouseAvatar } from './LighthouseAvatar';
export type { LighthouseAvatarProps } from './LighthouseAvatar';

export { StatusLabel } from './StatusLabel';
export type { StatusLabelProps } from './StatusLabel';

export { Pill } from './Pill';
export type { PillProps } from './Pill';

export type { OrbStatus, HaloIntensity, PillTone } from './types';
```

- [ ] **Step 6: Run all mobile tests**

```bash
cd apps/mobile && pnpm exec jest src/components/orb/__tests__/
```

Expected: 8 PASS across all 4 primitives.

- [ ] **Step 7: Typecheck mobile**

```bash
pnpm --filter @smartout/mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/orb/
git commit -m "feat(helpdesk-primitives): mobile LighthouseAvatar + StatusLabel + Pill"
```

---

## Task 9: Mobile — Dev preview screen

**Files:**
- Create: `apps/mobile/app/(app)/(me)/design-preview.tsx`

- [ ] **Step 1: Create preview screen**

Create `apps/mobile/app/(app)/(me)/design-preview.tsx`:

```tsx
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Orb,
  LighthouseAvatar,
  StatusLabel,
  Pill,
} from '@/components/orb';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 32 }}>
      <Text
        style={{
          fontFamily: 'GeistMono',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.3,
          textTransform: 'uppercase',
          color: '#7a756e',
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function DesignPreviewScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fdfcfa' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif',
            fontSize: 28,
            fontWeight: '700',
            marginBottom: 24,
          }}
        >
          Helpdesk Primitives
        </Text>

        <Section title="Orb — 3 statuses">
          <Orb status="waiting" accessibilityLabel="waiting" />
          <Orb status="active" accessibilityLabel="active" />
          <Orb status="complete" withCheck accessibilityLabel="complete" />
        </Section>

        <Section title="Orb — pulse">
          <Orb size={14} status="waiting" pulse accessibilityLabel="small pulse" />
          <Orb size={48} status="waiting" pulse accessibilityLabel="medium pulse" />
        </Section>

        <Section title="LighthouseAvatar — 3 halos">
          <LighthouseAvatar name="Linn Andersen" halo="idle" />
          <LighthouseAvatar name="Kari Holm" halo="waiting" />
          <LighthouseAvatar name="Ola Hansen" halo="active" />
        </Section>

        <Section title="StatusLabel">
          <StatusLabel status="waiting" />
          <StatusLabel status="active" />
          <StatusLabel status="complete" />
        </Section>

        <Section title="Pill — 3 tones">
          <Pill tone="muted">3</Pill>
          <Pill tone="brand">#lønn</Pill>
          <Pill tone="success">AKTIV</Pill>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @smartout/mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/\(me\)/design-preview.tsx
git commit -m "feat(helpdesk-primitives): mobile preview screen"
```

---

## Task 10: Full gate check + close

- [ ] **Step 1: Grep guard — no consumers modified**

```bash
git diff --name-only campaign/helpdesk..HEAD | \
  grep -v -E "^(apps/web/src/components/helpdesk-orb/|apps/mobile/src/components/orb/|apps/web/src/app/platform-admin/helpdesk-preview/|apps/mobile/app/\(app\)/\(me\)/design-preview\.tsx|apps/e2e/tests/helpdesk-primitives-preview|packages/design-tokens/src/tokens\.css|apps/web/src/app/globals\.css|docs/)" || echo "CLEAN"
```

Expected: `CLEAN` (no out-of-scope files touched).

- [ ] **Step 2: Full typecheck**

```bash
pnpm --filter web typecheck && pnpm --filter @smartout/mobile typecheck
```

Expected: 0 errors both.

- [ ] **Step 3: Run all new unit tests**

```bash
cd apps/web && pnpm exec vitest run src/components/helpdesk-orb/
cd ../mobile && pnpm exec jest src/components/orb/
```

Expected: all PASS (10 web + 8 mobile = 18 tests).

- [ ] **Step 4: Lint**

```bash
cd apps/web && pnpm exec eslint src/components/helpdesk-orb/ src/app/platform-admin/helpdesk-preview/
cd ../mobile && pnpm exec eslint src/components/orb/
```

Expected: 0 errors.

- [ ] **Step 5: Playwright E2E**

```bash
cd apps/e2e && pnpm exec playwright test tests/helpdesk-primitives-preview.spec.ts
```

Expected: 2 PASS.

- [ ] **Step 6: Flip journey + write handoff**

Edit `docs/journeys/JOURNEY-helpdesk-primitives.md` (will be created by `/start-feature`): flip `status: draft → verified`.

Write `docs/HANDOFF-helpdesk-primitives.md` with:
- Scope delivered (4 web primitives + 4 mobile primitives + 2 preview routes + E2E baseline)
- API contract for consumers (Phase 2-5 reference)
- Token added: `--brand-orange-dark`
- Known limitations (RN LinearGradient is 4-stop approximation of the 4-stop OKLCH gradient; true OKLCH on RN awaiting expo-linear-gradient v15 color-interpolation support)

- [ ] **Step 7: Final commit**

```bash
git add docs/journeys/JOURNEY-helpdesk-primitives.md docs/HANDOFF-helpdesk-primitives.md
git commit -m "docs(helpdesk-primitives): journey verified + handoff"
```

- [ ] **Step 8: Hand over to close-feature**

Report to user:
```
Phase 1 (primitives) complete. All gates green.

Deliverables:
- Web: Orb, LighthouseAvatar, StatusLabel, Pill in apps/web/src/components/helpdesk-orb/
- Mobile: same 4 primitives in apps/mobile/src/components/orb/
- Preview routes: /platform-admin/helpdesk-preview (web) + /me/design-preview (mobile)
- E2E baseline screenshot
- 18 unit tests passing
- --brand-orange-dark token added

Ready for: /close-feature → merge to campaign/helpdesk → start Phase 2 (web-ticket).
```

---

## Acceptance Criteria

- [ ] 4 web primitives exist in `apps/web/src/components/helpdesk-orb/` with unit tests, all pass
- [ ] 4 mobile primitives exist in `apps/mobile/src/components/orb/` with unit tests, all pass
- [ ] Web preview route renders without errors at `/platform-admin/helpdesk-preview`
- [ ] Mobile preview screen renders without errors
- [ ] Playwright screenshot baseline committed
- [ ] `pnpm --filter web typecheck` and `pnpm --filter @smartout/mobile typecheck` both 0 errors
- [ ] ESLint: 0 new errors
- [ ] `--brand-orange-dark` token exists in `packages/design-tokens/src/tokens.css` (light + dark) and is mapped in `apps/web/src/app/globals.css` `@theme inline`
- [ ] Zero consumers of existing helpdesk UI modified — `git diff --name-only` returns only files in the allowed paths
- [ ] Journey `status: verified`
- [ ] Handoff documents API contract for Phase 2-5 to consume

## Out of scope

- Redesign of `TicketHeader.tsx`, `TicketConversationView.tsx`, `MessageBubble.tsx`, `ChannelList.tsx`, `QueueRow.tsx`, `ResolveFAB.tsx`, or any existing komm/helpdesk component — **Phase 2-5**
- `bg-signal-live` semantic token — Phase 2.5 per prior council
- Mobile true OKLCH interpolation — awaiting upstream expo-linear-gradient support
- Integration of primitives into any existing surface — by definition, Phase 2+

## Risks & mitigation

| Risk | Mitigation |
|---|---|
| Mobile OKLCH color loss (RN doesn't support OKLCH natively) | 4-stop RGB approximation; visual QA on physical device in mobile preview task |
| Screenshot diff flake on CI (font loading, animation timing) | `waitForLoadState('networkidle')` + 500ms grace + `maxDiffPixelRatio: 0.02` tolerance |
| `--brand-orange-dark` collides with existing token | Grep gate in Task 3 Step 1 |
| Reanimated v3 not configured in test env | Mock via `react-native-reanimated/mock` in jest setup (check existing mocks first; most likely already configured) |
| Preview route leaks to production bundle | Route lives under `/platform-admin/*` which is gated; additionally add `next.config` route-level gate if needed (outside Phase 1 scope) |

## Self-Review

**1. Spec coverage:** Every primitive from `shared.jsx` (Orb, LighthouseAvatar, StatusLabel, Pill) has both a web and mobile task. `Switch`, `Radio`, `Btn`, `Avatar` (non-lighthouse) and `Icon` (inline SVG map) are NOT in scope — they're either shadcn/ui wrappers (Btn, Switch, Radio) or general-purpose (Avatar, Icon from lucide-react). Deferred to consumer-side Phase 2-5 if needed.

**2. Placeholder scan:** No TBD, TODO, "handle edge cases". Every step has concrete code or concrete command with expected output.

**3. Type consistency:** `OrbStatus`, `HaloIntensity`, `PillTone` defined in `types.ts`, used in Orb, LighthouseAvatar, StatusLabel, Pill web + mobile. Same names. Same enum values.

**4. Cross-reference:** Preview gallery consumes from `@/components/helpdesk-orb` (web) and `@/components/orb` (mobile) — paths match barrel creations in Task 4 and Task 8 Step 5.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-helpdesk-primitives.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans skill, batch execution with checkpoints.

Which approach?
