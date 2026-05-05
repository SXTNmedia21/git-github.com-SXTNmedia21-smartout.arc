# Smartout Mobile (`apps/mobile`)

Expo SDK 55 + React Native 0.83. Metro on port `8082` (native) / `8083` (PWA dev).

## Start dev server

Three modes:

| Command                                | What                                          | Port | Output                |
| -------------------------------------- | --------------------------------------------- | ---- | --------------------- |
| `pnpm dev` (or root `pnpm dev:mobile`) | PWA dev — browser, op-run wrapped             | 8083 | http://localhost:8083 |
| `pnpm start`                           | Native Expo (iOS sim / Android sim / Expo Go) | 8082 | Metro QR + dev menu   |
| `pnpm start:clean`                     | Same as `start` but kills stale port first    | 8082 | Metro QR + dev menu   |
| `pnpm web`                             | Same as `dev` but on Expo's default port      | 8081 | http://localhost:8081 |

Root-level convenience: `pnpm dev:mobile` is the canonical PWA start; mirrors
`pnpm dev:web` (3060) and `pnpm dev:landing` (3055).

`start:clean` wraps `scripts/start-clean.sh`, which kills any process
holding `:8082` before spawning Metro. Use it when a previous `expo start`
crashed or was suspended — symptom is `Port 8082 is being used by another
process` followed by Expo exiting silently in non-interactive shells.

Override port: `EXPO_PORT=8090 pnpm start:clean`.

## Metro cache trap

If `expo start` exits silently after `Starting Metro Bundler` with stderr
`Error: Unable to deserialize cloned data due to invalid or unsupported version`,
the file-map cache at `/tmp/metro-file-map-*` is corrupt (Node-version drift
between sessions). Fix:

```bash
rm -rf /tmp/metro-file-map-*
# OR
pnpm dev -- --clear     # passes --clear through to expo start
```

## SDK 55 dep alignment

`expo install --fix` aligns all `expo-*` packages to SDK 55 expected versions.
Re-run after Expo SDK upgrades or when `npx expo-doctor` flags major mismatches.

Known peer-dep noise: `expo install --fix` may downgrade `react`/`react-dom` to
19.2.0 even when root `pnpm.overrides` pin 19.2.4. Doesn't block PWA bundler;
warning lives in `i18n` + `sonner` subtrees.

## Build / verify

```bash
pnpm turbo run typecheck --filter=@smartout/mobile   # builds workspace deps first
pnpm --filter @smartout/mobile lint
pnpm --filter @smartout/mobile build:web              # static web export
```

There is no native build script — use Expo / EAS for iOS + Android.

## Dependencies

Workspace packages: `@smartout/design-tokens`, `@smartout/i18n`,
`@smartout/notifications`, `@smartout/schedule`, `@smartout/shift-clock`,
`@smartout/supabase`, `@smartout/telemetry`, `@smartout/ui`, `@smartout/utils`.
Always typecheck via Turbo so these build first.

## Mobile architecture

Web composes, mobile executes (ADR-0133). Mobile owns D6 production +
C4 acceptance verbs only — no authoring UIs. AI traffic routes through web
BFF (ADR-0132). Telemetry mutations MUST resolve `workspace_id` + `actor_id`
before `emit()` (ADR-0134).
