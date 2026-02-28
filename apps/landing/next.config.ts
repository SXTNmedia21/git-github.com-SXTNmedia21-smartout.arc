import type { NextConfig } from "next";

// This will force validation of the .env on start/build
import "./src/env";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@smartout/supabase",
    "@smartout/telemetry",
    "@smartout/types",
    "@smartout/design-tokens",
  ],
};

export default nextConfig;
