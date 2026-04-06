/**
 * Metro configuration for Smartout mobile app.
 * Configures monorepo support so Metro can resolve packages/* and apps/* imports.
 *
 * Web platform: native-only packages are aliased to lightweight fallback modules
 * in src/platform/. This lets the same source code build for both native and web
 * without touching import statements across 89+ files.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so shared packages resolve (keep Expo defaults)
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// Resolve node_modules from both project and monorepo root (hoisted deps)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

/**
 * Web platform aliases — redirect native-only packages to fallback modules.
 * These files live in src/platform/ and provide web-compatible implementations
 * (no-ops for haptics, CSS drawers for bottom sheets, stubs for SQLite).
 */
const webAliases = {
  "expo-haptics": path.resolve(projectRoot, "src/platform/haptics.web.ts"),
  "@gorhom/bottom-sheet": path.resolve(projectRoot, "src/platform/bottom-sheet.web.tsx"),
  "expo-sqlite": path.resolve(projectRoot, "src/platform/sqlite.web.ts"),
  "expo-image-picker": path.resolve(projectRoot, "src/platform/image-picker.web.ts"),
  "react-native-mmkv": path.resolve(projectRoot, "src/platform/mmkv.web.ts"),
  "@smartout/walkie-talkie": path.resolve(projectRoot, "src/platform/walkie-talkie.web.ts"),
};

// Stub Node.js built-ins that server-only packages (ws, posthog-node) import.
// React Native provides its own WebSocket/fetch — these are never called at
// runtime, but Metro still resolves them during bundling.
const emptyModule = require.resolve("./src/lib/empty-module.js");

const nodeBuiltins = [
  "assert", "buffer", "child_process", "cluster", "crypto", "dgram", "dns",
  "events", "fs", "http", "http2", "https", "net", "os", "path", "perf_hooks",
  "querystring", "readline", "stream", "string_decoder", "tls", "tty", "url",
  "util", "v8", "vm", "worker_threads", "zlib",
];

const extraNodeModules = { stream: require.resolve("readable-stream") };
for (const mod of nodeBuiltins) {
  if (mod !== "stream") extraNodeModules[mod] = emptyModule;
}
config.resolver.extraNodeModules = extraNodeModules;

// Combined resolve: web aliases + node: protocol stubs + default fallback
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Web platform: redirect native-only packages to web fallbacks
  if (platform === "web" && moduleName in webAliases) {
    return {
      type: "sourceFile",
      filePath: webAliases[moduleName],
    };
  }
  // Handle "node:" protocol imports (e.g. "node:fs" from posthog-node)
  if (moduleName.startsWith("node:")) {
    const stripped = moduleName.slice(5);
    const stub = extraNodeModules[stripped] || emptyModule;
    return { type: "sourceFile", filePath: stub };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
