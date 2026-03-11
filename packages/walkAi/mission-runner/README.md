# Stage Engine

Universal, channel-agnostic AI agent gateway for Smartout.

## Quick Start

```bash
# Install
pnpm install

# Dev (requires .env with Supabase + Ultravox credentials)
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build

# Production
pnpm start
```

## Architecture

See `ARCHITECTURE.md` for full system design.

## Endpoints

| Method | Path                           | Purpose                 |
| ------ | ------------------------------ | ----------------------- |
| GET    | /health                        | Health check            |
| POST   | /sessions                      | Start session           |
| GET    | /sessions/:id                  | Get status              |
| POST   | /sessions/:id/store            | Store data              |
| POST   | /sessions/:id/fetch            | Fetch context           |
| POST   | /sessions/:id/advance          | Next stage              |
| POST   | /sessions/:id/abandon          | Abandon                 |
| POST   | /adapters/ultravox/create-call | Create voice call       |
| POST   | /adapters/ultravox/store       | Store (Ultravox format) |
| POST   | /adapters/ultravox/fetch       | Fetch (Ultravox format) |
| POST   | /adapters/ultravox/advance     | Advance (new-stage)     |
