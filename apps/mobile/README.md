# Smartout Mobile (`apps/mobile`)

Expo SDK 55 + React Native 0.83. Metro on port `8082` by default.

## Start dev server

```bash
pnpm start:clean       # frees stale port, then `expo start`
# or
pnpm start             # plain `expo start` (fails if port busy)
```

`start:clean` wraps `scripts/start-clean.sh`, which kills any process
holding `:8082` before spawning Metro. Use it when a previous `expo start`
crashed or was suspended — symptom is `Port 8082 is being used by another
process` followed by Expo exiting silently in non-interactive shells.

Override port: `EXPO_PORT=8090 pnpm start:clean`.

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
