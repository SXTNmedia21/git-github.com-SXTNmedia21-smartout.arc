● Harness-arkitektur — naile det

  Mental modell

  Smartout (web/mobile/Edge) = playground (data +
   surfaces)
         ↕ HTTP / pg-notify
  Harness (Docker net `harness`) = agent-fabrikk
         ↕ stage-engine RPC (eneste DB-vei)
  Agents (N, ensartet protokoll) = pluggbar
  arbeidsstokk

  Smartout eier data. Harness eier kompetanse.
  Stage-engine = grenseport.

  Container-layout

  harness/
  ├── caddy           80/443     gateway,
  agent-slug routing
  ├── stage-engine    5010       mono-server,
  eneste DB-skriver
  ├── shift-mcp       5011       D6 tooling
  ├── contract-service 5012      contract
  pipeline
  ├── agent-pool      5020-5029  N agent-runtimes
   (dynamic)
  ├── voice-agent     5030       LiveKit worker
  (Dockerfile-ize)
  ├── redis           6379       queue + memory
  cache + pubsub
  └── (Supabase = host dev / Cloud prod, named
  decision)

  Base.yml komplett dev. Prod additive.
  Voice-agent får entry. Port-range 5020-5029
  reservert agent-pool.

  Uniform agent-protokoll

  Manifest (/agents/<slug>/manifest.yaml):
  slug: support-tier-1
  class: customer-facing       # internal |
  customer-driving | customer-facing
  capabilities: [helpdesk_query, ticket_assign]
  authority_profile: tier-1    # →
  engine_authority_config row
  channels: [chat, email]      # ADR-0078
  enforced
  memory_namespace: support.{workspace_id}
  voice: { enabled: false }
  surfaces: [/dashboard/komm, mobile.support]
  sdk_version: ^1.0

  Boot lifecycle:
  1. Agent container start → leser manifest
  2. POST /registry/register til stage-engine →
  validering mot Zod-schema
  3. Stage-engine sjekker authority-slot,
  allokerer session-token + memory-namespace
  4. Agent inn i main-loop: LLM ↔ tool-proxy via
  stage-engine

  Runtime kontrakt — alle agenter likt:
  dispatch(intent, ctx)   →  stage-engine router
   →  capability
  tool.invoke(name, args) →  stage-engine wrapper
   →  C4 gate + emit + DB
  memory.read/write       →  stage-engine
   →  engine_memory (namespaced)
  emit(event)             →  automatisk fra
  wrapper
  voice.connect()         →  LiveKit room scoped
  per session

  Ingen agent rører DB direkte. Ingen agent omgår
   C4. Brudd = registry avviser manifest.

  Agent-klasser, samme SDK

  Klasse: internal
  Authority-scope: platform-admin
  Eksempler: adr-writer, schema-migrator,
    test-runner, code-reviewer
  ────────────────────────────────────────
  Klasse: customer-driving
  Authority-scope: workspace
  Eksempler: Botsson, schedule-agent,
    governance-agent
  ────────────────────────────────────────
  Klasse: customer-facing
  Authority-scope: workspace+channel
  Eksempler: support-tier-1, onboarding-bot,
    help-desk

  Alle bygger på packages/agent-sdk. Forskjell =
  manifest, ikke kode.

  Mono-server (stage-engine) absolutt rolle

  Eneste:
  - DB-skriver (alle capabilities pakket i
  gatedMutation per ADR-0204)
  - Authority-vokter (ADR-0173 frozen-4
  boundaries)
  - Telemetry-emitter (registry → 4
  destinasjoner)
  - Memory-broker (engine_memory partisjonert)
  - Channel-pinner (ADR-0078)
  - Guardian-fanout (ADR-0186 pipe eksisterer)
  - Voice-rom-allokator (LiveKit token-server)

  Agentene = dumme klienter. Stage-engine = smart
   hub.

  SDK (packages/agent-sdk) — kanonisk

  Pakkes opp som boot-utility:
  const agent = await createAgent({
    manifest: './manifest.yaml',
    llm: { provider: 'anthropic', model:
  'claude-opus-4-7' },
    hooks: { onIntent, onError, onShutdown },
  });
  agent.run();  // registrerer + main-loop

  Bak fasaden: HTTP/2 til stage-engine, retry,
  circuit-breaker, structured logging, traces til
   PostHog.

  Versjonering + kill-switch

  - Manifest-versjon (sem-ver) — stage-engine kan
   kjøre flere parallelt
  - C4 row per agent_slug — disabled: true =
  registry avviser ny session, eksisterende
  drainer
  - Rollback = bytt manifest-versjon i compose,
  ingen DB-migrasjon

  Hot reload dev vs immutable prod

  - Dev: agent-pool monter packages/agent-sdk +
  manifest-mappe som volume, watch-restart
  - Prod: pre-bygde imaeger per agent-slug,
  deploy via compose pull + restart, manifest
  immutable per image-tag

  Observability

  Per agent_slug-tag på:
  - PostHog event (agent_slug property)
  - activity_trail row (actor_kind = 'agent',
  actor_id = slug)
  - engine_event row
  - LiveKit room (room name =
  <slug>.<workspace>.<session>)

  Kommunikasjon agent ↔ agent

  Via stage-engine. Aldri direkte. Mønster:
  agent A → stage-engine.dispatch(target_agent:
  'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A
  be B om ting?), audit-trail, kill-switch.

  Implementasjonssekvens

  1. Uke 1 — Spor A piggyback: base-consolidation
   + reserver port-range 5020-5029 + voice-agent
  Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry:
  Zod-schema, /registry/register endpoint,
  manifest-loader i agent-sdk. Boot-test med
  stub-agent.
  3. Uke 3 — Capability-proxy uniformisering:
  alle capabilities under gatedMutation
  (ADR-0204), tool-proxy i SDK,
  channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer
  (lavest risiko, ingen workspace-data).
  Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt
  Botsson under SDK. Bevis at eksisterende agent
  fits new harness.
  6. Uke 6 — Pilot customer-facing:
  support-tier-1 mot ADR-0163
  ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest +
   ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation +
  agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest
  schema, registry, agent-klasser,
  kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot,
  lifecycle, hooks, versjonering)
  - ADR-0040 amendment — voice-agent lifecycle,
  faktiske porter, supabase-on-host

  Hvorfor dette låser

  - Én protokoll = én review-overflate. Ny agent
  = ny manifest, ikke nytt arkitekturmøte.
  - Stage-engine som eneste DB-vei = C4 +
  telemetry kan aldri omgås.

  Implementasjonssekvens

  1. Uke 1 — Spor A piggyback: base-consolidation + reserver port-range 5020-5029 + voice-agent Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register endpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register endpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt Botsson under SDK. Bevis at eksisterende agent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry
  baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt Botsson under SDK. Bevis at eksisterende agent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot, lifecycle, hooks, versjonering)
  - ADR-0040 amendment — voice-agent lifecycle, faktiske porter, supabase-on-host

  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot, lifecycle, hooks, versjonering)
  - ADR-0040 amendment — voice-agent lifecycle, faktiske porter, supabase-on-host

  Hvorfor dette låser

  - Én protokoll = én review-overflate. Ny agent = ny manifest, ikke nytt arkitekturmøte.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)

  Observability

  Per agent_slug-tag på:
  - PostHog event (agent_slug property)
  - activity_trail row (actor_kind = 'agent', actor_id = slug)
  - engine_event row
  - LiveKit room (room name = <slug>.<workspace>.<session>)
  - engine_event row
  - LiveKit room (room name = <slug>.<workspace>.<session>)

  Kommunikasjon agent ↔ agent

  Via stage-engine. Aldri direkte. Mønster:
  agent A → stage-engine.dispatch(target_agent: 'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A be B om ting?), audit-trail, kill-switch.
  Via stage-engine. Aldri direkte. Mønster:
  agent A → stage-engine.dispatch(target_agent: 'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A be B om ting?), audit-trail, kill-switch.

  Implementasjonssekvens


  Implementasjonssekvens

  1. Uke 1 — Spor A piggyback: base-consolidation + reserver port-range 5020-5029 + voice-agent Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register endpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register endpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt Botsson under SDK. Bevis at eksisterende agent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot, lifecycle, hooks, versjonering)
  - ADR-0040 amendment — voice-agent lifecycle, faktiske porter, supabase-on-host

  Hvorfor dette låser

  - Én protokoll = én review-overflate. Ny agent = ny manifest, ikke nytt arkitekturmøte.
  - Stage-engine som eneste DB-vei = C4 + telemetry kan aldri omgås. ADR-0151/0173/0186/0204 håndheves automatisk.
  - Compose blir kjedelig, harnessen blir interessant.

  Hva jeg vil ha bekreftet før jeg går

  voice: { enabled: false }
  surfaces: [/dashboard/komm, mobile.support]
  sdk_version: ^1.0

  Boot lifecycle:
  1. Agent container start → leser manifest
  2. POST /registry/register til stage-engine →
  validering mot Zod-schema
  3. Stage-engine sjekker authority-slot,
  allokerer session-token + memory-namespace
  4. Agent inn i main-loop: LLM ↔ tool-proxy via
  stage-engine

  Runtime kontrakt — alle agenter likt:
  dispatch(intent, ctx)   →  stage-engine router
   →  capability
  tool.invoke(name, args) →  stage-engine wrapper
   →  C4 gate + emit + DB
  memory.read/write       →  stage-engine
   →  engine_memory (namespaced)
  emit(event)             →  automatisk fra
  wrapper
  voice.connect()         →  LiveKit room scoped
  per session

  Ingen agent rører DB direkte. Ingen agent omgår
   C4. Brudd = registry avviser manifest.

  Agent-klasser, samme SDK

  Klasse: internal
  Authority-scope: platform-admin
  Eksempler: adr-writer, schema-migrator,
    test-runner, code-reviewer
  ────────────────────────────────────────
  Klasse: customer-driving
  Authority-scope: workspace
  Eksempler: Botsson, schedule-agent,
    governance-agent
  ────────────────────────────────────────
  Klasse: customer-facing
  Authority-scope: workspace+channel
  Eksempler: support-tier-1, onboarding-bot,
    help-desk

  Alle bygger på packages/agent-sdk. Forskjell =
  manifest, ikke kode.

  Mono-server (stage-engine) absolutt rolle

  Eneste:
  - DB-skriver (alle capabilities pakket i
  gatedMutation per ADR-0204)
  - Authority-vokter (ADR-0173 frozen-4
  boundaries)
  - Telemetry-emitter (registry → 4
  destinasjoner)
  - Memory-broker (engine_memory partisjonert)
  - Channel-pinner (ADR-0078)
  - Guardian-fanout (ADR-0186 pipe eksisterer)
  - Voice-rom-allokator (LiveKit token-server)

  Agentene = dumme klienter. Stage-engine = smart
   hub.

  SDK (packages/agent-sdk) — kanonisk

  Pakkes opp som boot-utility:
  const agent = await createAgent({
    manifest: './manifest.yaml',
    llm: { provider: 'anthropic', model:
  'claude-opus-4-7' },
    hooks: { onIntent, onError, onShutdown },
  });
  agent.run();  // registrerer + main-loop

  Bak fasaden: HTTP/2 til stage-engine, retry,
  circuit-breaker, structured logging, traces til
   PostHog.

  Versjonering + kill-switch

  - Manifest-versjon (sem-ver) — stage-engine kan
   kjøre flere parallelt
  - C4 row per agent_slug — disabled: true =
  registry avviser ny session, eksisterende
  drainer
  - Rollback = bytt manifest-versjon i compose,
  ingen DB-migrasjon

  Hot reload dev vs immutable prod

  - Dev: agent-pool monter packages/agent-sdk +
  manifest-mappe som volume, watch-restart
  - Prod: pre-bygde imaeger per agent-slug,
  deploy via compose pull + restart, manifest
  immutable per image-tag

  Observability

  Per agent_slug-tag på:
  - PostHog event (agent_slug property)
  - activity_trail row (actor_kind = 'agent',
  actor_id = slug)
  - engine_event row
  - LiveKit room (room name =
  <slug>.<workspace>.<session>)

  Kommunikasjon agent ↔ agent

  Via stage-engine. Aldri direkte. Mønster:
  agent A → stage-engine.dispatch(target_agent:
  'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A
  be B om ting?), audit-trail, kill-switch.

  Implementasjonssekvens

  1. Uke 1 — Spor A piggyback: base-consolidation
   + reserver port-range 5020-5029 + voice-agent
  Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry:
  Zod-schema, /registry/register endpoint,
  manifest-loader i agent-sdk. Boot-test med
  stub-agent.
  3. Uke 3 — Capability-proxy uniformisering:
  alle capabilities under gatedMutation
  (ADR-0204), tool-proxy i SDK,
  channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer
  (lavest risiko, ingen workspace-data).
  Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt
  Botsson under SDK. Bevis at eksisterende agent
  fits new harness.
  6. Uke 6 — Pilot customer-facing:
  support-tier-1 mot ADR-0163
  ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest +
   ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation +
  agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest
  schema, registry, agent-klasser,
  kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot,
  lifecycle, hooks, versjonering)
  - ADR-0040 amendment — voice-agent lifecycle,
  faktiske porter, supabase-on-host

  Hvorfor dette låser

  - Én protokoll = én review-overflate. Ny agent
  = ny manifest, ikke nytt arkitekturmøte.
  - Stage-engine som eneste DB-vei = C4 +
  telemetry kan aldri omgås.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt Botsson under SDK. Bevis at eksisterende agent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot, lifecycle, hooks, versjonering)
  Via stage-engine. Aldri direkte. Mønster:
  agentrAs→mstage-engine.dispatch(target_agent: 'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A be B om ting?), audit-trail, kill-switch.
  - ADR-0241 — base.yml consolidation + agent-slot reservering
  Implementasjonssekvens             a i          a            agent-klasser, kommunikasjonsregler)
                                  (         e       h         s
  1. Uke 1 — Spor A piggyback: base-clnsocydation +treserver port-range 5020-5029 + voice-agent Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register  ndpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3.oUke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5.ÉUke 5 — Pilot customer-driving:tflytt Botsson undernSDK.tBeviseatyeksisterenderagent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1ymot ADR-0163mticket=engine_sta3e. Voice-channeleeksklusjon.isk.
  7. Uke 7+ — Skalering: nyhagent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrivestet før jeg går

  -.ADR-0241l—abase.ymloconsolidationr+iagent-slottreserveringustomer-agents? Anbefaler ja (én protokoll), men authority-isolasjon må være vanntett.
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikas onsregler)
  - ADR-0243t—wab Bt-SDK kontrakte(boot, lifecycl,, hoeks, versjonering)me? Anbefaler direkte for ikke-AI-flows; agent-runtime kun når intent → LLM.
  Via stage-engine. Aldri direkte. Mønster:
  agent A → stage-engine.dispatch(target_agent: 'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A be B om ting?), audit-trail, kill-switch.

  Implementasjonssekvens

  1. Uke 1 — Spor A piggyback: base-consolidation + reserver port-range 5020-5029 + voice-agent Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register endpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt Botsson under SDK. Bevis at eksisterende agent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot, lifecycle, hooks, versjonering)
  Via stage-engine. Aldri direkte. Mønster:
  agent A → stage-engine.dispatch(target_agent: 'B', intent) → agent B sesjon
  Hvorfor: authority-sjekk mellom agenter (kan A be B om ting?), audit-trail, kill-switch.

  Implementasjonssekvens

  1. Uke 1 — Spor A piggyback: base-consolidation + reserver port-range 5020-5029 + voice-agent Dockerfile-isering. Én PR.
  2. Uke 2 — Manifest-schema + registry: Zod-schema, /registry/register endpoint, manifest-loader i agent-sdk. Boot-test med stub-agent.
  3. Uke 3 — Capability-proxy uniformisering: alle capabilities under gatedMutation (ADR-0204), tool-proxy i SDK, channel/authority/telemetry baked.
  4. Uke 4 — Pilot internal agent: ADR-writer (lavest risiko, ingen workspace-data). Validerer hele kontrakten.
  5. Uke 5 — Pilot customer-driving: flytt Botsson under SDK. Bevis at eksisterende agent fits new harness.
  6. Uke 6 — Pilot customer-facing: support-tier-1 mot ADR-0163 ticket=engine_state. Voice-channel eksklusjon.
  7. Uke 7+ — Skalering: ny agent = ny manifest + ny image. Ingen kjernekode-endring.

  ADR-er som må skrives

  - ADR-0241 — base.yml consolidation + agent-slot reservering
  - ADR-0242 — harness-as-platform (manifest schema, registry, agent-klasser, kommunikasjonsregler)
  - ADR-0243 — agent-SDK kontrakt (boot, lifecycle, hooks, versjonering)
  - ADR-0040 amendment — voice-agent lifecycle, faktiske porter, supabase-on-host

  Hvorfor dette låser

  - Én protokoll = én review-overflate. Ny agent = ny manifest, ikke nytt arkitekturmøte.
  - Stage-engine som eneste DB-vei = C4 + telemetry kan aldri omgås. ADR-0151/0173/0186/0204 håndheves automatisk.
  - Compose blir kjedelig, harnessen blir interessant.

  Hva jeg vil ha bekreftet før jeg går

  1. Internal agents (code-ops) kjører i samme container som customer-agents? Anbefaler ja (én protokoll), men authority-isolasjon må være vanntett.
  Alternativ = egen container med strammere nettverkspolicy.
  2. Smartout web BFF kaller stage-engine direkte, eller via agent-runtime? Anbefaler direkte for ikke-AI-flows; agent-runtime kun når intent → LLM.
  3. LLM-provider per agent eller global? Anbefaler per-manifest (Botsson Opus, support-tier-1 Haiku, ADR-writer Opus). Cost + latency-fit.

  Bekreft de tre, så drar jeg ADR-0242 draft som første artefakt.

