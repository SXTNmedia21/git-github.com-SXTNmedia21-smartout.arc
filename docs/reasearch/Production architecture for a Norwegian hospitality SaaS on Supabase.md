# Production architecture for a Norwegian hospitality SaaS on Supabase

**A solo builder targeting Norway's HoReCa industry needs a pragmatic, phased approach to image processing, AI generation, multilingual support, and scalability.** The recommended stack centers on client-side compression with `expo-image-manipulator` before upload, server-side enhancement via `sharp` in Next.js API routes, Supabase Storage with built-in imgproxy transforms, OpenAI GPT Image 1 Mini for instructional art at $0.02/image, `next-intl` for web i18n (not next-i18next—it's incompatible with App Router), `react-i18next` for mobile, Google Cloud Translation v3 as the primary translation API, and an aggressive caching layer to control costs. Total infrastructure cost starts at **~$70/month** at launch and scales to ~$1,100/month at 1,000 workspaces—well within viable unit economics at Norwegian SaaS pricing.

---

## Image processing: compress on-device, enhance on-server

The image pipeline must handle photos taken in challenging restaurant environments—dim tungsten lighting, steam, mixed color temperatures, and high ISO noise from phone cameras. The architecture splits responsibility between client and server.

**Client-side (React Native / Expo):** Use `expo-image-picker` (not `react-native-image-crop-picker`, which requires native configuration incompatible with managed Expo workflow) for capture, then `expo-image-manipulator` (bundled with Expo SDK 54) for resize and compression before upload. The new OOP API introduced in SDK 52 provides `useImageManipulator(uri)` with chainable `.resize()`, `.crop()`, and `.saveAsync()` methods. **Always compress on-device before upload**—a raw 8MB phone photo drops to ~200–400KB at 1200px max width / JPEG 70% quality. This is non-negotiable for staff in kitchens, storage rooms, and Norwegian rural areas where mobile connectivity can drop to 3G.

```typescript
// Client-side compression before upload
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

**Server-side (Next.js API routes):** `sharp` v0.34.5 (Apache-2.0, ~37.8M weekly npm downloads) handles enhancement, watermarking, and overlays. Sharp does **not** run in Supabase Edge Functions (Deno runtime doesn't support native libraries), but it runs natively in Next.js server environments. For Edge Functions, the WASM-based `magick-wasm` is the supported alternative, though it's significantly less capable.

```typescript
// Server-side enhancement pipeline in Next.js API route
import sharp from "sharp";

const processed = await sharp(buffer)
  .rotate() // Auto-orient from EXIF
  .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
  .normalize() // Auto-stretch contrast
  .modulate({ brightness: 1.15, saturation: 1.1 }) // Fix dim kitchen lighting
  .sharpen({ sigma: 1.5 }) // Counteract soft phone lens
  .median(3) // Light noise reduction
  .gamma(1.1) // Lift shadows
  .jpeg({ quality: 85, mozjpeg: true })
  .toBuffer();
