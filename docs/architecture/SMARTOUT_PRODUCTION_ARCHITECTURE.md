---
title: "Production Architecture"
id: PROD_ARCH
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-26
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - production
  - images
  - i18n
  - scalability
  - monitoring
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# SMARTOUT — Production Architecture

> **Status:** Decided
> **Updated:** February 26, 2026
> **Scope:** Image pipeline, AI image generation, i18n & translation, scalability patterns, cost model, monitoring
> **Reference:** Based on production research audit (Feb 25, 2026). See `Production_Architecture_for_a_Norwegian_Hospitality_SaaS_on_Supabase.md` for deep-dive source material.

---

## 1. Image Processing Pipeline

### Architecture

Split responsibility between client and server. Never upload raw camera photos.

```
MOBILE CAPTURE
  │
  ├── expo-image-picker (capture)
  ├── expo-image-manipulator (resize + compress)
  │     → 1200px max width, JPEG 70% → ~200-400KB
  │
  └── Upload to Supabase Storage (TUS resumable protocol)
        │
        ├── Supabase Storage built-in transforms (imgproxy)
        │     → Thumbnails, responsive sizes via URL params
        │     → Cached by Smart CDN
        │
        └── Next.js API route (sharp) — Phase 2+
              → Enhancement, watermarks, HACCP metadata overlays
              → sharp does NOT run in Edge Functions (Deno)
```

### Client-Side Compression (Required)

```typescript
import { useImageManipulator, SaveFormat } from "expo-image-manipulator";

const context = useImageManipulator(photoUri);
context.resize({ width: 1200 });
const rendered = await context.renderAsync();
const result = await rendered.saveAsync({
  format: SaveFormat.JPEG,
  compress: 0.7,
});
// result.uri → upload to Supabase Storage
```

### Server-Side Enhancement (Phase 2+)

```typescript
// Next.js API route — NOT Edge Function
import sharp from "sharp";

const processed = await sharp(buffer)
  .rotate() // Auto-orient EXIF
  .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
  .normalize() // Auto-stretch contrast
  .modulate({ brightness: 1.15, saturation: 1.1 }) // Fix dim kitchen lighting
  .sharpen({ sigma: 1.5 }) // Counteract soft phone lens
  .median(3) // Light noise reduction
  .gamma(1.1) // Lift shadows
  .jpeg({ quality: 85, mozjpeg: true })
  .toBuffer();
```

### Supabase Storage Organization

```
Bucket: workspace-files (private, RLS-protected)
  └── {workspace_id}/
        ├── haccp/{YYYY-MM}/{uuid}.jpg       — HACCP compliance photos
        ├── training/{YYYY-MM}/{uuid}.jpg    — Training content
        ├── profiles/{uuid}.jpg              — Employee photos
        └── documents/{YYYY-MM}/{uuid}.pdf   — Contracts, policies

Bucket: public-assets (public)
  └── {workspace_id}/
        ├── avatars/{uuid}.jpg               — Profile avatars
        └── generated/{module_id}/{uuid}.png — AI training illustrations
```

### Implementation Phases

| Phase             | What                                                                                | When            |
| ----------------- | ----------------------------------------------------------------------------------- | --------------- |
| **Phase 1 (MVP)** | expo-image-picker → expo-image-manipulator → Supabase Storage → built-in transforms | Phase 0         |
| **Phase 2**       | Add sharp in Next.js API routes for watermarks, HACCP overlays, enhancement         | Phase 5 (HACCP) |
| **Phase 3**       | Cloudinary free tier or self-hosted imgproxy for AI auto-enhancement                | Post-launch     |

---

## 2. AI Image Generation

### Purpose

Generate instructional illustrations for the Training module (Module 6) — step-by-step procedures, safety diagrams, equipment guides. Replaces expensive custom artwork.

### Provider Selection

