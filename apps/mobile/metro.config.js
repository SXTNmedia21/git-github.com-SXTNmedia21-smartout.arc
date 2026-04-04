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

// Watch the entire monorepo so shared packages resolve
config.watchFolders = [monorepoRoot];

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
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName in webAliases) {
    return {
      type: "sourceFile",
      filePath: webAliases[moduleName],
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
