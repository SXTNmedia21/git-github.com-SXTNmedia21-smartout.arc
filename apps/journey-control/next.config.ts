import type { NextConfig } from "next";

// Minimal config — no external integrations needed at scaffold phase.
// transpilePackages is empty until Phase 4+ adds @smartout/* dependencies.
const nextConfig: NextConfig = {
  transpilePackages: [],
};

export default nextConfig;
