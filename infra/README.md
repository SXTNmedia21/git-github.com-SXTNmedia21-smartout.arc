# Smartout Infrastructure

Unified Docker Compose stack for all Smartout backend services.
See [ADR-0040](../docs/decisions/0040-infrastructure-in-monorepo.md) for the decision to keep infrastructure in the monorepo.

## Services

| Service          | Port   | Domain                   | Description            | Status       |
| ---------------- | ------ | ------------------------ | ---------------------- | ------------ |
| caddy            | 80/443 | \*.smartout.ai           | HTTPS reverse proxy    | Active       |
| stage-engine     | 3000   | engine.smartout.ai       | AI agent orchestration | Active       |
| shift-mcp        | 3001   | schedule-mcp.smartout.ai | Shift management MCP   | Active       |
| contract-service | 3100   | contract.smartout.ai     | DocuSeal e-signatures  | Active       |
| scrapling        | 8000   | (internal)               | Web scraping           | Active       |
| n8n              | 5678   | n8n.smartout.ai          | Workflow automation    | Not deployed |

## First-Time Setup

```bash
# Run the setup script (checks Docker, creates .env)
./infra/scripts/setup.sh

# Edit .env with your values
nano infra/.env
```

## Local Development

```bash
# Start all services (auto-applies override for dev)
cd infra
docker compose up --build

# Services available at:
#    Stage Engine:      http://localhost:3070
#    Shift MCP:         http://localhost:3071
#    Contract Service:  http://localhost:3072
#    Scrapling:         http://localhost:3073
#    n8n:               http://localhost:3074 (also direct at :5678)
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

| Script                    | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `scripts/setup.sh`        | First-time setup: check Docker, create .env |
| `scripts/deploy.sh`       | Pull code, rebuild, restart, health check   |
| `scripts/health-check.sh` | Ping all service health endpoints           |
| `scripts/backup.sh`       | Backup n8n data and Caddy certificates      |

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
