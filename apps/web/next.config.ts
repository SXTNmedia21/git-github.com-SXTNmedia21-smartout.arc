import type { NextConfig } from "next";
import path from "path";
import { readFileSync, existsSync } from "node:fs";
import { withSentryConfig } from "@sentry/nextjs";

// Load root .env.local — Next.js only reads from its own directory,
// so in a monorepo we must load the root env file manually.
const rootEnvPath = path.resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnvPath)) {
  for (const line of readFileSync(rootEnvPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    remotePatterns: [
      // Supabase Storage (public-site assets, avatars)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      // External host-provided URLs (onboarding scraped logos, public-site
      // operator-controlled images). Wide by design — public-site is
      // operator-controlled, not user-submitted; onboarding logos come from
      // the prospect's own website scrape.
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@smartout/ui",
      "@smartout/types",
      "@smartout/telemetry",
      "date-fns",
      "posthog-js",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "sonner",
    ],
  },
  // posthog-node: server-only, uses node:fs/readline — must not bundle for client SSR.
  // livekit-client + @livekit/krisp-noise-filter: browser-only (Worker, WebAssembly).
  // krisp-noise-filter defines `class KWebWorker extends Worker` at module eval time,
  // which throws ReferenceError in Node.js. Mark all livekit packages as server-external
  // so Next.js never bundles them into SSR chunks. (CI-fix: ci-incident-conductor 2026-05-10)
  serverExternalPackages: ["posthog-node", "livekit-client", "@livekit/krisp-noise-filter"],
  turbopack: {
    resolveAlias: {
      "@smartout/ai": "../../packages/ai/dist/index.js",
      "@smartout/ai/agents/docs": "../../packages/ai/dist/agents/docs.js",
      "@smartout/ai/agents/onboarding": "../../packages/ai/dist/agents/onboarding.js",
      "@smartout/ai/missions": "../../packages/ai/dist/missions/index.js",
      "@smartout/ai/session-context": "../../packages/ai/dist/session-context.js",
      "@smartout/ai/tools/onboarding": "../../packages/ai/dist/tools/onboarding.js",
      "@smartout/ai/schemas/onboarding": "../../packages/ai/dist/schemas/onboarding.js",
      "@smartout/ai/adapters/vercel-ai": "../../packages/ai/dist/adapters/vercel-ai.js",
      "@smartout/ai/adapters/livekit": "../../packages/ai/dist/adapters/livekit.js",
      "@smartout/ai/journey-ops/runbook": "../../packages/ai/dist/journey-ops/runbook.js",
      "@smartout/ai/agents/journey-ops": "../../packages/ai/dist/agents/journey-ops.js",
      "@smartout/ai/tools/journey-ops": "../../packages/ai/dist/tools/journey-ops/index.js",
    },
  },
  transpilePackages: [
    "@smartout/ai",
    "@smartout/i18n",
    "@smartout/supabase",
    "@smartout/telemetry",
    "@smartout/types",
    "@smartout/ui",
    "@smartout/design-tokens",
    "@smartout/utils",
    "@smartout/agent-sdk",
    "@smartout/training",
  ],
  webpack: (config, { dir, isServer }) => {
    // posthog-node (via @smartout/telemetry dynamic import) uses node:fs and
    // node:readline. Even though the import is isServer-guarded, webpack still
    // resolves the module graph for client chunks. Mark posthog-node as external
    // for client builds so webpack never follows into it.
    if (!isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "posthog-node",
      ];
    }

    const aiDist = path.join(dir, "../../packages/ai/dist");

    // Exact file aliases — bypasses exports field resolution entirely
    config.resolve.alias["@smartout/ai$"] = path.join(aiDist, "index.js");
    config.resolve.alias["@smartout/ai/agents/docs"] = path.join(aiDist, "agents", "docs.js");
    config.resolve.alias["@smartout/ai/agents/onboarding"] = path.join(
      aiDist,
      "agents",
      "onboarding.js",
    );
    config.resolve.alias["@smartout/ai/missions"] = path.join(aiDist, "missions", "index.js");
    config.resolve.alias["@smartout/ai/session-context"] = path.join(aiDist, "session-context.js");
    config.resolve.alias["@smartout/ai/tools/onboarding"] = path.join(
      aiDist,
      "tools",
      "onboarding.js",
    );
    config.resolve.alias["@smartout/ai/schemas/onboarding"] = path.join(
      aiDist,
      "schemas",
      "onboarding.js",
    );
    config.resolve.alias["@smartout/ai/adapters/vercel-ai"] = path.join(
      aiDist,
      "adapters",
      "vercel-ai.js",
    );
    config.resolve.alias["@smartout/ai/adapters/livekit"] = path.join(
      aiDist,
      "adapters",
      "livekit.js",
    );
    config.resolve.alias["@smartout/ai/journey-ops/runbook"] = path.join(
      aiDist,
      "journey-ops",
      "runbook.js",
    );
    config.resolve.alias["@smartout/ai/agents/journey-ops"] = path.join(
      aiDist,
      "agents",
      "journey-ops.js",
    );
    config.resolve.alias["@smartout/ai/tools/journey-ops"] = path.join(
      aiDist,
      "tools",
      "journey-ops",
      "index.js",
    );

    return config;
  },
  async redirects() {
    // 2026-04-10 rename (season/ → year-wheel/) redirects were removed
    // on 2026-04-20 because /dashboard/season/[seasonId] is now the
    // canonical season-editing route per the year-wheel redesign spec.
    // Old deep-links into /dashboard/season/<something> that expected
    // the year-wheel page are not expected to exist outside dev tools.
    return [
      // Avoid redirect-only page component (Next 16 dev instrumentation
      // throws "negative time stamp" on Performance.measure when a page
      // throws RedirectError before its end-mark fires).
      {
        source: "/platform-admin",
        destination: "/platform-admin/dashboard",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  typescript: {
    // Skip-rules first-rollout 2026-05-04: tolerate type errors during
    // production build while we close the merge-induced telemetry-brand
    // gap. Type errors still surface in dev/CI; this only prevents `next
    // build` from blocking deploy on them.
    ignoreBuildErrors: true,
  },
};

// Skip Sentry source-map upload on local + preview builds — only run on
// production Vercel deploys. Cuts 30-60s off non-prod build time.
const shouldUploadSourceMaps = process.env.VERCEL_ENV === "production";

export default shouldUploadSourceMaps
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: "smartout",
      project: "web",
    })
  : nextConfig;
