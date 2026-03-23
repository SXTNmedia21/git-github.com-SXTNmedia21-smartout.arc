/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@smartout/supabase/database\\.types$":
      "<rootDir>/../../packages/supabase/src/database.types.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // Disable type-checking in tests — tsconfig paths don't resolve in jest.
        // Typecheck runs separately via `pnpm typecheck`.
        diagnostics: false,
        tsconfig: {
          moduleResolution: "node",
          jsx: "react-jsx",
          esModuleInterop: true,
          allowJs: true,
        },
      },
    ],
  },
};
