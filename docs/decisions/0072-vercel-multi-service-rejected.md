---
title: "ADR-0072: Vercel multi-service migration — rejected pending platform investigation"
id: ADR-0072
status: accepted
layer: decision
created: 2026-04-07
updated: 2026-04-07
module: infrastructure
tags: [decisions, infrastructure, vercel, droplet, deployment]
---

# ADR-0072: Vercel multi-service migration — rejected pending platform investigation

**Status:** Accepted (rejection of proposed change)
**Date:** 2026-04-07

## Context and Problem Statement

On 2026-04-06 an untracked `vercel.json` appeared at the repo root containing an `experimentalServices` field naming `web` and four backend services (`stage-engine`, `shift-mcp`, `contract-service`, `scrapling`). The file proposed running our droplet-hosted microservices on Vercel Fluid Compute under a single project.

The file had no provenance: no commit, no ADR, no `/start-feature`, no SESSION.md entry, no driver, no plan, no spec. It also relied on `experimentalServices`, a field that does not appear in any current Vercel public documentation (Vercel's documented configuration surfaces are `vercel.json` with `functions`/`crons`/`bunVersion`/`routes`, or the newer `vercel.ts` + `@vercel/config`).

This ADR records the System Council's verdict on whether to commit the file and migrate, delete the file and stay on droplet, or pursue a hybrid path.

## Decision Drivers

- ADR-0040 declares `infra/docker-compose.yml` the canonical source of truth for service topology. Committing `vercel.json` would create a parallel, conflicting source.
- ADR-0071 (Preview Environment Architecture) was stabilized 2026-05-06 around the asymmetry "DigitalOcean services have no preview tier." Service migration would force re-derivation of vault structure, env sync manifest, and the asymmetry rationale.
- The first preview→main release just succeeded (PR #141, 2026-04-06). 5/5 services healthy, 6/6 containers up. Migration immediately after a stabilization milestone is the worst possible timing.
- `experimentalServices` is undocumented. Building production infra on undocumented platform fields violates the Source of Truth Hierarchy.
- Stage Engine has structural Vercel blockers discovered during council review (see Decision Outcome).

## Considered Options

- **A. DELETE** — Remove the untracked `vercel.json`. Status quo. Droplet stays canonical.
- **B. INTEGRATE FULLY** — Commit the file, migrate all services to Vercel Fluid Compute, decommission droplet (or keep only n8n).
- **C. HYBRID** — Migrate stateless Node services to Vercel, keep n8n + scrapling on droplet.

## Decision Outcome

**Chosen option: A — DELETE.**

Council verdict: unanimous (3/3 reviewers). System Steward (chair), Supervisor, System Agent Coordinator. Frontend-designer skipped (not a UI question).

### Why not Option B (full migration)

- **n8n persistent volume** (`n8n_data`) has no Vercel Functions equivalent. n8n cannot move.
- **scrapling network isolation** — currently internal-only on the droplet. The proposed `routePrefix: /_/scrapling` would make it publicly addressable. Security regression.
- Therefore Option B is impossible by construction. It collapses to Option C.

### Why not Option C (hybrid)

Stage Engine has three structural blockers discovered during council review by `system-agent-coordinator`:

1. **WebSocket routes** — `services/stage-engine/src/routes/ws.ts` (`/ws/:sessionId`) and `/guardian/ws` are persistent connections used by the onboarding UI and admin dashboard. Vercel Functions / Fluid Compute do not support arbitrary WebSocket upgrades. Vercel's WS story is via partner services (Ably, Pusher) or SSE.
2. **In-process guardian-bus pub/sub** — `services/stage-engine/src/core/guardian-bus.ts` distributes events across active sessions via in-process EventEmitter. Multiple Fluid Compute warm instances would silently drop cross-instance events. Externalization to Upstash Redis pub/sub or Vercel Queues would be required.
3. **Background loops** — `CLEANUP_INTERVAL_MINUTES=5` (session-manager.ts) and the Calendar Guardian tick. Both need conversion to Vercel Cron Jobs.

shift-mcp is the only clean migration candidate (stateless, request/response, no WS, no background loops). But moving it alone has measurable cost (Fluid Compute cold start variance of 800ms-2.5s vs. droplet's always-warm ~300-500ms) with no operational upside the droplet doesn't already provide. shift-mcp is not a current pain point.

contract-service has a documented webhook risk: DocuSeal HMAC signature verification depends on raw request body. Fluid Compute body parsing semantics under `experimentalServices` are unverified. Migration could silently break webhook signature validation — production billing-adjacent code.

### Why not even commit-then-decide

- `experimentalServices` is undocumented. There is no contract to lean on. The field name itself signals impermanence.
- Committing creates a parallel source of truth in violation of ADR-0040, without a superseding ADR.
- The file bypassed every quality gate this project enforces: ADR review, `/start-feature`, decision log, SESSION.md, council review.
- The cost of "no" today is zero (file is untracked, never deployed). The cost of "yes" is unbounded.

## Rules & Consequences enforced for Agents

- **Good, because:** Preserves the working release. Honors ADR-0040 and ADR-0071. Refuses to build production infrastructure on undocumented platform fields. Forces any future Vercel exploration through proper channels (ADR + spec + plan + council).
- **Bad, because:** Defers a possibly beneficial migration. If `experimentalServices` becomes documented and Stage Engine refactors WebSockets to SSE, the question may reopen.

### Agent Impact

- **Do not commit `vercel.json` to the repo root.** If a future agent generates one, delete it and reference this ADR.
- **Do not introduce `experimentalServices` or other undocumented Vercel fields** without first finding them in Vercel public docs.
- **`apps/mobile/vercel.json` is unaffected** — that file is the legitimate Expo PWA SPA rewrite config, scoped to the mobile app, and is referenced by the Expo PWA spec/plan (`docs/superpowers/specs/2026-04-04-expo-web-pwa-distribution-design.md`, `docs/superpowers/plans/2026-04-04-expo-web-pwa-distribution.md`). Do not delete it.
- **Future Vercel migration path** (if pursued):
  1. State the driver (cost, latency, ops burden) explicitly
  2. `/start-feature` on a feature branch in a worktree
  3. Use `vercel.ts` + `@vercel/config`, never `experimentalServices`
  4. Refactor stage-engine WebSockets to SSE or external transport FIRST
  5. Externalize guardian-bus to Upstash Redis or Vercel Queues
  6. Convert background loops to Vercel Cron
  7. Pilot with shift-mcp (lowest-risk service), measure cold-start impact on real agent tool latency
  8. Validate DocuSeal HMAC verification on Fluid Compute before any contract-service move
  9. Write a new ADR explicitly superseding the relevant ADR-0040 Service Map row
  10. Update ADR-0071 vault routing and env sync manifest to support service preview tier
  11. Document a rollback plan to droplet that can execute in minutes

## References

- Council session: `docs/council/COUNCIL-LOG.md` (2026-04-07 entry)
- Files referenced: `infra/docker-compose.yml`, `infra/Caddyfile`, `services/stage-engine/src/routes/ws.ts`, `services/stage-engine/src/core/guardian-bus.ts`, `services/stage-engine/src/core/session-manager.ts`
- Related ADRs: ADR-0039 (Infra Consolidation), ADR-0040 (Infrastructure in Monorepo), ADR-0071 (Preview Environment Architecture)
- Vercel knowledge update (this session): `experimentalServices` is not in current public docs; documented surfaces are `functions`, `crons`, `bunVersion`, `routes`, and `vercel.ts` + `@vercel/config`
