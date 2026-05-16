---
title: "Botsson Soul Snapshot — append-only audit trail per agent-run"
id: ADR_0330
status: proposed
layer: decision
created: 2026-05-15
updated: 2026-05-15
---

# ADR-0330: Botsson Soul Snapshot — append-only audit trail per agent-run

**Status:** Proposed
**Date:** 2026-05-15

## Context and Problem Statement

Når Botsson svarer eller handler, har vi i dag begrenset evne til å rekonstruere hvorfor. `engine_sessions` lagrer conversation. `activity_trail` lagrer hva som ble gjort. Men ingen rad lagrer hvilken **identitet, posture, voice-config, modell, kontekst, minne, autoritet, og verktøy-utvalg** som var aktivt på runtime-tidspunktet.

Når Soul Contract ([ADR-0329](0329-botsson-soul-server-compilation.md)) blir server-kompilert, er det åpenbart hva som mangler: en append-only snapshot per run som dokumenterer alle løste lag, inklusive hvilke verktøy som ble tilbudt og hvilke som ble filtrert vekk og hvorfor.

## Decision Drivers

- Brukeren rapporterer "Botsson oppfører seg annerledes nå" — vi må kunne diffe to runs.
- Capability-tool eval (regression-testing) krever reprodusérbar input-output.
- ADR-0151-class bugs (silent identity drift) må kunne fanges via snapshot.
- GDPR / compliance: hvis Botsson tar en avgjørelse, må vi kunne forklare beslutnings-konteksten.
- Soul Contract versjoneres (`contract_version`) — vi må kunne spore migrering.

## Considered Options

1. **No-op — bare logge til `activity_trail`**. Rejected — for grov, mangler tool-bundle + posture-akser.
2. **Logge til eksisterende `engine_sessions.collected_data`**. Rejected — sesjons-bundet, ikke per-run, og blandes med conversation-data.
3. **Dedikert `botsson_soul_snapshot` tabell, append-only, per agent-run**. Chosen.

## Decision Outcome

Hver agent-run (chat-turn ELLER voice-respons) produserer én rad i `botsson_soul_snapshot` FØR generateText/Realtime-kall. Rad inneholder:

- `contract_version` (string, semver-aktig)
- `resolved_identity`, `resolved_posture`, `resolved_voice`, `resolved_model_policy` (jsonb)
- `context_refs`, `memory_refs` (jsonb — IDer + hasher, ikke full content)
- `authority_summary` (jsonb)
- `tools_offered`, `tools_filtered` (jsonb, sistnevnte med `reason`)
- `input_hash`, `prompt_hash`, `tool_bundle_hash` (string, sha256)
- `created_at` (timestamptz)
- `pii_present` (boolean) + `retention_days` (int, default 30)

**Retention policy:** hot 30 dager i tabellen; arkivert til Supabase Storage `botsson-soul-archive/` etter 30d; slettet etter 365d med mindre `pii_present=false` (da kan beholdes lenger for eval).

**RLS:** `resolved_instruction_overlay` og `context_refs` skjules fra alle untatt platform-admin når `pii_present=true`. Andre kolonner: workspace-admin kan lese sin workspace; user kan lese egne snapshots.

## Rules & Consequences enforced for Agents

- **Good, because** alle agent-runs er reproduserbare for debug + eval + regression-test.
- **Good, because** Soul Contract-migreringer kan diffe pre/post-versjon.
- **Good, because** capability-tool authoring kan se faktiske tools-filtered + reason.
- **Bad, because** ~5 KB per run × ~1000 chat-runs/dag = ~1.8 GB/år før arkivering. Mitigert via 30d hot + Storage cold archive.
- **Bad, because** krever skrivetilgang per run — må være SECURITY DEFINER + idempotent på hash-collision.

**Agent Impact:**
- `system-agent-coordinator`: lese `botsson_soul_snapshot` ved debug av "hvorfor svarte Botsson sånn".
- Eval-pipelines: bruke snapshot som canonical input-spec for replay.
- `adr-contract-audit`: verifisere at hver agent-run produserer snapshot (skriv-invariant).

## Cross-references

- [ADR-0329](0329-botsson-soul-server-compilation.md) — paret beslutning (Soul Contract)
- `docs/modules/botsson-soul-docs/05-data-model.md` — `botsson_soul_snapshot` tabell-DDL
- [ADR-0167](0167-credential-tokens-censored-in-telemetry.md) — token-redaksjon (samme prinsipp for PII i snapshots)
- [ADR-0297](0297-workforce-snapshot-bootstrap.md) — context_refs-mønster (D2+D6 snapshot)
