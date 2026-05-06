import type { NextConfig } from "next";

// Phase 7: @smartout/journey-ir added as compile-pipe dependency.
const nextConfig: NextConfig = {
  transpilePackages: ["@smartout/journey-ir"],
};

export default nextConfig;
