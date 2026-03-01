# Smartout Infrastructure

Unified Docker Compose stack for all Smartout backend services.

## Services

| Service          | Port   | Domain                   | Description            |
| ---------------- | ------ | ------------------------ | ---------------------- |
| caddy            | 80/443 | \*.smartout.ai           | HTTPS reverse proxy    |
| stage-engine     | 3000   | engine.smartout.ai       | AI agent orchestration |
| shift-mcp        | 3001   | schedule-mcp.smartout.ai | Shift management MCP   |
| contract-service | 3100   | contract.smartout.ai     | DocuSeal e-signatures  |
| scrapling        | 8000   | (internal)               | Web scraping           |

## Local Development

```bash
# 1. Copy env and fill in values
cp .env.example .env

# 2. Start all services (auto-applies override for dev)
cd infra
docker compose up --build

# 3. Services available at:
#    Stage Engine:      http://localhost:3070
#    Shift MCP:         http://localhost:3071
#    Contract Service:  http://localhost:3072
#    Scrapling:         http://localhost:3073 (also direct at :8000)
```

## Production

```bash
# Use production overlay (no dev overrides)
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Adding a New Service

1. Create `Dockerfile` in `services/<name>/`
2. Add service block to `infra/docker-compose.yml`
3. Add Caddy route in `infra/Caddyfile` (if externally facing)
4. Add env vars to `infra/.env.example`
5. Create DNS A record for subdomain

See ADR-0035 for full details.
