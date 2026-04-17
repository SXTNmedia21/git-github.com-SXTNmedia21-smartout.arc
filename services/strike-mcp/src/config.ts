import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Service root = parent of src/. Used as the fallback base for mappings/,
// supabase/, and other strike-mcp-local paths when env vars aren't set.
// Integrated into smartout.ai monorepo 2026-04-17 — previously hardcoded to
// ~/dev/strike-mcp/, now resolves to services/strike-mcp/ regardless of
// where the monorepo lives.
const SERVICE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Config {
  bubbleAppUrl: string;
  bubbleApiToken: string;
  mappingsDir: string;
  vaultBubbleShapesDir: string;
  stagingDir: string;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const rawUrl = env.BUBBLE_APP_URL;
  const token = env.BUBBLE_API_TOKEN;

  if (!rawUrl || rawUrl.trim() === "") {
    throw new ConfigError("BUBBLE_APP_URL environment variable is required");
  }
  if (!token || token.trim() === "") {
    throw new ConfigError("BUBBLE_API_TOKEN environment variable is required");
  }
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    throw new ConfigError("BUBBLE_APP_URL must start with http:// or https://");
  }

  const bubbleAppUrl = rawUrl.replace(/\/+$/, "");
  const mappingsDir =
    env.STRIKE_MAPPINGS_DIR ?? join(SERVICE_ROOT, "mappings");
  const vaultBubbleShapesDir =
    env.STRIKE_VAULT_SHAPES_DIR ??
    // Vault is a user-owned second-brain path; still absolute if the user
    // keeps it. Override via STRIKE_VAULT_SHAPES_DIR for other installs.
    `${process.env.HOME ?? "/home/sxtnl"}/dev/second-brain-v2/wiki/migration/bubble-shapes`;
  const stagingDir =
    env.STRIKE_STAGING_DIR ??
    join(SERVICE_ROOT, "supabase", "migration-staging");
  const supabaseUrl = env.SUPABASE_URL ?? null;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? null;
  return {
    bubbleAppUrl,
    bubbleApiToken: token,
    mappingsDir,
    vaultBubbleShapesDir,
    stagingDir,
    supabaseUrl,
    supabaseAnonKey,
  };
}