```

**Watermarks and text overlays** are best handled server-side with sharp's `.composite()` method. Text overlays use SVG buffers composited onto images—sharp has no native text API, but SVG provides full typographic control. For HACCP compliance photos, composite a semi-transparent bar with date/time/location metadata at the bottom of each image.

### Image transform services compared

Supabase Storage includes **built-in image transforms** powered by imgproxy under the hood, available on Pro plan ($25/month). Capabilities are limited to resize (width/height), quality adjustment (20–100), resize modes (cover/contain/fill), and auto-WebP conversion. Transforms are URL-parameter-based and cached by Supabase's Smart CDN. Pricing is **$5 per 1,000 origin images transformed** per billing cycle, with subsequent CDN-cached requests free. This handles thumbnails and responsive sizing without additional infrastructure.

For AI-powered enhancement of poor-quality kitchen photos, **Cloudinary** offers `e_improve`, `e_auto_brightness`, `e_fill_light` (lifts shadows without overexposing highlights), and the VIESUS add-on for full auto-correction. The free tier provides **25 credits/month** (1 credit ≈ 1,000 transformations or 1GB bandwidth). At scale, self-hosting **imgproxy** (the same engine Supabase uses internally) in a Docker container eliminates per-image costs entirely—imgproxy benchmarks at **2× faster than Thumbor** for JPEG/WebP processing.

**Recommended phased approach:**

- **Phase 1 (MVP):** `expo-image-picker` → `expo-image-manipulator` → Supabase Storage → built-in transforms for thumbnails
- **Phase 2:** Add sharp processing in Next.js API routes for watermarks, enhancement, and normalization
- **Phase 3:** Cloudinary free tier for AI auto-enhancement, or self-host imgproxy for full control at zero marginal cost

### Supabase Storage configuration

Organize buckets by access pattern and content type. Use private buckets with RLS policies for HACCP compliance photos and training documents, and public buckets for avatars and generated training illustrations. File paths should follow `{workspace_id}/{category}/{YYYY-MM}/{uuid}.{ext}` for clean multi-tenant isolation. Supabase Storage supports the **TUS protocol** for resumable uploads—critical for reliability on flaky mobile connections in restaurant environments.

```typescript
// Custom Next.js image loader for Supabase Storage transforms
export default function supabaseLoader({ src, width, quality }) {
  return `https://${PROJECT_ID}.supabase.co/storage/v1/render/image/public/${src}?width=${width}&quality=${quality || 75}`;
}
```

---

## AI image generation costs $10–20/month for 500 training illustrations

For the Training & Education module, AI-generated instructional illustrations replace expensive custom artwork. The API landscape has evolved beyond DALL-E 3, and newer models offer better price-performance ratios.

**OpenAI GPT Image 1 Mini (Medium quality)** at **$0.02/image** (1024×1024) is the best value for instructional illustrations. It produces clear, professional diagrams with strong prompt adherence—essential for step-by-step procedures. DALL-E 3 Standard at $0.04/image serves as a higher-quality fallback. For rapid prototyping and iteration, **Replicate's FLUX Schnell** at $0.003/image is remarkably cheap.

| Provider / Model                 | Per image | 500 images/month | Best for                     |
| -------------------------------- | --------- | ---------------- | ---------------------------- |
| OpenAI GPT Image 1 Mini (Medium) | $0.020    | $10              | Production instructional art |
| OpenAI DALL-E 3 Standard         | $0.040    | $20              | Higher-quality illustrations |
| Google Imagen 4 Fast             | $0.020    | $10              | Photorealistic environments  |
| Stability Image Core             | $0.030    | $15              | Style variety                |
| Replicate FLUX Schnell           | $0.003    | $1.50            | Rapid prototyping            |
| Replicate FLUX 1.1 Pro           | $0.040    | $20              | High-quality open-source     |

Regarding "Google Banana"—this is the internal codename for **Gemini's consumer-facing image generation** (specifically "Nano Banana" for Gemini 2.5 Flash). There is no separate "Google Banana API." For production use, the correct service is **Vertex AI Imagen** (Imagen 3 GA, Imagen 4 in preview).

### Edge Function integration pattern

Image generation calls work well from Supabase Edge Functions despite the Deno runtime constraints. The **CPU time limit** (reported as 200ms of actual CPU cycles in current documentation) covers only computation, not async I/O wait time. An OpenAI API call that takes 10–30 seconds of wall-clock time consumes minimal CPU time since it's an HTTP request waiting on I/O, well within the **150-second request idle timeout**.

The recommended pattern is **cache-first**: construct a deterministic storage path from input parameters (e.g., `training/{moduleId}/step-{stepNumber}.png`), check if the image already exists in Supabase Storage, and only generate on cache miss. Store metadata in PostgreSQL including prompt, model, cost, and a SHA-256 prompt hash for deduplication.

```sql
CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  model TEXT NOT NULL,
  quality TEXT,
  size TEXT,
  module_id UUID REFERENCES training_modules(id),
  step_number INTEGER,
  cost_usd DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  prompt_hash TEXT GENERATED ALWAYS AS (encode(digest(prompt, 'sha256'), 'hex')) STORED
);
```

### Prompt engineering for restaurant training content

Consistency across a training module requires a **standardized style prompt** stored in the database and prepended to every generation request. Effective instructional prompts specify the visual style ("clean flat-design vector illustration with thick outlines"), the action being demonstrated with precise detail, the perspective ("3/4 view", "overhead for layouts"), and explicit exclusions ("no text overlays, no photorealistic faces"). Always prefix with "Professional instructional illustration for restaurant employee training" to anchor OpenAI's content filters toward workplace-appropriate output.

**OpenAI's strict content policy is an advantage here**—it ensures all generated images are automatically workplace-safe, eliminating the need for a separate moderation layer for most use cases. The `revised_prompt` field returned by DALL-E 3 shows how OpenAI modified the prompt for safety, which should be logged for audit purposes.

---

## Translation architecture: next-intl for web, react-i18next for mobile, Google for dynamic content

The multilingual challenge has two distinct layers: static UI strings and dynamic content translation. Each requires a different technical approach.

### Static UI translation requires two libraries, one set of JSON files

**`next-i18next` is not compatible with the Next.js App Router.** This is the single most important fact in the i18n space for this stack. Use **`next-intl`** instead—it was built from the ground up for App Router with native Server Components support via `getTranslations()`, ~2KB bundle size, excellent TypeScript autocompletion, and **931,000+ weekly npm downloads**. For React Native, use **`i18next` + `react-i18next`** with `expo-localization` for device locale detection.

Both libraries consume JSON translation files, enabling a **shared `packages/i18n` package** in the pnpm monorepo:

```
packages/
  i18n/
    locales/
      nb/common.json     # Norwegian Bokmål (primary)
      en/common.json     # English
      sv/common.json     # Swedish
      da/common.json     # Danish
      fi/common.json     # Finnish
      pl/common.json     # Polish
      ar/common.json     # Arabic (RTL)
      so/common.json     # Somali
    index.ts             # Exports resources, locale config, RTL detection
