# Smartout Infrastructure

Unified Docker Compose stack for all Smartout backend services.
See [ADR-0040](../docs/decisions/0040-infrastructure-in-monorepo.md) for the decision to keep infrastructure in the monorepo.

## Services

| Service          | Port   | Domain                   | Description            | Status       |
| ---------------- | ------ | ------------------------ | ---------------------- | ------------ |
| caddy            | 80/443 | \*.smartout.ai           | HTTPS reverse proxy    | Active       |
| stage-engine     | 5010   | engine.smartout.ai       | AI agent orchestration | Active       |
| shift-mcp        | 5011   | schedule-mcp.smartout.ai | Shift management MCP   | Active       |
| contract-service | 5012   | contract.smartout.ai     | DocuSeal e-signatures  | Active       |
| scrapling        | 8000   | (internal)               | Web scraping           | Active       |
| n8n              | 5678   | n8n.smartout.ai          | Workflow automation    | Not deployed |

## First-Time Setup

```bash
# Run the setup script (checks Docker, creates .env)
./infra/scripts/setup.sh

# Edit .env with your values
nano infra/.env
```

## Compose Override — Important Trap (SMA-302)

Docker Compose auto-loads `docker-compose.override.yml` **only when no `-f` flag is given**.
A single explicit `-f infra/docker-compose.yml` silently bypasses the override.

The override rewrites `SUPABASE_URL` and `DATABASE_URL` from `http://127.0.0.1:54321`
(container loopback, unreachable from inside a container) to `http://host.docker.internal:54321`
(the host machine's Supabase instance). Without it, `auth.getUser()` returns
`AUTH_FAILED Invalid or expired JWT` even with a valid token.

**Valid invocation patterns:**

```bash
# Pattern A — No -f flag (compose auto-loads both files from the infra/ dir)
cd infra && docker compose up -d

# Pattern B — Both -f flags explicit (safe from any working directory)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up -d
```

**Never use a single `-f` without the override:**

```bash
# BAD — override silently dropped, SUPABASE_URL falls through to 127.0.0.1 loopback
docker compose -f infra/docker-compose.yml up -d
```

Verify the override is active after startup:

```bash
docker exec infra-stage-engine-1 sh -c 'echo $SUPABASE_URL'
# Should print: http://host.docker.internal:54321
```

## Local Development

```bash
# Secure startup (prompts 1Password login if needed, validates envs, starts services)
pnpm infra:start

# Start all services (auto-applies override for dev)
cd infra
docker compose up --build

# Services available at (direct ports from override):
#    Stage Engine:      http://localhost:5010
#    Shift MCP:         http://localhost:5011
#    Contract Service:  http://localhost:5012
#    Scrapling:         http://localhost:8000
#    n8n:               http://localhost:5678
```

## Production

```bash
# Deploy (pull, build, restart, health check)
./infra/scripts/deploy.sh

# Or manually:
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Scripts

| Script                    | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `scripts/setup.sh`        | First-time setup: check Docker, create .env  |
| `scripts/deploy.sh`       | Pull code, rebuild, restart, health check    |
| `scripts/health-check.sh` | Ping all service health endpoints            |
| `scripts/backup.sh`       | Backup n8n data and Caddy certificates       |
| `scripts/backup-cron.sh`  | Cron wrapper: logs output, keeps last 7 days |

## Automated Backups

Install the daily backup cron job (runs at 3:00 AM):

```bash
crontab -e
# Add this line:
0 3 * * * /path/to/smartout.ai/infra/scripts/backup-cron.sh
```

Backups are saved to `~/backups/smartout/YYYY-MM-DD_HHMM/`. The cron wrapper keeps the last 7 days and logs to `~/backups/smartout/logs/`.

## Adding a New Service

1. Create `Dockerfile` in `services/<name>/`
2. Add service block to `infra/docker-compose.yml`
3. Add dev overrides to `infra/docker-compose.override.yml`
4. Add prod overrides to `infra/docker-compose.prod.yml`
5. Add Caddy route in `infra/Caddyfile` and `infra/Caddyfile.dev` (if externally facing)
6. Add env vars to `infra/.env.example`
7. Add health check to `infra/scripts/health-check.sh`
8. Create DNS A record for subdomain

See [ADR-0040](../docs/decisions/0040-infrastructure-in-monorepo.md) for full details.
