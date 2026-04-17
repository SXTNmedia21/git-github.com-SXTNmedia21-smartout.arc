---
title: "Billing Integration Adapter Pattern + Placeholder Audit-Safety"
id: ADR-0129
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0129: Billing Integration Adapter Pattern + Placeholder Audit-Safety

## Context and Problem Statement

Billing Fase 2 Spor B bygger et adapter-basert rammeverk for eksterne integrasjoner (Fiken, Tripletex, senere Stripe). Fase 2 shipper ingen ekte integrasjon — kun rammeverket pluss en `PlaceholderAdapter` som demonstrerer formen og lar UI-en testes. Problemet: En placeholder-adapter som returnerer "success" og skriver til audit-tabeller skaper falsk signal — audit-sporet viser "sync succeeded" uten at noe faktisk skjedde eksternt. Council-syntese (Supervisor + Agent Coordinator) flagget at UI-badge "placeholder" ikke er nok: auditbarheten må være garantert på dataplanet.

## Decision Drivers

- **Audit-ærlighet:** `billing_activity_log` og `engine_state_step.output` er juridisk + operasjonelle audit-kilder. "Success" må bety faktisk ekstern effekt.
- **Forward compat:** Fase 3 bytter `PlaceholderAdapter` ut med `FikenAdapter`, `StripeConnectAdapter` etc. Bytte må skje uten skjema-endring.
- **Test-ergonomi:** Utviklere må kunne koble en placeholder-integrasjon i dev/staging uten å forurense audit-trailen.
- **Platform-prinsipp:** Samme `IntegrationAdapter`-interface for alle — enten de er ekte eller placeholder. Gate oppførselen via data, ikke via type-switch.

## Considered Options

1. **Sub-type klasse** — `PlaceholderIntegrationAdapter` sub-klasser `IntegrationAdapter`, UI viser warning, men audit-trail er identisk med ekte adaptere. *(Avvist — audit-sporet lyver.)*
2. **Runtime-gate på `is_placeholder` kolonne** — én `is_placeholder boolean` på `billing_integration`. Alle readere av audit-data filtrerer ut eller flagger placeholder-rader. Placeholder-adapter emitter egen event `integration sync mocked` (IKKE `succeeded`). *(Valgt.)*
3. **Helt separat tabell for placeholder-syncs** — `billing_integration_sync_mock`. *(Avvist — bryter ADR-0126 (ingen ny orkestreringstabell); duplisert logikk.)*

## Decision Outcome

Chosen option: **"Runtime-gate på `is_placeholder` kolonne"**, fordi det bevarer én arkitektur men gjør audit-ærligheten garantert på dataplanet.

**Interface-kontrakt (`packages/billing/src/integrations/types.ts`):**

```ts
export type IntegrationAdapter = {
  type: BillingIntegrationType;  // 'fiken' | 'tripletex' | 'stripe' | 'placeholder'
  supports: IntegrationEntity[];
  sync(input: SyncInput): Promise<SyncResult>;
  testConnection(integration: BillingIntegration): Promise<TestConnectionResult>;
};
```

**`billing_integration` schema (Fase 2, B1):**

| Felt | Type | Audit-adferd |
|------|------|--------------|
| `integration_id` | uuid PK | — |
| `integration_type` | enum | — |
| `is_placeholder` | bool default false | **TRUE → adapter må emitte `integration sync mocked`, IKKE `integration sync succeeded`** |

**Placeholder-adapter-kontrakt:**

```ts
export class PlaceholderAdapter implements IntegrationAdapter {
  type = 'placeholder' as const;
  async sync(input: SyncInput): Promise<SyncResult> {
    // MÅ emitte 'integration sync mocked' (ikke 'succeeded')
    // MÅ prefikse billing_activity_log message med '[PLACEHOLDER]'
    return { status: 'mocked', external_reference: null };
  }
  async testConnection(): Promise<TestConnectionResult> {
    return { status: 'ok', is_placeholder: true };
  }
}
```

**SyncResult type utvidet:**

```ts
export type SyncResult =
  | { status: 'succeeded'; external_reference: string }
  | { status: 'mocked'; external_reference: null }   // NY — placeholder-only
  | { status: 'failed'; error_code: string; error_message: string };
```

**`action_type='sync_integration'` handler-ansvar:**

1. Last `billing_integration`-rad.
2. Velg adapter basert på `integration_type`.
3. Kall `adapter.sync(input)`.
4. Basert på `result.status`:
   - `succeeded` → emit `integration sync succeeded`
   - `mocked` → emit `integration sync mocked` + prefix audit-message med `[PLACEHOLDER]`
   - `failed` → emit `integration sync failed`
5. Assertion: hvis `integration.is_placeholder = true` og adapter returnerer `succeeded` → handler kaster feil + emitter `integration audit violation`. Fail-safe beskyttelse.

**UI-krav:**

- Platform-admin integrasjonsliste viser placeholder med eksplisitt badge `[Placeholder — ingen ekstern effekt]` (Nordic Split warning-color; ikke blandbar med ekte statusindikator).
- Sync-historikk viser `[PLACEHOLDER]`-prefikset audit-rader i muted-tone; ekte integrations-rader i default-tone.
- `testConnection`-resultat for placeholder har egen UI-state "placeholder ok" som IKKE er gjenbrukbar med ekte "ok".

**Fremtidig migrasjon (Fase 3):**

Når ekte integrasjoner (Fiken, Stripe) landes:
- Ny `FikenAdapter` implementerer `IntegrationAdapter` — samme interface.
- `billing_integration.is_placeholder = false` ved INSERT.
- Ingen skjema-endring. Ingen handler-endring utover adapter-registry.

## Rules & Consequences

- **Good, because** audit-ærlighet garanteres på dataplanet — UI-fjerning kan ikke re-introdusere falsk signal
- **Good, because** én interface for alle adaptere — forward-compat er ren
- **Good, because** assertion-gate fanger fremtidige feil (ekte adapter markert som placeholder eller omvendt)
- **Bad, because** utviklere må huske å emitte rett event fra adapter-implementasjonen — litt disiplin-krav
- **Bad, because** to `succeeded`-semantikker (`succeeded` + `mocked`) betyr at readere av billing_activity_log må håndtere begge — litt ekstra switch-logikk
- **Agent Impact:** Alle nye adapter-implementasjoner MÅ følge denne kontrakten. Code-review sjekker: (a) emitter placeholder `mocked`-event, (b) ekte adapter kaster feil hvis `is_placeholder = true`. B1 pgTAP-test validerer `is_placeholder` kolonne eksisterer + har default FALSE.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