✻ Churned for 1m 16s

※ recap: Goal: rebuild infra container as proper agent harness for Smartout, with uniform protocol so specialized agents (code, customer-driving, support)
  plug in. Next action: confirm three open questions (internal-agent isolation, BFF routing, per-agent LLM choice) so I can draft ADR-0242. (disable recaps
  in /config)

❯ vscode-remote://wsl%2Bubuntu/home/sxtnl/dev/smartout.ai/docs/engines/system-intelligence/05-protocol-pipeline.md Det er fint at du definerer på den
  nivåen. Det er akkurat her vi skal være, men det er et element jeg føler du overser. Og det er jo arenan. Og arenan leverer Journey Engine. Og the Journey
   Engine er det her. Teksting av Pontus Lindroth

  Read 1 file (ctrl+o to expand)

● Du har rett. Jeg overså Arena + Journey Engine. Folder-protokollen er allerede manifest-kontrakten — jeg holdt på å oppfinne et parallelt schema.
  Reviderer.

  Korrigert arkitektur

  Tre lag, ikke ett

  Journey Engine (author-time)        produserer journey-folder (13 filer)
          ↓
  Arena (runtime, container)          eksekverer journeys via stage-engine
          ↓
  Smartout (playground)               UX-overflater + data

  Harness = Arena. Container = Arena's hus. Agentene = mission-runnere som plugger inn via MISSION.md.

  Hva harness ikke trenger oppfinne

  ┌─────────────────────┬─────────────────────────────────────────────────────────────────┐
  │ Min forrige forslag │                  Allerede definert i pipeline                   │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ Manifest YAML       │ MISSION.md + LICENSE.md                                         │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ Authority-profile   │ LICENSE.md (C4 manifest)                                        │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ Channels[]          │ MISSION.voice.enabled + voice-eksklusjon på pii_input           │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ Memory namespace    │ engine_missions.workspace_id + memory partition per mission     │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ Rescue/error-hooks  │ RESCUE-PROMPT.md (loaded ved stuck/failed)                      │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ Boot lifecycle      │ journey-folder materialize → engine_missions row → mission boot │
  └─────────────────────┴─────────────────────────────────────────────────────────────────┘

  Slutter å bygge parallell-schema. Bygger hostende runtime.

  To agent-klasser, korrekt fundert

  ┌────────────────┬────────────────┬────────────────────────────────────────┬───────────────────┐
  │     Klasse     │   Bound til    │                Kontrakt                │ Dashboard-synlig  │
  ├────────────────┼────────────────┼────────────────────────────────────────┼───────────────────┤
  │ Mission-runner │ journey-folder │ ROADMAP → MISSION → FLOW → RESCUE      │ Ja (FLOW-rendret) │
  ├────────────────┼────────────────┼────────────────────────────────────────┼───────────────────┤
  │ Service-agent  │ ingen journey  │ direkte capability-call, internal-only │ Nei (off-Arena)   │
  └────────────────┴────────────────┴────────────────────────────────────────┴───────────────────┘

  - Mission-runners: Botsson, support-tier-1, onboarding-bot, schedule-coach. Trigger = ROADMAP-button. Spor = FLOW.md. Fjernkontroll = RESCUE.
  - Service-agents: ADR-writer, schema-migrator, test-runner, code-reviewer. Trigger = CLI/cron/webhook. Ingen mission. Eksternt fra Arena, deler kun
  infra-container.

  Begge bruker packages/agent-sdk. Forskjell = service-agent skipper mission-mount, registrerer som "service" + får begrenset capability-set.

  Arena-container

  arena/                                = harness
  ├── caddy            80/443           gateway
  ├── stage-engine     5010             Arena-kjerne (mission-runtime, FLOW-broker, registry)
  ├── journey-engine   (no daemon)      author-time CLI + generators (compile only)
  ├── shift-mcp        5011             D6 tooling
  ├── contract-service 5012             contract pipeline
  ├── mission-pool     5020-5029        mission-runner agent slots (Docker containers, M agents)
  ├── service-pool     5040-5049        service-agent slots (internal-only)
  ├── voice-agent      5030             LiveKit worker (Dockerfile-isert)
  ├── redis            6379             queue + pubsub + memory cache
  └── (Supabase = host dev / Cloud prod)

  Mission-pool og service-pool segregert på port-range OG nettverkspolicy. Service-pool kan ikke nå workspace-data direkte — må gå via stage-engine, som
  blokkerer cross-class kall.

  Mission-runner boot — bruker eksisterende kontrakt

  1. journey-engine compile → docs/journeys/<slug>/ + engine_missions row
  2. mission-pool slot starter container med MISSION_ID env
  3. agent-sdk leser engine_missions row → henter folder fra repo
  4. SDK loader: MISSION.md (persona, opening, stages, voice, authority)
                  LICENSE.md (C4 capabilities som er tilgjengelig)
                  RESCUE-PROMPT.md (lastes ved stuck/failed)
                  FLOW.md (forventet event-spine, stage-engine matcher mot)
  5. Stage-engine validerer mission_id mot engine_missions.is_active=true
  6. Authority-rows fra LICENSE inserted i engine_authority_config (idempotent CROSS JOIN, ADR-0176)
  7. SDK starter main-loop: dispatch → tool-proxy → capability (gated)
  8. Hver tool-call emit-er event som matcher FLOW.md row → dashboard render
  9. Stuck/failed → SDK leser RESCUE-PROMPT, forsøker recovery, eller eskalerer

  Ingen ny manifest. Folder ER manifestet.

  Service-agent boot — slankere

  1. Service-agent container starter med config: { slug, capabilities[], schedule? }
  2. Stage-engine /registry/service/register validerer slug + capability-allowlist
  3. Authority-row som "internal scope" (kan ikke kalle workspace-mutations)
  4. SDK starter event-loop (cron/webhook/CLI-trigger), kaller capabilities via samme tool-proxy
  5. Telemetry tagged actor_kind='service_agent' i activity_trail

  Ingen mission. Ingen FLOW. Ingen RESCUE. Kun capability-call + emit.

  Stage-engine (Arena-kjerne) ansvar

  ┌───────────────────────────────┬────────────────────────────────────────────────────────┐
  │            Ansvar             │                         Kilde                          │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Mission-registry + livssyklus │ engine_missions, ADR-0224                              │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ FLOW-broker (event-matching)  │ FLOW.md schema, ADR-0225                               │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Capability-router (gated)     │ ADR-0204 gatedMutation                                 │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Authority-vokter (frozen-4)   │ ADR-0173 + LICENSE.md                                  │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Channel-pinner                │ ADR-0078 + MISSION.voice                               │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Telemetry-emitter             │ packages/telemetry/src/registry.ts                     │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Memory-broker                 │ engine_memory partisjonert per mission_id+workspace_id │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Rescue-loader                 │ RESCUE-PROMPT.md ved stuck/failed                      │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Guardian-fanout               │ ADR-0186 pg-notify-bus                                 │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Service-agent registry        │ egen tabell engine_service_agents (ny)                 │
  ├───────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Voice-rom-allokator           │ LiveKit token-server                                   │
  └───────────────────────────────┴────────────────────────────────────────────────────────┘

  Hva som faktisk må bygges (etter Steward's ADR-0241)

  1. ADR-0242 — Arena-as-platform: definerer mission-pool vs service-pool, registry, boot-kontrakt, kalle-regler mellom klasser. Bygger på ADR-0224
  (engine_missions schema) og ADR-0222 (op pipeline).
  2. ADR-0243 — engine_service_agents schema (service-pool registry, separat fra missions).
  3. Journey-engine pipeline implementasjon — pipelinen er intent (kommentar i §1 av doc). Generators for FLOW.md, e2e, materializer eksisterer ikke. Blokker
   for første mission-runner pilot.
  4. ADR-0225 vedtak — FLOW.md som registry-source eller intent-doc. Avgjør om FLOW-event-match kan implementeres.
  5. journey.rescued event — registry-bump for RESCUE-PROMPT-løft.

  Implementasjonssekvens — revidert

  ┌─────┬───────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────┐
  │ Uke │                                           Spor                                            │                       Output                       │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 1   │ A: ADR-0241 base-consolidation + port-range reservasjon                                   │ Container stabil, slot 5020-5029 + 5040-5049       │
  │     │                                                                                           │ reservert                                          │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 2   │ B: ADR-0242 + 0243 draft → council                                                        │ Arena-as-platform navnsatt, schema låst            │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 3   │ C: Journey-engine pipeline implementasjon (materializer + FLOW.md generator + e2e         │ Første journey-folder kan kompileres ende-til-ende │
  │     │ generator)                                                                                │                                                    │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 4   │ D: First service-agent (ADR-writer) — kontrakt-validering uten workspace-risiko           │ Service-pool kontrakt bevist                       │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 5   │ E: First mission-runner pilot (admin-onboarding R-001/J-001/M-001/L-001 —                 │ Mission-pool kontrakt bevist, FLOW-dashboard       │
  │     │ referanseeksempel finnes allerede)                                                        │ fungerer                                           │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 6   │ F: Botsson migrert til mission-runner-kontrakt                                            │ Eksisterende agent fits ny harness                 │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 7   │ G: support-tier-1 mission-runner mot ADR-0163 ticket=engine_state                         │ Customer-facing klasse bevist                      │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 8+  │ Skalering                                                                                 │ Ny agent = ny journey-folder (mission) eller       │
  │     │                                                                                           │ service-config                                     │
  └─────┴───────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────┘

  Tre revisjoner fra forrige runde

  1. Manifest droppes. journey-folder er kontrakten. Internal agents får slankere config.
  2. "Agent-klasse" reduseres til 2. Mission-runner (Arena-bound) vs service-agent (off-Arena, infra-only). Internal/customer-driving/customer-facing
  kollapser inn under mission-runner med ulike LICENSE-scope.
  3. Journey-engine = author-time tool, ikke runtime daemon. Må bygges (intent ennå), men ikke som compose-service. CLI + generators + skill.

  Hva jeg trenger bekreftet

  1. Service-agents (ADR-writer etc.) — egen pool, eller bare la dem være platform-admin missions? Anbefaler egen pool — service-agents har annet livssyklus
  (cron/webhook), ingen UX-trigger, ingen FLOW. Mission-pakken passer dårlig.
  2. Journey-engine implementasjon — eget campaign, eller fold inn i Arena-bygg? Anbefaler eget campaign (allerede campaign/journey-engine eksisterer).
  Arena-bygg konsumerer det campaign produserer.
  3. ADR-0225 (FLOW.md status) — vil du forsere vedtak nå? Anbefaler ja. Uten det er FLOW kun design-artifakt, og Arena-dashboardet kan ikke implementeres.

  Bekreft de tre, så drar jeg ADR-0242 (Arena-as-platform) draft.

✻ Sautéed for 1m 32s

❯ vscode-remote://wsl%2Bubuntu/home/sxtnl/dev/smartout.ai/docs/engines/system-intelligence/11-handoff-capstone.md

  Read 1 file (ctrl+o to expand)

● Skjerpet — Arena = N-C worker

  Gap-analyse mot handoff

  Journey Engine campaign er ~90% ferdig. Jeg overdrev "pipeline er intent". Hva som faktisk mangler er smalere enn jeg framstilte:

  ┌─────────────────────────────────────────────────────────┬─────────────────────────────────────────────┬──────────────┐
  │                         Mangler                         │                    Eier                     │ Tracked som  │
  ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┼──────────────┤
  │ N-C worker (dequeuer for engine_state rows fra run_dev) │ "campaign/botsson-arena eller new campaign" │ Phase 3 #3   │
  ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┼──────────────┤
  │ engine_state vs engine_sessions ontologi                │ open-loop B1                                │ ADR pending  │
  ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┼──────────────┤
  │ Producer som emit-er journey.completed/stuck/run_failed │ tomt — Fjernkontroll renderer active evig   │ open-loop B1 │
  ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┼──────────────┤
  │ Mobile Reanimated-port                                  │ Phase 4                                     │ etter Arena  │
  ├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┼──────────────┤
  │ Seed-missions i preview/prod                            │ Pontus manuelt                              │ etter Arena  │
  └─────────────────────────────────────────────────────────┴─────────────────────────────────────────────┴──────────────┘

  Resten er bygget: 4 capabilities, IR-package, fjernkontroll state machine, BFF, mobile thin-client, journey_guide table, 5 migrasjoner, Journey Guardian (6
   gates green), telemetry-registry (5 events, 4 destinasjoner), auth seed (CROSS JOIN idempotent).

  Korrigert tese

  Arena = N-C worker. Ikke ny abstraksjon. Konkret mandat: dequeue engine_state rows, advance steps, emit completion-events, lukke FLOW-loop.

  Harness Candidate 1 er Arena's akseptanse-kriterium: seed engine_state via runGuidedTool, engine_state_step.status → complete innen 10s. Test ikke skrevet
  ennå. Vi skriver den først, lar den feile, så bygger til den passer.

  Hvorfor B1 (ontologi-ADR) er prerequisite

  Capabilities skriver engine_state. Stage-engine leser engine_sessions. Phantom-consumer er load-bearing. To valg:

  ┌───────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┐
  │              Alt              │                                    Konsekvens                                     │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Konsolider på engine_state    │ Stage-engine omskriver session-lesere. Botsson migrerer. Større flytt, ren slutt. │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Bro: stage-engine leser begge │ Mindre endring, men beholder split-brain. Arena må lese begge tabeller.           │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Konsolider på engine_sessions │ Capabilities omskriver. Bryter ADR-0173 contract surface. Avvis.                  │
  └───────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘

  Jeg anbefaler alt 1 — én tabell, ren ontologi. Men det er ADR-vedtak, ikke build-vedtak.

  Revidert container-rolle

  Mission-pool = N-C worker-instans per mission. Konkret implementasjon:

  mission-pool slot startup:
    1. Container env: { MISSION_ID, WORKER_CONCURRENCY=4 }
    2. Lytter pg-notify-kanal `engine_state.mission_id=<id>` (ADR-0186 bus eksisterer)
    3. På notify: SELECT engine_state WHERE mission_id=$1 AND status='pending' FOR UPDATE SKIP LOCKED
    4. Hent IR fra docs/journeys/<slug>/ir/journey.yaml (mounted volume) + hash-verifiser
    5. Hent MISSION.md persona + LICENSE.md authority
    6. Initier LLM-loop med agent-sdk + tool-proxy
    7. Per step:
         - validér mot FLOW.md row (event-match)
         - kall capability via gatedMutation (ADR-0204)
         - oppdater engine_state_step.status
         - emit step.* event
    8. Ved terminal step: emit journey.completed, status='complete'
    9. Ved stuck: load RESCUE-PROMPT.md, retry-budsjett, eller emit journey.stuck
    10. Ved feil: emit journey.run_failed

  Service-pool = off-Arena. Ingen engine_state deltakelse. Direkte capability-kall.

  Stage-engine sin rolle skarpere

  Stage-engine = Arena's kontrollplan, ikke worker. Mission-pool er workers. Stage-engine:
  - Mission-registry + dispatch (/dispatch ruter engine_state insert per mission_id)
  - pg-notify fanout (ADR-0186 pipe finnes)
  - Authority-vokter via gatedMutation (gate_action på alle mutations)
  - Telemetry-emit-broker
  - RESCUE-PROMPT loader
  - FLOW-event-matcher (validerer at event matcher row)

  Worker-prosess flyttes ut av stage-engine til mission-pool. Stage-engine forblir tynt.

  Revidert sekvens

  ┌─────┬────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────┐
  │ Uke │                              Steg                              │                       Output                       │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 0   │ ADR for B1 ontologi (engine_state vs engine_sessions)          │ Vedtak før Arena-build kan starte                  │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 1   │ Steward's ADR-0241 base-consolidation + port-range reservasjon │ Container stabil                                   │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 2   │ ADR-0242 Arena = N-C worker + mission-pool kontrakt            │ Worker-pattern navnsatt                            │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 3   │ Skriv Harness Candidate 1 falsifiable test                     │ Acceptance-kriterium på CI, RØDT                   │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 4   │ Implementer mission-pool worker (én slot, én mission)          │ Pilot mission: admin-onboarding R-001              │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 5   │ Producer-emit fra worker (journey.completed/stuck/run_failed)  │ Fjernkontroll går grønn, Harness Candidate 1 GRØNT │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 6   │ Service-pool for ADR-writer                                    │ Off-Arena kontrakt bevist                          │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 7   │ Botsson migrert til mission-pool (B1 ontology-konsolidering)   │ Eksisterende agent fits Arena                      │
  ├─────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 8   │ support-tier-1 mission på ADR-0163 ticket=engine_state         │ Customer-facing klasse                             │
  └─────┴────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────┘

  Tre ADR-er som må skrives — revidert

  1. ADR (B1 ontologi) — engine_state som single source for journey runtime, engine_sessions deprecated for journey-flows. Stage-engine + Botsson
  migrasjonsplan.
  2. ADR-0241 — base.yml consolidation + agent-slot reservasjon (Steward).
  3. ADR-0242 — Arena = N-C worker. Mission-pool kontrakt. Service-pool for off-journey agents. Bygger på ADR-0173 (frozen-4 caps) + ADR-0177 (fjernkontroll)
   + ADR-0215 (stuck-detector reaktivering Option A).

  Hva endres fra forrige forslag

  ┌─────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────┐
  │               Forrige               │                                    Nå                                    │
  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ "Bygg manifest-schema"              │ Droppet — folder + IR er kontrakten                                      │
  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ "Bygg registry"                     │ Droppet — engine_missions er registry                                    │
  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ "Mission-runner som agent-klasse"   │ Skarpere: mission-runner = N-C worker-prosess, plukker engine_state rows │
  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ "Service-agent som agent-klasse"    │ Beholdt, men eksplisitt off-Arena, ingen engine_state deltakelse         │
  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ "Journey-engine pipeline må bygges" │ Droppet — 90% bygget, kun materializer-finishing gjenstår (Phase 4)      │
  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ "Implementasjon 8 uker"             │ Skarpere 8-ukers sekvens med ontologi-ADR i uke 0                        │
  └─────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────┘

  Hva jeg trenger bekreftet

  1. B1 ontologi: konsolider på engine_state? Anbefaler ja. Botsson omskriver session-lesere — engangskostnad, ren slutt. Alternativ (bro) etterlater
  split-brain.
  2. ADR-0215 reactivation Option A i samme campaign? Stuck-detector event-driven path er dead code. Reaktivering passer naturlig når mission-pool faktisk
  emit-er stuck-events. Anbefaler bake inn i ADR-0242.
  3. Hvor bygger vi? campaign/botsson-arena er nevnt eksplisitt i handoff som potensiell eier. Skal Arena = N-C worker bygges der, eller ny campaign/arena?
  Anbefaler campaign/botsson-arena — riktig navn, eksisterende worktree, og Botsson selv migrerer som del av work.

  Bekreft de tre, så drar jeg ADR-utkast i denne rekken: B1 ontologi → 0241 → 0242.

✻ Worked for 1m 15s

※ recap: Goal: design Arena harness as N-C worker that dequeues engine_state and runs journey missions, folded with Steward's infra base-consolidation. Next
  action: you confirm three things — B1 ontology (engine_state as single source), ADR-0215 reactivation in same campaign, and building on
  campaign/botsson-arena. (disable recaps in /config)

❯ Jeg tenker sånn at du tar nå med konteksten og kjører en skikkelig dypdykk i den dokumentasjonen du har fått. Og så vil jeg at du skriver en ADR-liste, en
   skill-liste med alle skills som du mener at vi behøver for å både bygge og underholde dette. Og så vil jeg at du definerer alle forskjellige ekspertiser
  vi trenger i prosjektet. Og så vil jeg at du tenker kontinuerlig innhenting av data for å sørge for at vi holder oss i loopen, holder oss trendy og sikrer
   at vi utvikler oss og har et prosjekt som vil utvikle seg med tiden framover, både gjennom informasjon, kunnskap og også logging.

  Read 1 file, listed 2 directories (ctrl+o to expand)

● Dypdykk-utfall — bygge + holde Arena levende

  Lest: 05-protocol-pipeline, 11-handoff-capstone, BOTSSON-SYSTEM-MAP, 01-prd, ADR-listen til 0244. Korreksjoner før jeg leverer:

  - Mine ADR-numre var feil. 0241-0244 tatt (contract-skjema, ikke infra). Nye starter på 0245.
  - Stage-engine ER mer ferdig enn antatt. Memory-writer fix Phase A3, pg-notify-bus Phase A6, Session Recorder Phase D1 alle landet 2026-04-22. Profile_id
  forgeability fix landet 2026-04-23 (ADR-0151). 15 capabilities, ikke 14.
  - Phantom-consumer (B1) er hovedgapet. Stage-engine leser engine_sessions, capabilities skriver engine_state. Ingen produsenter for
  journey.completed/stuck/failed. Fjernkontroll henger på active.
  - N-C worker = Arena's mandat. Eksplisitt out-of-scope i journey-engine campaign, naming campaign/botsson-arena som potensiell eier.

  ---
  1. ADR-LISTE

  A. Foundation (bygge Arena)

  ┌──────┬─────────────────────────────────────────────────────────┬────────┬─────────────────────────┬─────────────────────────────────────────────────┐
  │ ADR  │                         Tittel                          │ Status │       Avhenger av       │                 Hvorfor blokker                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0245 │ engine_state vs engine_sessions ontology — single-table │ DRAFT  │ —                       │ B1 phantom-consumer; uten dette har Arena to    │
  │      │  for journey runtime                                    │        │                         │ virkeligheter                                   │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0246 │ Base.yml consolidation + agent-slot port-reservasjon    │ DRAFT  │ —                       │ Steward's strukturfix; pre-rekvisitt for        │
  │      │ (5020-5029, 5040-5049)                                  │        │                         │ mission-pool                                    │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0247 │ Arena = N-C worker; mission-pool kontrakt +             │ DRAFT  │ 0245, 0246              │ Hovedarkitektur for harness                     │
  │      │ service-pool segregering                                │        │                         │                                                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0248 │ agent-sdk boot-kontrakt — folder-as-manifest,           │ DRAFT  │ 0247, ADR-0224          │ Uniform agent-runtime                           │
  │      │ MISSION+LICENSE+RESCUE som schema                       │        │ (engine_missions)       │                                                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0249 │ Agent-to-agent kommunikasjon kun via stage-engine       │ DRAFT  │ 0247, 0248              │ Authority-isolasjon mellom klasser              │
  │      │ /dispatch                                               │        │                         │                                                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0250 │ Voice-agent lifecycle — Dockerfile + LiveKit            │ DRAFT  │ 0246                    │ Brutt ADR-0040 sjekkliste                       │
  │      │ token-server eller named host-prosess                   │        │                         │                                                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0251 │ Supabase host-vs-cloud named decision                   │ DRAFT  │ 0246                    │ Hardkodet i 6 linjer, aldri ADR'd               │
  │      │ (host.docker.internal i compose)                        │        │                         │                                                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0252 │ ADR-0040 amendment — faktiske porter (5010/5011/5012),  │ DRAFT  │ 0246, 0250, 0251        │ Stale ADR; "Adding a Service"-sjekkliste brutt  │
  │      │ voice-lifecycle, supabase-decision                      │        │                         │                                                 │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0253 │ ADR-0215 reactivation Option A — stuck-detector         │ DRAFT  │ 0247                    │ Død kode i                                      │
  │      │ event-driven path live når mission-pool emit-er         │        │                         │ journey-stuck-detector/index.ts:278-471         │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0254 │ ADR-0225 vedtak — FLOW.md som registry-source eller     │ DRAFT  │ —                       │ Uten dette kan ikke Arena dashboard             │
  │      │ intent-doc only                                         │        │                         │ event-matche                                    │
  ├──────┼─────────────────────────────────────────────────────────┼────────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ 0255 │ Harness Candidate test-pakke — N falsifiable            │ DRAFT  │ 0247                    │ Per ADR-0196 invariants 11/12/13                │
  │      │ acceptance-tester per agent-klasse                      │        │                         │                                                 │
  └──────┴─────────────────────────────────────────────────────────┴────────┴─────────────────────────┴─────────────────────────────────────────────────┘

  B. Maintenance / governance (holde Arena levende)

  ┌──────┬────────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
  │ ADR  │                                           Tittel                                           │                     Hvorfor                      │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0256 │ System-map staleness gate (extend ADR-0227) — auto-refresh cron + PR-blokk hvis            │ L-0150 mønster — alle summary-artifacter drifter │
  │      │ verified_against_code > 7 dager                                                            │                                                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0257 │ ADR-drift-detection — code-trace-cadence per accepted ADR (random sample weekly)           │ Pattern: ADR-0040 stale i månedsvis, ingen       │
  │      │                                                                                            │ oppdaget                                         │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0258 │ Continuous trend-ingestion kontrakt — hva, hvor ofte, til hvilken kilde (K1a vs            │ Trend-data trenger eier ellers råtner            │
  │      │ research-log vs claude-mem)                                                                │                                                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0259 │ LLM model rollover policy — når Anthropic ny modell, hva migreres + akseptansetest per     │ Opus 4.6 → 4.7 skjedde uten policy               │
  │      │ agent                                                                                      │                                                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0260 │ Agent performance scoring + rotation policy — hvilke metrics, terskel for deprecation      │ Stuck-rate, latency, kost, user-rating           │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0261 │ Knowledge retention policy — engine_memory GC, claude-mem cap, research-log promotion til  │ Data-eksplosjon over 12 mnd uten policy          │
  │      │ wiki                                                                                       │                                                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0262 │ Observability kontrakt — per-agent traces, FLOW-dashboard, alert-tærskler                  │ Sentry + PostHog + activity_trail har ingen      │
  │      │                                                                                            │ samspill-spec                                    │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0263 │ Customer-feedback ingestion — helpdesk-ticket categorization → journey-improvement loop    │ Feedback finnes men ikke koblet til              │
  │      │                                                                                            │ journey-iteration                                │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0264 │ Regulatory ingestion (Riksavtalen, GDPR, AML) — hvem oppdaterer K1a, kadence, audit-trail  │ Hardkodede rates i hospitality.ts allerede feil  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ 0265 │ Council retrospective cadence — månedlig agent-effectiveness review                        │ Self-learning council eksisterer men har ikke    │
  │      │                                                                                            │ retrospektiv                                     │
  └──────┴────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Sum: 21 ADRs. 11 build, 10 maintain.

  ---
  2. SKILL-LISTE

  Eksisterende som skal beholdes

  journey-protocol, protocol-writer, smartout-cascade-developer, smartout-database-guide, smartout-edge-function-guide, smartout-nordic-split,
  smartout-page-polish, secrets-protocol, linear-protocol, task-stacking, worktree, run-council, heartbeat, finance-copilot, board-copilot, deploying.

  Nye skills som må bygges

  ┌─────┬─────────────────────────────────────────┬────────────────────────────────────────────────┬─────────────────────────────────────────────────────┐
  │  #  │                  Skill                  │                 Kjerne-trigger                 │                    Hva den gjør                     │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 1   │ arena-builder                           │ "build mission-pool", "wire N-C worker",       │ bygger worker-prosess, kobler pg-notify,            │
  │     │                                         │ "register mission"                             │ registrerer mission_id                              │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 2   │ agent-sdk-builder                       │ "boot agent", "validate manifest", "wire       │ scaffolder ny agent fra MISSION/LICENSE/RESCUE      │
  │     │                                         │ tool-proxy"                                    │                                                     │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 3   │ mission-debugger                        │ stuck/failed runs, FLOW-event mismatch         │ trace event-stream, sammenlign med FLOW.md, peker   │
  │     │                                         │                                                │ på avvik                                            │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 4   │ service-agent-builder                   │ off-Arena utility (cron/webhook)               │ scaffolder service-pool agent, ingen mission        │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 5   │ adr-writer                              │ nye ADR-er + decision-log register             │ template, status-transition, registrering,          │
  │     │                                         │                                                │ supersedes-håndtering                               │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 6   │ ontology-resolver                       │ to tabeller for samme konsept                  │ tvinger ADR-class beslutning, migrasjonsplan,       │
  │     │                                         │                                                │ deprecation-vei                                     │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 7   │ trend-ingestor                          │ LLM-evals, framework-changelogs, security      │ scheduled fetch, sammenfatt, ingest til K1a +       │
  │     │                                         │ advisories                                     │ claude-mem                                          │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 8   │ system-map-refresher                    │ BOTSSON-SYSTEM-MAP > 7 dager                   │ code-trace, oppdater 🟢/🟡/🔴, commit, telemetri    │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 9   │ harness-verifier                        │ Harness Candidate-tester                       │ N falsifiable acceptance-tests per agent-klasse,    │
  │     │                                         │                                                │ CI-gate                                             │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 10  │ journey-package-compiler                │ spec/refined → 13-file folder                  │ materialize, hash, idempotent CROSS JOIN authority  │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 11  │ flow-event-validator                    │ CI-gate FLOW.md ↔ registry                     │ hver row's event finnes i                           │
  │     │                                         │                                                │ packages/telemetry/src/registry.ts                  │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 12  │ invariant-checker                       │ Journey Engine 11/12/13 + harness invariants   │ PR-gate, daily nightly full-suite                   │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 13  │ agent-loop-coach                        │ observert stuck-rate per mission               │ analyser RESCUE-aktiveringer, foreslå prompt-tuning │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 14  │ memory-curator                          │ engine_memory GC, claude-mem cap               │ partition, sammendrag av aldring, retention-policy  │
  │     │                                         │                                                │ enforcing                                           │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 15  │ rescue-prompt-author                    │ nye/refinerte RESCUE-PROMPT.md                 │ mønster fra stuck-corpus → prompt-revisjon          │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 16  │ agent-rotation-evaluator                │ månedlig score + deprecation-anbefaling        │ les telemetry, terskel-test, foreslå sunset         │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 17  │ kb-ingestor                             │ regulatorisk + bransjekunnskap                 │ Riksavtalen-PDF, GDPR-bulletins → K1a chunks        │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 18  │ changelog-watcher                       │ Next/React/Supabase/Anthropic SDK releases     │ parse changelog, flagg breaking, foreslå            │
  │     │                                         │                                                │ migrasjons-PR                                       │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 19  │ deprecation-tracker                     │ planlagte fjerninger                           │ TODO-skanning, sunset-dato, force-migration-PR      │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 20  │ council-convener (utvider eksisterende  │ retrospektiv + agent-effektivitet              │ månedlig retrospektiv, agent-skore-output           │
  │     │ run-council)                            │                                                │                                                     │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 21  │ falsifiability-auditor                  │ random ADR/handoff stikkprøve                  │ verifiser cited-grep/SHA/test, flagg phantom-claims │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 22  │ dual-perspective-verifier (utvid        │ feature med to roller                          │ utvid til mission-roller (admin-publisher vs        │
  │     │ eksisterende)                           │                                                │ runtime-agent)                                      │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 23  │ e2e-spec-generator                      │ FLOW.md → Playwright                           │ generate spec, opprettholde ved IR-endring          │
  ├─────┼─────────────────────────────────────────┼────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 24  │ emit-coverage-checker                   │ hver mutation har emit()                       │ grep-gate på Server Actions + capability tools      │
  └─────┴─────────────────────────────────────────┴────────────────────────────────────────────────┴─────────────────────────────────────────────────────┘

  Sum: 24 nye skills.

  ---
  3. EKSPERTISER (roller, ikke nødvendigvis personer)

  Kjernebygg (Arena + harness)

  ┌───────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────┐
  │         Rolle         │                      Eier                       │                              Skills brukt                               │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Platform architect    │ ADR-er, schema-decisions, ontologi-kall         │ adr-writer, ontology-resolver, system-steward (agent), council-convener │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Stage Engine engineer │ L3 mono-server, routing, gating, pg-notify-bus  │ smartout-edge-function-guide, system-agent-coordinator (agent)          │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Capability engineer   │ L4 tools, gateAction-wrappers, emit-kontrakt    │ smartout-database-guide, emit-coverage-checker, invariant-checker       │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Database engineer     │ L5, RLS, migrasjoner, backfill                  │ smartout-database-guide, ontology-resolver                              │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Agent SDK engineer    │ packages/agent-sdk, manifest-loader, tool-proxy │ agent-sdk-builder, agent-loop-coach                                     │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Arena worker engineer │ mission-pool, N-C dequeue, FLOW-broker          │ arena-builder, mission-debugger, harness-verifier                       │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Frontend engineer     │ Arena-overlays, Fjernkontroll, FLOW-dashboard   │ smartout-nordic-split, smartout-page-polish, frontend-designer (agent)  │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ Mobile engineer       │ thin-client, BFF mobile-kontrakter              │ dual-perspective-verifier                                               │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ DevOps / infra        │ docker-compose, droplet, Caddy, secrets         │ deploying, secrets-protocol                                             │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
  │ E2E / QA              │ Playwright, journey-guardian, falsifiable suite │ protocol-writer, e2e-spec-generator, falsifiability-auditor             │
  └───────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────┘

  Drift + governance

  ┌──────────────────────────┬───────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
  │          Rolle           │                     Eier                      │                      Skills brukt                      │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ System Steward           │ plan-vs-virkelighet                           │ system-steward (agent), falsifiability-auditor         │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ System Agent Coordinator │ agent-arkitektur-decisions                    │ system-agent-coordinator (agent)                       │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Council Convener         │ multi-perspektiv reviews + retrospektiv       │ run-council, council-convener                          │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Reliability / SRE        │ observability, alerting, on-call              │ invariant-checker, system-map-refresher                │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Security                 │ RLS-audits, gate_action coverage, CVE-respons │ secrets-protocol, emit-coverage-checker                │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Compliance / regulatory  │ GDPR, retention, K1a oppdateringer            │ kb-ingestor, secrets-protocol                          │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Customer-facing AI ops   │ support-tier-1, helpdesk-routing, SLA         │ mission-debugger, agent-loop-coach                     │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Content / authoring      │ journeys, missions, RESCUE-enrichment         │ journey-protocol, rescue-prompt-author                 │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Curriculum / training    │ onboarding-journeys, knowledge-tests          │ journey-protocol                                       │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Knowledge curator        │ second-brain, claude-mem, research-log        │ memory-curator, kb-ingestor                            │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Trend-watcher            │ LLM-evals, framework-changelogs               │ trend-ingestor, changelog-watcher, deprecation-tracker │
  ├──────────────────────────┼───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Agent rotation evaluator │ månedlig agent-score                          │ agent-rotation-evaluator, council-convener             │
  └──────────────────────────┴───────────────────────────────────────────────┴────────────────────────────────────────────────────────┘

  Domain-spesialister (eksisterer allerede konseptuelt)

  Cascade-developer (D1-D6 + C1-C4), Schedule-engineer, Onboarding-engineer, Contract-engineer, Payroll-engineer, Helpdesk-engineer, Voice/LiveKit-engineer.

  Sum: ~25 distinkte ekspertiser. Mange dekkes av samme person i tidlig fase. Skill+agent-mappingen gir hver ekspertise et eksekverbart toolkit.

  ---
  4. KONTINUERLIG INNHENTING — tre løkker

  Løkke 1 — Ekstern → oss (kunnskap)

  ┌──────────────────────────────────────────────────────────┬──────────────┬─────────────────────────────────────────┬────────────────────────────────┐
  │                          Kilde                           │   Kadence    │                Mottaker                 │            Trigger             │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Anthropic SDK changelog + model-cards                    │ ukentlig     │ research-log + K1a tag llm-platform     │ scheduled service-agent (cron) │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Next.js / React releases                                 │ ukentlig     │ research-log + flagg breaking           │ changelog-watcher              │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Supabase release-notes + advisories                      │ ukentlig     │ research-log + database-engineer notify │ changelog-watcher              │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ LLM eval-benchmarks (Vellum, Artificial Analysis, lmsys) │ bi-ukentlig  │ research-log + LLM-platform discussion  │ trend-ingestor                 │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Framework security advisories (NPM audit, GitHub)        │ daglig watch │ Sentry + Linear-issue auto-create       │ changelog-watcher              │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Norwegian regulatorisk (Riksavtalen, GDPR-tilsyn, AML)   │ månedlig     │ K1a chunks + compliance-rolle review    │ kb-ingestor                    │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Industri-trender (hospitality SaaS, scheduling)          │ månedlig     │ research-log + product-discussion       │ trend-ingestor                 │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Customer-tickets aggregert                               │ ukentlig     │ research-log + agent-loop-coach input   │ mission-debugger               │
  ├──────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Voice/AI/RAG papers (arxiv tags)                         │ bi-ukentlig  │ research-log curated                    │ trend-ingestor                 │
  └──────────────────────────────────────────────────────────┴──────────────┴─────────────────────────────────────────┴────────────────────────────────┘

  Mekanisme: scheduled service-pool agents. Ingen workspace-data, ingen mission. Cron-driven, emit til activity_trail + skriv til research-log.md +
  claude-mem digest tar opp neste sesjon.

  Løkke 2 — Oss → oss (system-helse)

  ┌───────────────────────────────────────────────────────┬───────────────────────┬──────────────────────────────┬──────────────────────────────────────┐
  │                         Sjekk                         │        Kadence        │            Output            │                Action                │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ BOTSSON-SYSTEM-MAP staleness (verified_against_code > │ daglig                │ PR-blokk + telegram          │ system-map-refresher kjører          │
  │  7d)                                                  │                       │                              │ code-trace                           │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ ADR-drift (random sample)                             │ ukentlig              │ rapport til architect        │ falsifiability-auditor               │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Invariants 11/12/13 + harness invariants              │ hver PR + nightly     │ rød/grønn                    │ invariant-checker                    │
  │                                                       │ full                  │                              │                                      │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ FLOW ↔ telemetry-registry parity                      │ hver PR (CI-gate)     │ block merge                  │ flow-event-validator                 │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ emit() coverage på mutations                          │ hver PR               │ block merge                  │ emit-coverage-checker                │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ engine_memory GC + cap                                │ ukentlig              │ retention-rapport            │ memory-curator                       │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ claude-mem digest + retention                         │ ukentlig              │ digest + cap-håndhevelse     │ memory-curator                       │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Agent stuck-rate per mission                          │ kontinuerlig          │ dashboard + threshold-alert  │ agent-loop-coach                     │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Agent latency vs FLOW.expected_ms                     │ kontinuerlig          │ dashboard + yellow/red flag  │ observability (ADR-0262)             │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Agent kostnad per session                             │ ukentlig              │ rapport til product +        │ agent-rotation-evaluator             │
  │                                                       │                       │ finance                      │                                      │
  ├───────────────────────────────────────────────────────┼───────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Council retrospektiv (hvilke agenter hjelpsomme)      │ månedlig              │ rotation-anbefaling          │ council-convener                     │
  └───────────────────────────────────────────────────────┴───────────────────────┴──────────────────────────────┴──────────────────────────────────────┘

  Mekanisme: kombinasjon av CI-gates (PR-tid), heartbeat-jobs (vault-cron), service-pool agents (kontinuerlig), månedlig retrospektiv (manuell + assistert).

  Løkke 3 — Brukere → oss (produkt-evolusjon)

  ┌────────────────────────────────────┬───────────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────┐
  │               Signal               │                   Kilde                   │           Mottaker           │                Action                │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Stuck-rate per journey             │ engine_state.status='stuck'               │ agent-loop-coach +           │ RESCUE-PROMPT iterasjon              │
  │                                    │                                           │ curriculum                   │                                      │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ RESCUE-aktiveringsrate             │ journey.rescued event                     │ rescue-prompt-author         │ mønster-ekstraksjon                  │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Helpdesk ticket-kategori           │ ADR-0163 ticket=engine_state              │ customer-facing AI ops       │ journey-improvement loop             │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Channel-event-trender              │ channel_event (dead-infra blir live per   │ product + content            │ nye journeys eller mission-mode      │
  │                                    │ ADR-0163)                                 │                              │                                      │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ User-feedback på AI (👍/👎 i       │ recorder.user_flag_submitted (eksisterer  │ session recorder +           │ flag→escalation→retraining           │
  │ Arena)                             │ allerede)                                 │ agent-loop-coach             │                                      │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Journey-completion latency vs      │ FLOW-dashboard                            │ observability                │ latency-budsjett-justering eller     │
  │ expected_ms                        │                                           │                              │ perf-issue                           │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Journey-abandonment-rate           │ engine_state.status='failed' +            │ curriculum + content         │ journey-redesign                     │
  │                                    │ journey.run_failed                        │                              │                                      │
  ├────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
  │ Voice-quality issues               │ LiveKit recording + transcript            │ voice-engineer               │ LiveKit-config eller agent-prompt    │
  └────────────────────────────────────┴───────────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────┘

  Mekanisme: stage-engine emit → activity_trail (immutable) + PostHog (cohort) + engine_event (workflow-trigger). Ukentlig agent-rapport sammenfatter og
  skriver til research-log. Månedlig council-retrospektiv plukker opp og prioriterer.

  ---
  5. LOGGEARKITEKTUR — hvor data lever

  ┌───────────────────────────────────────┬───────────────────┬───────────────────────────────────────────┬─────────────────────────────────────────────┐
  │                  Lag                  │       Eier        │                Mutability                 │                 Brukes til                  │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ activity_trail                        │ Smartout DB       │ append-only                               │ audit, GDPR-eksport, compliance             │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ engine_event                          │ Smartout DB       │ append-only                               │ workflow-automation, event-engine triggers  │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ engine_state + engine_state_step      │ Smartout DB       │ mutable                                   │ live runtime, FLOW-dashboard                │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ engine_memory                         │ Smartout DB       │ mutable, GC'd                             │ agent kontekst, partisjonert per            │
  │                                       │                   │                                           │ mission_id+workspace_id                     │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ agent_session_recording + _envelope + │ Smartout DB       │ append-only, 90d→365d ved flag            │ replay, escalering, godmode-debug           │
  │  _whisper                             │                   │                                           │                                             │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ guardian_log                          │ Smartout DB       │ append-only                               │ C4-decisions audit                          │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ workspace_doc_chunk (K1a + K1b)       │ Smartout DB       │ mutable, versjonert                       │ RAG, regulatorisk, tenant-knowledge         │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ PostHog (EU)                          │ ekstern           │ append-only                               │ analytics, cohort, funnel                   │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Sentry                                │ ekstern           │ append-only                               │ feil-tracking, releases                     │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ LiveKit recordings                    │ ekstern (med      │ append-only, retention-policy             │ voice-replay, debug                         │
  │                                       │ samtykke)         │                                           │                                             │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ claude-mem                            │ lokal LLM-store   │ mutable                                   │ cross-session knowledge, code-observasjoner │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Second Brain v2 (Obsidian)            │ Pontus' vault     │ append-only (research-log, activity-log)  │ menneske-lesbar kunnskap, decisions,        │
  │                                       │                   │ + mutable (wiki)                          │ daglige notater                             │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ docs/decisions/                       │ Git               │ append-only via PR                        │ ADRs, supersede-relasjoner                  │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Linear                                │ ekstern           │ mutable                                   │ issues, tasks, projects                     │
  ├───────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ GitHub PR + CI logs                   │ ekstern           │ append-only                               │ code-history, build-status                  │
  └───────────────────────────────────────┴───────────────────┴───────────────────────────────────────────┴─────────────────────────────────────────────┘

  Cross-pollination: unified_search skill skal kunne søke aktivitetslog + claude-mem + wiki samtidig. Ikke duplisere — krysse-referere via observation-IDs og
   ADR-numre.

  ---
  6. SEKVENS — hvordan vi faktisk drar igang

  ┌──────┬─────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────┐
  │ Uke  │                               Sortie                                │                       Output                        │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 1    │ ADR-0245 (ontology) draft → council → accept                        │ Ontologi låst                                       │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 1-2  │ ADR-0246 + 0250 + 0251 + 0252 (infra-fundament)                     │ base.yml ren, voice-agent navngitt, ports korrigert │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 2    │ ADR-0247 + 0248 (Arena-as-platform)                                 │ Mission-pool kontrakt vedtatt                       │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 3    │ Skriv Harness Candidate-test (rødt)                                 │ CI-gate på plass                                    │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 3-4  │ Bygg arena-builder + agent-sdk-builder skills                       │ Tooling klar                                        │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 4    │ Mission-pool worker prototype + admin-onboarding pilot              │ Harness Candidate grønt                             │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 5    │ ADR-0253 (stuck-detector reaktiver)                                 │ Død kode aktiv                                      │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 5    │ ADR-0254 (FLOW.md status) + flow-event-validator skill              │ Dashboard kan implementeres                         │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 6    │ Service-pool + ADR-writer pilot (off-Arena)                         │ Begge klasser bevist                                │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 6-7  │ Botsson migrert til mission-pool (B1 ontologi-konsolidering)        │ En kjent agent kjører på Arena                      │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 7    │ support-tier-1 mission på ADR-0163 ticket=engine_state              │ Customer-facing klasse live                         │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 8+   │ Trend-ingestor + system-map-refresher + memory-curator (governance) │ Løkkene starter                                     │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 9-10 │ ADR-0256-0265 governance-pakken                                     │ Maintenance-policy fullført                         │
  ├──────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 11+  │ Skalering                                                           │ Ny agent = ny manifest, ingen kjernekode            │
  └──────┴─────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────┘

  ---
  7. Hva trengs fra deg

  1. Bekreft scope. 21 ADR + 24 skills + 3 løkker er stort. Skal vi:
    - a. Kjøre alt parallelt i campaign/botsson-arena med strenge phase-gates
    - b. Splitte i to campaigns: campaign/arena-runtime (build) + campaign/system-loops (governance)
    - c. Først ADR-0245 + 0246 + 0247 isolert (3 uker), så vurdere resten

  Anbefaler c. ADR-0245 ontologi er load-bearing — uten det tegner vi luftslott. 3 uker bevis-leveranse, så reskopere.
  2. Hvor lever skill-definisjonene? Repo-lokal .claude/skills/ (versjonert med kode) eller global ~/.claude/skills/ (delt mellom prosjekter)? Anbefaler
  repo-lokal for de prosjekt-spesifikke (arena-builder, harness-verifier etc.), global for de generiske (adr-writer, council-convener).
  3. Vil du at jeg drar ADR-0245 (ontologi) draft først? Det er det eneste som må være vedtatt før resten kan tegnes ferdig. Resten av lista kan vi
  parallellisere i council.

✻ Churned for 3m 37s

❯ Det var bra, det liker jeg. Skal vi ta inn Councilet og høre hva de tenker, eller skal vi kjøre solo? Jeg vet ikke om vi trenger så mye i spilet. Det
  eneste jeg skulle behøve fra deg er ... Vi trenger å ha Heartbeat. Vi trenger å ha et gjennomgående heartbeat som slår stadig. Og hele tiden kan trigge...
   Eller som, og dette heartbeatet... Det bare... Vi har en funksjon som lytter på dette heartbeatet, som bare ser etter en ... Ja, i grunn og bunn så er
  det et mission. Det er et mission. Heartbeat slår, jevnt og trygt. Det er en mission som ligger med en deadline som er tidligere enn dagens dato, eller
  dovanrundato. Eller, eller mener jeg, at det er past. så sendes det til en agent som leser missionet og starter utføringen av stegene. Og der kobler vi på
   stage engine for at mission inneholder steg. Og det første som skjer er at når en agent leser et mission, så kobler de på seg på stage, agenten putter
  inn det missionet og stage engine vil kontrollere og sørge for at hvert steg blir utført. Det er også sånn jeg ønsker at vi bedriver både utviklingen og
  hvordan vi på en måte setter opp hele strukturen. Dette skal være AI-drevet. Vi skal bare, du og jeg skal bare pille litt.

● Heartbeat-as-mission-dispatcher — selvbyggende harness

  Avgjørelse: solo med ett unntak

  ┌─────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                   Beslutning                    │                                         Solo eller council                                         │
  ├─────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ADR-0245 ontologi (engine_state vs              │ Council. Load-bearing på tvers av capabilities + stage-engine + Botsson + mobile + journey-engine. │
  │ engine_sessions)                                │  Ett ADR.                                                                                          │
  ├─────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Alt annet (infra, harness, skills, governance)  │ Solo. Du + jeg piller. Heartbeat eksekverer.                                                       │
  └─────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Hvorfor unntak: ontologi-feil = re-write 6 mnd senere. Resten = pluggning, kan refaktoreres.

  Det du beskrev = "missions all the way down"

  heartbeat (cron, hvert Nm)
     ↓ SELECT engine_state WHERE status='scheduled' AND scheduled_for <= now()
     ↓ pg_notify('mission-pool', mission_id)
  mission-pool worker
     ↓ leser MISSION.md + LICENSE.md + RESCUE-PROMPT.md fra docs/journeys/<slug>/
     ↓ henter FLOW.md spine
  agent boot
     ↓ kobler på stage-engine
  stage-engine driver
     ↓ per FLOW-row: tool-call → gatedMutation → emit → advance step
     ↓ terminal: journey.completed | journey.stuck | journey.run_failed

  Samme mønster for produkt OG utvikling. ADR-skriving = mission. Schema-migrasjon = mission. System-map-refresh = mission. Trend-ingestion = mission. Vi
  bygger Smartout med Smartout.

  Schema-tillegg (minimalt)

  To nullable kolonner på engine_state:

  ALTER TABLE engine_state ADD COLUMN scheduled_for timestamptz;     -- null = run-now
  ALTER TABLE engine_state ADD COLUMN recurrence interval;           -- null = one-shot

  Det er hele utvidelsen. Heartbeat-dispatcher er ~30 linjer SQL + Edge Function.

  Mission-typer

  ┌───────────┬─────────────────────────────────────────┬──────────────────────┐
  │   Type    │                Eksempel                 │      Recurrence      │
  ├───────────┼─────────────────────────────────────────┼──────────────────────┤
  │ One-shot  │ "skriv ADR-0246 base.yml consolidation" │ NULL                 │
  ├───────────┼─────────────────────────────────────────┼──────────────────────┤
  │ Recurring │ "system-map-refresh"                    │ '7 days'             │
  ├───────────┼─────────────────────────────────────────┼──────────────────────┤
  │ Triggered │ "ADR-drift detected → kjør code-trace"  │ NULL, fyrer på event │
  ├───────────┼─────────────────────────────────────────┼──────────────────────┤
  │ Customer  │ admin-onboarding, support-tier-1        │ NULL                 │
  └───────────┴─────────────────────────────────────────┴──────────────────────┘

  Recurring re-scheduler seg selv på terminal: UPDATE engine_state SET scheduled_for = now() + recurrence, status='scheduled' ved completion.

  Heartbeat-klasser (to, ikke én)

  ┌──────────────────────────────┬───────────────────────────────────────────┬──────────────────────────────────────────────────────┐
  │            Klasse            │                    Hva                    │                         Hvor                         │
  ├──────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Vault-heartbeat (eksisterer) │ wiki-health, raw-inbox, dashboard-refresh │ ~/.claude/skills/heartbeat + HEARTBEAT.md i vault    │
  ├──────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ System-heartbeat (ny)        │ mission-dispatcher i Arena                │ Edge Function eller cron-service, polls engine_state │
  └──────────────────────────────┴───────────────────────────────────────────┴──────────────────────────────────────────────────────┘

  Vault-heartbeat snakker ikke med Arena. System-heartbeat eier mission-dispatch. Begge logger til activity_trail.

  Hvordan vi ("du og jeg piller")

  Du:    "skriv ADR-0246"
  Jeg:   skriv mission-folder docs/journeys/adr-0246-base-consolidation/
         MISSION.md, LICENSE.md, RESCUE-PROMPT.md, FLOW.md
         commit til feat/adr-0246
         insert engine_state row, status='draft', scheduled_for=null
  Du:    review folder, godkjenn → status='scheduled', scheduled_for=now()
  Heartbeat: plukker opp innen Nm
  Worker: kjører FLOW (compose ADR draft, register i decision-log, push)
          terminal: emit journey.completed
  Du:    review PR, merge

  Same patron for capability-bygging, skill-definisjoner, schema-migrasjon. Ingen mission kjører uten din is_active=true. Ingen kommando, ingen
  skript-orkestrering.

  Hva som faktisk må bygges først

  ┌──────┬──────────────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────┐
  │ Steg │                                              Output                                              │            Hvem             │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 0    │ ADR-0245 ontologi til council                                                                    │ én ekstern beslutning       │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 1    │ ADR-0246 base.yml + heartbeat-mission-bevis (skriv ADR-0246 SOM mission, la heartbeat dispatche) │ bevis at meta-loopen funker │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 2    │ engine_state.scheduled_for + recurrence migrasjon                                                │ én migrasjon                │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 3    │ System-heartbeat dispatcher (Edge Function eller cron)                                           │ én service                  │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 4    │ Mission-pool worker (én slot, picker mission_id, kjører FLOW)                                    │ én container                │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 5    │ Recurring mission: system-map-refresh hver 7d                                                    │ bevis på recurrence         │
  ├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ 6    │ Trigger mission: linear-issue → ADR-mission                                                      │ bevis på event-trigger      │
  └──────┴──────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────┘

  Etter steg 6 er hele governance-løkka selvbyggende. Vi piller, heartbeat slår, agenter eksekverer.

  Hva collapsen betyr for forrige liste

  ┌────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────┐
  │            Forrige             │                                         Nå                                         │
  ├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ 21 ADRs som separate jobber    │ Hver ADR = mission. Skrives av ADR-writer-mission utløst av Linear-issue eller du. │
  ├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ 24 skills som separate verktøy │ Skills brukes inne i missions. Mission-folder lister hvilke skills den krever.     │
  ├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ 3 governance-løkker            │ 3 mission-templates med recurrence-felt. Heartbeat dispatcher dem.                 │
  ├────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ Council for hver beslutning    │ Council kun for load-bearing ontologi. Resten = mission med human-approval gate.   │
  └────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────┘