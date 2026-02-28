import type { NextConfig } from "next";
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
