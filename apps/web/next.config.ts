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
  serverExternalPackages: ["posthog-node"],
  transpilePackages: [
    "@smartout/ai",
    "@smartout/supabase",
    "@smartout/telemetry",
    "@smartout/types",
    "@smartout/ui",
    "@smartout/design-tokens",
    "@smartout/utils",
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
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "smartout",
  project: "web",
});
