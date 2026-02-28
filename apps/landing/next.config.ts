import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

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
    const aiDist = path.join(dir, "../../packages/ai/dist");

    // Diagnostics: log filesystem state on Vercel
    const distExists = fs.existsSync(aiDist);
    const docsFile = path.join(aiDist, "agents", "docs.js");
    const docsExists = fs.existsSync(docsFile);
    console.error(`[@smartout/ai] dist=${distExists} docs.js=${docsExists} path=${aiDist}`);
    if (distExists) {
      try {
        console.error(`[@smartout/ai] files=${fs.readdirSync(aiDist).join(",")}`);
      } catch {}
    }

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

export default nextConfig;