| Provider / Model                     | Per image | 500/month | Best for                           |
| ------------------------------------ | --------- | --------- | ---------------------------------- |
| **OpenAI GPT Image 1 Mini (Medium)** | $0.020    | $10       | **Production — instructional art** |
| OpenAI DALL-E 3 Standard             | $0.040    | $20       | Higher-quality illustrations       |
| Google Imagen 4 Fast                 | $0.020    | $10       | Photorealistic environments        |
| Replicate FLUX Schnell               | $0.003    | $1.50     | Rapid prototyping                  |

**Decision:** OpenAI GPT Image 1 Mini for production. DALL-E 3 as fallback for higher quality needs.

### Edge Function Integration

Cache-first pattern. Generation calls work from Edge Functions because API calls are I/O-bound (minimal CPU time consumed despite 10-30s wall-clock).

```
REQUEST FOR TRAINING ILLUSTRATION
  │
  ├── Construct deterministic path: training/{moduleId}/step-{stepNumber}.png
  ├── Check Supabase Storage → if exists, return URL
  │
  └── Cache miss:
        ├── Call OpenAI API (GPT Image 1 Mini)
        ├── Upload to Supabase Storage
        ├── Insert metadata to generated_images table
        └── Return URL
```

### Database Schema

```sql
CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id),
  storage_path TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  model TEXT NOT NULL,
  quality TEXT,
  size TEXT,
  module_id UUID REFERENCES training_modules(id),
  step_number INTEGER,
  cost_usd DECIMAL(10,4),
  prompt_hash TEXT GENERATED ALWAYS AS (encode(digest(prompt, 'sha256'), 'hex')) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_images_workspace ON generated_images(workspace_id);
CREATE INDEX idx_generated_images_path ON generated_images(storage_path);
CREATE INDEX idx_generated_images_prompt_hash ON generated_images(prompt_hash);
```

### Prompt Engineering

Standardized style prompt stored per workspace, prepended to every generation:

```
"Professional instructional illustration for restaurant employee training.
Clean flat-design vector illustration with thick outlines.
[3/4 view | overhead for layouts].
No text overlays. No photorealistic faces."
```

---

## 3. Internationalization (i18n) & Translation

### Static UI Translation

Two libraries, one set of JSON translation files.

| Platform                  | Library                                           | Why                                                                                                                |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Web (Next.js)**         | `next-intl`                                       | Built for App Router. Server Components support. ~2KB bundle. **NOT next-i18next** (incompatible with App Router). |
| **Mobile (React Native)** | `i18next` + `react-i18next` + `expo-localization` | Industry standard. Device locale detection.                                                                        |
| **Shared**                | `packages/i18n`                                   | JSON translation files consumed by both platforms.                                                                 |

### Supported Languages

| Language         | Code | Status        | Priority |
| ---------------- | ---- | ------------- | -------- |
| Norsk (Bokmål)   | `nb` | Primary       | Launch   |
| English          | `en` | Planned       | Launch   |
| Svenska          | `sv` | Planned       | V1.1     |
| Dansk            | `da` | Planned       | V1.1     |
| Polski           | `pl` | Planned       | V1.2     |
| العربية (Arabic) | `ar` | Planned (RTL) | V1.2     |
| Soomaali         | `so` | Planned       | V1.2     |
| Suomi            | `fi` | Planned       | V1.3     |

**Decision:** Use `nb` (Bokmål) as primary Norwegian locale. Nynorsk deferred — used by only 5-10% of Norwegians. Nynorsk readers understand Bokmål.

### Dynamic Content Translation

For chat messages, policies, announcements — content generated by users.

| Provider                        | Price                  | Free Tier                 | Somali | Nynorsk | Quality (Nordic)    |
| ------------------------------- | ---------------------- | ------------------------- | ------ | ------- | ------------------- |
| **Google Cloud Translation v3** | $20/M chars            | 500K chars/mo (permanent) | ✅     | ✅      | Very good           |
| DeepL Pro                       | $5.49/mo + $25/M chars | 500K chars/mo             | ❌     | ❌      | **Best**            |
| Azure Translator                | $10/M chars            | 2M chars/mo (12 months)   | ✅     | ✅      | Very good           |
| OpenAI GPT-4o-mini              | ~$0.15/M tokens        | None                      | ✅     | ✅      | Excellent (context) |

