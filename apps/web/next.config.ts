import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

// This will force validation of the .env on start/build
import "./src/env";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@smartout/supabase",
    "@smartout/telemetry",
    "@smartout/types",
    "@smartout/ui",
    "@smartout/design-tokens",
    "@smartout/utils",
  ],
  webpack: (config, { dir }) => {
    // Map @smartout/ai imports to pre-built dist/ output.
    // Needed because pnpm workspace symlinks + exports field
    // don't resolve reliably on Vercel's build environment.
    config.resolve.alias["@smartout/ai"] = path.join(dir, "../../packages/ai/dist");
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
