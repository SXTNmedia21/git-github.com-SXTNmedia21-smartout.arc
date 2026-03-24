import { defineConfig, globalIgnores } from "eslint/config";
import config from "@smartout/eslint-config/next";

export default defineConfig([
  globalIgnores([".next-e2e-landing/**"]),
  ...config,
]);