**Decision:** Google Cloud Translation v3 as primary (broadest language support, permanent free tier). DeepL as premium layer for Nordic-to-Nordic pairs. OpenAI GPT-4o-mini for policy documents where context awareness justifies latency.

### Translation Architecture

**Pattern:** Translate-on-receive with caching.

```
READER OPENS MESSAGE (different language from original)
  │
  ├── Check message_translations cache
  │     Key: (workspace_id, source_text_hash, source_lang, target_lang)
  │
  ├── Cache HIT → return cached translation
  │
  └── Cache MISS:
        ├── Call Google Cloud Translation v3
        ├── Store in message_translations table
        └── Return translation
```

**Cost with caching (70-80% hit rate):**

- 100 users: ~$80-160/month (vs $300-600 without caching)
- Pre-translate top 500 hospitality phrases in all languages

### RTL Support (Arabic)

Must be implemented from day one. Retrofitting is significantly harder.

- **Web:** `dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'}` on `<html>` tag
- **CSS:** Logical properties throughout — `margin-inline-start` not `margin-left`
- **React Native:** `I18nManager.forceRTL()` + `paddingStart`/`paddingEnd`
- `flexDirection: 'row'` auto-reverses in RTL mode

---

## 4. RLS & Scalability Patterns

### Five Essential RLS Optimizations

These are non-negotiable for production. Without them, queries degrade 100× at 100K+ rows.

**1. Index workspace_id on every table**

```sql
CREATE INDEX idx_{table}_workspace ON {table}(workspace_id);
CREATE INDEX idx_{table}_workspace_created ON {table}(workspace_id, created_at DESC);
```

**2. Cache auth functions with subselect**

```sql
-- ❌ Evaluates per-row
auth.uid() = user_id

-- ✅ Cached per-statement via initPlan
(SELECT auth.uid()) = user_id
```

**3. Invert membership checks**

```sql
-- ❌ Correlated subquery per-row
EXISTS (SELECT 1 FROM workspace_members WHERE ...)

-- ✅ Set membership check
workspace_id IN (
  SELECT workspace_id FROM workspace_members
  WHERE user_id = (SELECT auth.uid())
)
```

**4. Store workspace_id in JWT claims**

```sql
-- Via Supabase Auth hook: set workspace_id in app_metadata
workspace_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
```

**5. Separate policies per operation**

```sql
-- ❌ FOR ALL
CREATE POLICY "access" ON table FOR ALL ...

-- ✅ Separate + scoped
CREATE POLICY "select" ON table FOR SELECT TO authenticated ...
CREATE POLICY "insert" ON table FOR INSERT TO authenticated ...
```

### Edge Function Limits (Pro Plan)

| Metric               | Limit                                    |
| -------------------- | ---------------------------------------- |
| Invocations/month    | 2M ($2 per additional 1M)                |
| Cold start           | ~400ms median                            |
| Warm request         | ~125ms                                   |
| CPU time             | 200ms actual CPU cycles (not wall-clock) |
| Request idle timeout | 150 seconds (for I/O-bound ops)          |

**Key insight:** API calls to OpenAI, Google Translate, etc. consume minimal CPU time despite 10-30s wall-clock time. They work fine from Edge Functions.

**For high-throughput batch operations:** Use Postgres triggers or database functions instead of individual Edge Function calls — eliminates HTTP overhead.

### Supabase Realtime Limits

| Plan           | Concurrent WebSocket Connections |
| -------------- | -------------------------------- |
| Pro            | 500                              |
| Team ($599/mo) | 10,000                           |

Each connection supports up to 100 channels.

**Optimization rules:**

