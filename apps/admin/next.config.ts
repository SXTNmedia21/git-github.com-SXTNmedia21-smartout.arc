/**
 * next.config.ts — apps/admin
 *
 * Minimal config modeled on apps/landing (no AI/Botsson/LiveKit).
 * Serves admin.smartout.ai — accountant portal for Erik.
 */
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
  experimental: {
    optimizePackageImports: ["lucide-react"],
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
  transpilePackages: ["@smartout/supabase", "@smartout/types", "@smartout/design-tokens"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "smartout",
  project: "admin",
});