apps/
  web/                   # Imports from @repo/i18n, wires into next-intl
  mobile/                # Imports from @repo/i18n, wires into react-i18next
```

**Prioritize Bokmål (`nb`) as the primary Norwegian locale.** Nynorsk is used by only ~5–10% of Norwegians (and just 1.2% of translation projects target it). Nynorsk readers understand Bokmål; defer Nynorsk until post-launch. Use locale code `nb` (not the deprecated `no`).

### Dynamic content translation: Google Cloud Translation v3 wins on breadth

For real-time translation of chat messages, policies, and announcements, the key differentiator is **language coverage for immigrant worker languages**—particularly Somali, which DeepL and LibreTranslate do not support.

| Criterion                | Google Cloud v3           | DeepL Pro              | Azure Translator        | OpenAI GPT-4o-mini        |
| ------------------------ | ------------------------- | ---------------------- | ----------------------- | ------------------------- |
| **Price**                | $20/M chars               | $5.49/mo + $25/M chars | $10/M chars             | ~$0.15/M input tokens     |
| **Free tier**            | 500K chars/mo (permanent) | 500K chars/mo          | 2M chars/mo (12 months) | None                      |
| **Somali**               | ✅                        | ❌                     | ✅                      | ✅ (via prompt)           |
| **Nynorsk**              | ✅                        | ❌                     | ✅                      | ✅ (via prompt)           |
| **All Nordic languages** | ✅                        | ✅                     | ✅                      | ✅                        |
| **Quality (Nordic)**     | Very good                 | **Best**               | Very good               | Excellent (context-aware) |
| **Latency**              | 200–500ms                 | 200–400ms              | 200–500ms               | 500–2000ms                |
| **Glossary support**     | ✅                        | ✅                     | ✅ (Custom Translator)  | Via system prompt         |

**Recommended hybrid strategy:** Google Cloud Translation v3 as the primary service (broadest language support, best free tier at 500K chars/month that never expires), with **DeepL** as a premium layer for Nordic-to-Nordic pairs where quality matters most, and **OpenAI GPT-4o-mini** selectively for policy documents and formal announcements where tone and context awareness justify the higher latency.

### Translate-on-receive with caching is the optimal architecture

The **hybrid translate-on-receive** approach stores only the original message in the `messages` table. When a reader with a different preferred language opens a message, a Supabase Edge Function checks the `message_translations` cache table first. On cache miss, it calls the translation API, stores the result, and returns it. Subsequent readers in the same language hit the cache.

This approach avoids pre-translating into all supported languages (wasteful if some languages have few speakers) while ensuring each translation is computed at most once. With the `translation_cache` table keyed on `(workspace_id, source_text_hash, source_language, target_language)`, common hospitality phrases like greetings and standard safety terms get translated once and reused across the entire workspace.

**Cost with aggressive caching (70–80% hit rate):** At 100 active users, expect **~$80–160/month** on Google Cloud Translation instead of $300–600 without caching. Pre-translating the top 500 hospitality phrases (allergens, safety terms, common instructions) in all supported languages dramatically reduces API calls for the most frequent content.

### Arabic RTL support must be implemented from the start

Retrofitting RTL layout is significantly harder than building it in from day one. In Next.js, set `dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'}` on the `<html>` tag. Use **CSS logical properties** throughout: `margin-inline-start` instead of `margin-left`, `padding-inline-end` instead of `padding-right`, `text-align: start` instead of `text-align: left`. In React Native, use `I18nManager.forceRTL()` with an app restart via `expo-updates`, and style with `paddingStart`/`paddingEnd` instead of directional properties. `flexDirection: 'row'` automatically reverses in RTL mode.