- Use **Broadcast** for high-frequency ephemeral events (typing indicators, live status)
- Reserve **Postgres Changes** for actual database mutations
- Postgres Changes processed on single thread regardless of compute size
- Always filter: `.eq('workspace_id', currentWorkspaceId)`
- One channel per workspace, not one per table

---

## 5. Cost Model

### Launch Phase (1-10 workspaces)

| Service                  | Plan                   | Monthly  |
| ------------------------ | ---------------------- | -------- |
| Supabase                 | Pro + Micro compute    | $25      |
| Vercel                   | Pro (1 seat)           | $20      |
| Expo / EAS               | Starter                | $19      |
| Sentry                   | Free (5K events)       | $0       |
| Google Cloud Translation | Free tier (500K chars) | $0       |
| Domain + SSL             | Amortized annual       | $2       |
| **Total**                |                        | **~$66** |

### Growth Phase (100 workspaces / ~2,000 MAUs)

| Service             | Plan                    | Monthly   |
| ------------------- | ----------------------- | --------- |
| Supabase            | Pro + Large compute     | $110      |
| Vercel              | Pro                     | $20       |
| Expo / EAS          | Production              | $199      |
| Translation         | Google Cloud + cache    | $10-25    |
| AI Image Generation | OpenAI GPT Image 1 Mini | $20-50    |
| Sentry              | Team                    | $26       |
| **Total**           |                         | **~$400** |

### Scale Phase (1,000 workspaces / ~15,000 MAUs)

| Service          | Plan                         | Monthly     |
| ---------------- | ---------------------------- | ----------- |
| Supabase         | Pro + primary + read replica | $420        |
| Expo / EAS       | Production + overage         | $250-350    |
| Translation      | Google Cloud + DeepL         | $50-100     |
| Auth MAU overage | $3.25/1K MAUs                | Variable    |
| **Total**        |                              | **~$1,100** |

**Breakeven:** Under 10 paying workspaces at Norwegian SaaS pricing (500-2,000 NOK/workspace/month ≈ $50-200 USD).

### Supabase Plan Upgrade Triggers

| Trigger                    | Action                           |
| -------------------------- | -------------------------------- |
| Production app (any)       | Free → Pro ($25/mo) immediately  |
| Noisy-neighbor latency     | Micro → Large compute ($110/mo)  |
| Customer requires SSO/SOC2 | Pro → Team ($599/mo)             |
| Analytics bottleneck       | Add Read Replica ($210/mo on XL) |

---

## 6. Monitoring (Day One)

All free tier. Zero cost at launch.

| Tool                   | What It Monitors                                                                                                   | Free Tier          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **Sentry**             | Errors, crashes, performance                                                                                       | 5,000 events/month |
| **Supabase Dashboard** | CPU, memory, disk I/O, connections, cache hit ratio, Performance Advisor (missing indexes), Security Advisor (RLS) | Built-in           |
| **Vercel Analytics**   | Web Vitals, serverless invocations, bandwidth                                                                      | Built-in           |
| **BetterStack**        | Uptime monitoring with Slack/email alerts                                                                          | Free tier          |

**Growth phase additions:**

- Sentry Team ($26/mo) for error grouping and baselines
- `supabase-grafana` (open-source Docker dashboard) for deep Postgres metrics

**Rule:** Pipe all alerts to a single Slack channel. Signal, not noise.

---

## Cross-References

- **Core Architecture v2** — Stack Overview (Section 2), Multi-Tenant Model, RLS
- **Module 5 (HACCP)** — HACCP compliance photos use the image pipeline
- **Module 6 (Training)** — AI-generated instructional illustrations
- **Module 9 (Communication)** — Chat translation, notification delivery
- **Module 13 (Multi-tenant)** — RLS patterns, workspace isolation
- **Packages Architecture** — `packages/i18n` structure, `packages/supabase` hooks
- **CLAUDE.md** — Monorepo structure, code conventions
- **BUILD_ORDER.md** — Phase sequencing for feature delivery
