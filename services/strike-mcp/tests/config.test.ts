import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config.js";

describe("loadConfig", () => {
  it("returns a valid config when all env vars are present", () => {
    const env = {
      BUBBLE_APP_URL: "https://smartout.bubbleapps.io",
      BUBBLE_API_TOKEN: "secret-token",
    };
    const config = loadConfig(env);
    expect(config.bubbleAppUrl).toBe("https://smartout.bubbleapps.io");
    expect(config.bubbleApiToken).toBe("secret-token");
  });

  it("strips a trailing slash from BUBBLE_APP_URL", () => {
    const env = {
      BUBBLE_APP_URL: "https://smartout.bubbleapps.io/",
      BUBBLE_API_TOKEN: "secret-token",
    };
    const config = loadConfig(env);
    expect(config.bubbleAppUrl).toBe("https://smartout.bubbleapps.io");
  });

  it("throws ConfigError when BUBBLE_APP_URL is missing", () => {
    expect(() => loadConfig({ BUBBLE_API_TOKEN: "x" })).toThrow(ConfigError);
    expect(() => loadConfig({ BUBBLE_API_TOKEN: "x" })).toThrow(/BUBBLE_APP_URL/);
  });

  it("throws ConfigError when BUBBLE_API_TOKEN is missing", () => {
    expect(() => loadConfig({ BUBBLE_APP_URL: "https://x" })).toThrow(ConfigError);
    expect(() => loadConfig({ BUBBLE_APP_URL: "https://x" })).toThrow(/BUBBLE_API_TOKEN/);
  });

  it("throws ConfigError when BUBBLE_APP_URL is not http(s)", () => {
    expect(() =>
      loadConfig({ BUBBLE_APP_URL: "smartout.bubbleapps.io", BUBBLE_API_TOKEN: "x" }),
    ).toThrow(/must start with http/);
  });
});

describe("loadConfig research fields", () => {
  const baseEnv = {
    BUBBLE_APP_URL: "https://smartout.bubbleapps.io",
    BUBBLE_API_TOKEN: "secret-token",
  };

  it("defaults mappingsDir to the strike-mcp mappings path", () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.mappingsDir).toMatch(/services\/strike-mcp\/mappings$/);
  });

  it("defaults vaultBubbleShapesDir to the second-brain bubble-shapes path", () => {
    const config = loadConfig({ ...baseEnv });
    const home = process.env.HOME ?? "/home/sxtnl";
    expect(config.vaultBubbleShapesDir).toBe(
      `${home}/dev/second-brain-v2/wiki/migration/bubble-shapes`,
    );
  });

  it("honours STRIKE_MAPPINGS_DIR override", () => {
    const config = loadConfig({ ...baseEnv, STRIKE_MAPPINGS_DIR: "/tmp/maps" });
    expect(config.mappingsDir).toBe("/tmp/maps");
  });

  it("honours STRIKE_VAULT_SHAPES_DIR override", () => {
    const config = loadConfig({
      ...baseEnv,
      STRIKE_VAULT_SHAPES_DIR: "/tmp/shapes",
    });
    expect(config.vaultBubbleShapesDir).toBe("/tmp/shapes");
  });
});

describe("loadConfig migration fields", () => {
  const baseEnv = {
    BUBBLE_APP_URL: "https://x.bubbleapps.io",
    BUBBLE_API_TOKEN: "t",
  };

  it("defaults stagingDir to repo staging path", () => {
    const config = loadConfig(baseEnv);
    expect(config.stagingDir).toMatch(/migration-staging$/);
  });

  it("respects STRIKE_STAGING_DIR override", () => {
    const config = loadConfig({ ...baseEnv, STRIKE_STAGING_DIR: "/tmp/x" });
    expect(config.stagingDir).toBe("/tmp/x");
  });

  it("supabase fields are null when env vars are missing", () => {
    const config = loadConfig(baseEnv);
    expect(config.supabaseUrl).toBeNull();
    expect(config.supabaseAnonKey).toBeNull();
  });

  it("supabase fields populate from SUPABASE_URL and SUPABASE_ANON_KEY", () => {
    const config = loadConfig({
      ...baseEnv,
      SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_ANON_KEY: "key",
    });
    expect(config.supabaseUrl).toBe("https://abc.supabase.co");
    expect(config.supabaseAnonKey).toBe("key");
  });
});