---

## RLS scales to millions of rows if you index correctly and optimize policies

Row Level Security is the foundation of multi-tenant isolation, but it introduces query overhead that can become severe without proper optimization. The critical insight: **RLS policies execute per-row during query planning**, meaning a missing index on `workspace_id` can cause full sequential scans that balloon query time by **100× or more** on tables with 100K+ rows.

### Five essential RLS optimizations

**First**, always create a B-tree index on `workspace_id` and composite indexes for common query patterns: `CREATE INDEX idx_table_workspace_created ON table (workspace_id, created_at DESC)`. Index every column referenced in any RLS policy—missing indexes are the number one RLS performance killer.

**Second**, wrap `auth.uid()` and `auth.jwt()` calls in a subselect: `(SELECT auth.uid()) = user_id` instead of `auth.uid() = user_id`. This triggers a Postgres initPlan that caches the function result per-statement rather than evaluating it per-row.

**Third**, structure policies to avoid correlated subqueries. Instead of checking membership per-row, invert the query: `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))`.

**Fourth**, store `workspace_id` in JWT custom claims via Supabase Auth hooks. The policy then becomes `workspace_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid`—a simple equality check against an indexed column with zero subquery overhead.

**Fifth**, create separate policies per operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) rather than using `FOR ALL`, and always specify `TO authenticated` to prevent anonymous users from triggering expensive policy evaluation.

### Supabase Edge Functions handle punch-in spikes

Edge Functions on Pro plan include **2M invocations/month** ($2 per additional 1M). Cold starts run ~400ms median, with warm requests at ~125ms. The CPU time limit per request is **200ms of actual CPU cycles** (not wall-clock time), with a 150-second request idle timeout for I/O-bound operations. For the "hundreds of punch-ins at 7AM" scenario, Edge Functions work if each punch-in is a short, idempotent operation. For truly high-throughput batch operations, use a **Postgres trigger** or **database function** instead of individual Edge Function calls—this eliminates HTTP overhead entirely.

### Realtime connection management

Supabase Realtime provides **500 concurrent WebSocket connections** on Pro, scaling to **10,000 on Team** ($599/month). Each connection supports up to 100 channels. The critical optimization: **use Broadcast for high-frequency ephemeral events** (typing indicators, live status) and reserve **Postgres Changes** subscriptions for actual database mutations that users need to see. Postgres Changes are processed on a single thread regardless of compute size—they're the bottleneck at scale. Always filter subscriptions with `.eq('workspace_id', currentWorkspaceId)` to receive only relevant data.

Use one channel per workspace rather than one per table. This reduces total channel count and simplifies subscription management. For tables with very high write frequency that trigger Realtime events, consider a separate "events" table without RLS that uses workspace_id filtering at the subscription level instead.

---

## Cost model: $70/month at launch, breakeven under 10 workspaces

The total infrastructure cost scales predictably across growth phases. At Norwegian SaaS pricing (typically 500–2,000 NOK/workspace/month, roughly $50–200 USD), the business breaks even at fewer than 10 workspaces in every scenario.

