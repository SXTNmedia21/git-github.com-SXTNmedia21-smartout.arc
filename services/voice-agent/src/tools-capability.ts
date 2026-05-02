// tools-capability.ts — Domain capability query tools for the LiveKit voice agent.
//
// Each tool here is a Norwegian-language-described LLM tool that forwards
// a specific natural-language query to stage-engine via the ask() pipe.
// Stage-engine's intent-classifier routes to the right capability tool.
//
// All tools here are voice-safe (no Høy-PII, no mutations). Chat-only
// capability features (payroll, AML validation, contract mutations) are
// deliberately NOT exposed here — stage-engine's channel guard (ADR-0078
// Layer 3) would reject them with a "bruk chat" message anyway.
//
// Tools that proxy to capabilities with mixed channel policies forward
// the query and rely on the stage-engine layer-3 guard. This is defence-
// in-depth: the voice-agent doesn't duplicate the guard logic.
//
// Integration: import buildCapabilityQueryTools and spread into the tools
// object in adapter.ts.

import { llm } from "@livekit/agents";

type AskFn = (query: string, label: string) => Promise<string>;

/**
 * Build capability-proxying tools for the LiveKit voice session.
 * @param ask — stage-engine proxy function from adapter.ts
 */
export function buildCapabilityQueryTools(ask: AskFn) {
  return {
    // ── query_smartout (fallback) ─────────────────────────────────────────────
    query_smartout: llm.tool({
      description: [
        "Generell forespørsel til Smartout-systemet.",
        "Bruk dette verktøyet for alle spørsmål som ikke passer andre verktøy.",
        "Systemet vil automatisk finne riktig verktøy basert på meldingen.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Spørsmålet eller oppgaven på norsk.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      execute: async ({ query }: { query: string }) => ask(query, "query_smartout"),
    }),

    // ── get_my_shifts ─────────────────────────────────────────────────────────
    // Routes to schedule capability → get_my_shifts tool.
    get_my_shifts: llm.tool({
      description: [
        "Hent brukerens kommende vakter.",
        'Bruk når brukeren sier "hva er vakten min", "når jobber jeg", "vis mine vakter",',
        '"hvilken vakt har jeg i dag/i morgen/denne uken".',
        "Returnerer vaktliste med tidspunkt og avdeling.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          days: {
            type: "integer",
            description: "Antall dager frem i tid. Standard 7.",
            default: 7,
          },
        },
        additionalProperties: false,
      },
      execute: async ({ days = 7 }: { days?: number }) =>
        ask(`Hent mine kommende vakter de neste ${days} dagene.`, "get_my_shifts"),
    }),

    // ── get_my_missions ───────────────────────────────────────────────────────
    // Routes to mission capability → getActiveMissions + getWorkspaceRoadmap.
    get_my_missions: llm.tool({
      description: [
        "Hent brukerens aktive misjoner og arbeidsplassens fremover-plan.",
        'Bruk når brukeren sier "hva er misjonen min", "hva skjer fremover",',
        '"hva burde jeg gjøre nå", "oppdrag", "roadmap", "fremgang".',
        "Returnerer aktive misjoner med status og neste steg.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        ask("Hva er mine aktive misjoner og hva burde jeg gjøre videre?", "get_my_missions"),
    }),

    // ── cite_legal_paragraph ──────────────────────────────────────────────────
    // Routes to legal capability → cite_law tool (chat + voice, no PII).
    cite_legal_paragraph: llm.tool({
      description: [
        "Slå opp og siter et norsk lovparagraf (Aml., ferieloven, OTP, Riksavtalen, osv.).",
        'Bruk når brukeren sier "hva sier loven om", "hva er §", "ferieloven sier",',
        '"kan arbeidsgiver", "har jeg rett til", "lovkrav". Returnerer paragraftekst og kilde.',
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          question: {
            type: "string",
            description: "Spørsmålet om norsk lov, f.eks. «hva sier §14-6 om ansettelsesavtaler?».",
          },
        },
        required: ["question"],
        additionalProperties: false,
      },
      execute: async ({ question }: { question: string }) =>
        ask(`Siter lovparagraf: ${question}`, "cite_legal_paragraph"),
    }),

    // ── get_training_progress ─────────────────────────────────────────────────
    // Routes to training capability.
    get_training_progress: llm.tool({
      description: [
        "Hent brukerens opplæringstatus og fremgang.",
        'Bruk når brukeren sier "hva mangler jeg av opplæring", "opplæringsplan",',
        '"har jeg fullført kursene", "sertifiseringer", "kompetansestatus".',
        "Returnerer modul-liste med fullføringsstatus.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        ask("Hva er min opplæringstatus og hva gjenstår?", "get_training_progress"),
    }),

    // ── get_helpdesk_status ───────────────────────────────────────────────────
    // Routes to helpdesk_query capability → list_my_queue.
    get_helpdesk_status: llm.tool({
      description: [
        "Hent status på åpne helpdesk-saker.",
        'Bruk når brukeren sier "er saken min løst", "helpdesk", "support-sak",',
        '"hva skjer med spørsmålet mitt", "tickets", "saker".',
        "Chat-spesifikke svar (PII i saker) håndteres i chat-kanalen.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () => ask("Hva er status på mine åpne helpdesk-saker?", "get_helpdesk_status"),
    }),

    // ── get_my_profile ────────────────────────────────────────────────────────
    // Routes to profile capability → get_profile (read-only).
    get_my_profile: llm.tool({
      description: [
        "Hent brukerens profil og rolle.",
        'Bruk når brukeren sier "hvem er jeg", "min profil", "min rolle",',
        '"hvilken avdeling er jeg i", "min stilling", "mine detaljer".',
        "Returnerer navn, rolle, avdeling og status.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        ask("Hent min profil — navn, rolle, avdeling, status.", "get_my_profile"),
    }),

    // ── get_operations_summary ────────────────────────────────────────────────
    // Routes to operations + operations_intelligence capabilities.
    get_operations_summary: llm.tool({
      description: [
        "Hent operasjonell status og varsler for avdelingen.",
        'Bruk når brukeren sier "hva skjer på jobben", "driftstatus", "varsler",',
        '"avviksrapport", "operasjoner", "løpende hendelser".',
        "Returnerer aktive operasjonelle hendelser og prioriterte varsler.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        ask(
          "Hva er operasjonell status og eventuelle varsler for min avdeling?",
          "get_operations_summary",
        ),
    }),

    // ── get_shift_swap_status ─────────────────────────────────────────────────
    // Routes to shift_swap capability.
    get_shift_swap_status: llm.tool({
      description: [
        "Sjekk status på vaktbytte-forespørsler.",
        'Bruk når brukeren sier "er vaktbyttet godkjent", "vaktbytte-status",',
        '"hvem bytter vakt med meg", "bytte-forespørsel".',
        "Endringer i vaktbytte gjøres via chat for bekreftelse.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        ask("Hva er status på mine vaktbytte-forespørsler?", "get_shift_swap_status"),
    }),

    // ── get_governance_summary ────────────────────────────────────────────────
    // Routes to governance capability (read-only summary).
    get_governance_summary: llm.tool({
      description: [
        "Hent oversikt over styringsvedtak og åpne forslag.",
        'Bruk når brukeren sier "åpne vedtak", "governance", "endringer som er til godkjenning",',
        '"styringsstatus", "change proposals".',
        "Sensitiv detaljer og godkjenninger håndteres i chat-kanalen.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        ask(
          "Gi meg en oversikt over åpne styringsvedtak og endringsforslag.",
          "get_governance_summary",
        ),
    }),

    // ── get_knowledge ─────────────────────────────────────────────────────────
    // Routes to kb_query capability → knowledge base articles.
    get_knowledge: llm.tool({
      description: [
        "Søk i arbeidsplassens kunnskapsbase.",
        'Bruk når brukeren sier "hva er prosedyren for", "policy for",',
        '"rutine for", "regler for", "hvordan gjør jeg".',
        "Returnerer relevante prosedyrer og retningslinjer.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          topic: {
            type: "string",
            description: "Emnet det søkes etter, f.eks. «stengeprosedyre» eller «matvarehygiene».",
          },
        },
        required: ["topic"],
        additionalProperties: false,
      },
      execute: async ({ topic }: { topic: string }) =>
        ask(`Søk i kunnskapsbasen etter: ${topic}`, "get_knowledge"),
    }),
  };
}
