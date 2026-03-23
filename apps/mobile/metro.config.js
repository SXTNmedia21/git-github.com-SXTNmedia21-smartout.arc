/**
 * Metro configuration for Smartout mobile app.
 * Configures monorepo support so Metro can resolve packages/* and apps/* imports.
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

module.exports = config;