### Launch phase (1–10 workspaces, ~$70/month)

| Service                  | Plan                   | Monthly cost |
| ------------------------ | ---------------------- | ------------ |
| Supabase                 | Pro + Micro compute    | $25          |
| Vercel                   | Pro (1 seat)           | $20          |
| Expo / EAS               | Starter                | $19          |
| Sentry                   | Free (5K events)       | $0           |
| Google Cloud Translation | Free tier (500K chars) | $0           |
| Domain + SSL             | Amortized annual       | $2           |
| **Total**                |                        | **~$66**     |

### Growth phase (100 workspaces / ~2,000 MAUs, ~$400/month)

At 100 workspaces, upgrade Supabase compute to **Large ($110/month)** for dedicated CPU and predictable latency. Move Expo to Production plan ($199/month) for 50,000 update MAUs. Translation costs emerge at $10–25/month with caching. AI image generation adds $20–50/month. Sentry Team at $26/month provides proper error tracking for production.

### Scale phase (1,000 workspaces / ~15,000 MAUs, ~$1,100/month)

At 1,000 workspaces, add a **Supabase Read Replica** ($210/month on XL) to isolate analytics queries from production traffic. Translation costs reach $50–100/month. The dominant cost drivers at this scale are Supabase compute ($420 for primary + replica), Expo ($250–350 with update overage), and Auth MAU overage at **$3.25 per 1,000 MAUs**—monitor this metric closely as it's the most aggressive cost scaler.

### When to upgrade Supabase plans

The **Free → Pro** ($25/month) upgrade is immediate for any production app—free plan pauses projects after 7 days of inactivity and has no backups. **Pro → Team** ($599/month) is a compliance-driven upgrade: SSO, SOC 2 reports, audit logs, and priority support. It's not needed for resource scaling. **Add compute upgrades** and read replicas on Pro before considering Team unless customers require compliance features. Consider the **Large compute add-on** ($110/month) as the minimum for production—shared instances (Micro through Medium) suffer noisy-neighbor performance variance.

---

## Monitoring from day one: free tools that actually matter

A solo builder needs signal without noise. Set up four free tools at launch.

**Sentry** (free tier: 5,000 events/month) provides error tracking and performance monitoring for both Next.js and React Native with first-class Expo integration. Source maps upload automatically with EAS Build. The `@sentry/react-native` package works in managed Expo workflow.

**Supabase Dashboard** includes built-in CPU, memory, disk I/O, connection count, and cache hit ratio monitoring. The **Performance Advisor** auto-detects missing indexes on columns used in queries and RLS policies. The **Security Advisor** flags suboptimal RLS configurations. Use `.explain()` on Supabase client queries during development to catch performance issues before production.

**Vercel Analytics** tracks Web Vitals, serverless function invocations, and bandwidth consumption. **BetterStack** (free tier) monitors uptime with Slack/email alerts.

Pipe all alerts into a single Slack channel. At growth phase, add Sentry Team ($26/month) for better error grouping and performance baselines. At scale, consider `supabase-grafana` (open-source Docker dashboard) for deep Postgres metrics and Grafana Cloud free tier for centralized observability.

---

## Conclusion

The architecture's key decisions are driven by two constraints: solo builder efficiency and Norwegian market specifics. **Process images client-side before upload** (bandwidth matters in Norwegian rural areas), **use Next.js API routes instead of Edge Functions for sharp** (native library restriction), and **start with Google Cloud Translation** (only major API supporting both Nynorsk and Somali). The next-intl vs next-i18next decision is settled—next-i18next simply doesn't work with App Router.

The most underappreciated optimization across all four areas is **caching**: translation cache reduces API costs by 70–80%, image generation cache with deterministic storage paths eliminates redundant generation, and Supabase Storage's Smart CDN handles image transform caching automatically. For RLS performance, storing `workspace_id` in JWT claims and wrapping `auth.uid()` in subselects transforms multi-tenant query performance from problematic to negligible overhead.

At Norwegian HoReCa SaaS pricing, infrastructure costs are easily covered by fewer than 10 paying workspaces at any growth phase—the technical architecture is not the scaling bottleneck. Focus engineering time on the product, not premature infrastructure optimization.
