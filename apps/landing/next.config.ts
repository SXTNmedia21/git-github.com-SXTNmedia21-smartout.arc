import type { NextConfig } from "next";
import path from "path";

// This will force validation of the .env on start/build
import "./src/env";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@smartout/supabase",
    "@smartout/telemetry",
    "@smartout/types",
    "@smartout/design-tokens",
  ],
  webpack: (config, { dir }) => {
    // Map @smartout/ai imports to pre-built dist/ output.
    // Needed because pnpm workspace symlinks + exports field
    // don't resolve reliably on Vercel's build environment.
    config.resolve.alias["@smartout/ai"] = path.join(dir, "../../packages/ai/dist");
    return config;
  },
};

export default nextConfig;
