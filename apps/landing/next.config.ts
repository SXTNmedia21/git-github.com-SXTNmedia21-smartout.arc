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
  turbopack: {},
  outputFileTracingIncludes: {
    "/docs": ["../../docs/User Manual/**/*.md"],
    "/docs/[slug]": ["../../docs/User Manual/**/*.md"],
    "/en/docs": ["../../docs/User Manual/**/*.md"],
    "/en/docs/[slug]": ["../../docs/User Manual/**/*.md"],
    "/sitemap.xml": ["../../docs/User Manual/**/*.md"],
  },
  experimental: {
    // F-01 (audit 2026-05-15 slice 11): mirror apps/web optimizePackageImports
    // for parity. Packages not imported by landing are a no-op here.
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-icons",
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
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  transpilePackages: [
    "@smartout/ai",
    "@smartout/supabase",
    "@smartout/telemetry",
    "@smartout/types",
    "@smartout/design-tokens",
  ],
  webpack: (config, { dir }) => {
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

    return config;
  },
};

// F-02 (audit 2026-05-15 slice 11): Skip Sentry source-map upload on local +
// preview builds — only run on production Vercel deploys. Mirrors apps/web
// gate (shipped 2026-04-29 Wave 1). Cuts 30-60s off non-prod build time and
// avoids leaking landing source maps from preview environments.
const shouldUploadSourceMaps = process.env.VERCEL_ENV === "production";

export default shouldUploadSourceMaps
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: "smartout",
      project: "landing",
    })
  : nextConfig;
