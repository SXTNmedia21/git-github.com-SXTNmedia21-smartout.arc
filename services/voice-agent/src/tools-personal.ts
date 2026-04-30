// tools-personal.ts — Personal-utility tool wrappers for the LiveKit voice agent.
//
// Five thin LLM-tools that forward to stage-engine via the existing `ask()` pipe
// (same as all tools in adapter.ts). Each tool's description is specific enough
// for GPT (Realtime) to pick the right one vs. query_smartout fallback.
//
// Tool descriptions are Norwegian — matching the user language and the stage-engine
// system prompt. GPT uses these to decide which tool to call.
//
// Integration: import `personalTools` and spread into `smartoutTools` in adapter.ts.
// Do NOT modify any existing tool in adapter.ts.

import { llm } from "@livekit/agents";

// Type for the ask() helper imported from adapter.ts.
// We declare the type here and pass ask as a parameter to avoid circular imports.
// The factory pattern lets adapter.ts inject its ask() function.

type AskFn = (query: string, label: string) => Promise<string>;

export function buildPersonalTools(ask: AskFn) {
  return {
    // ── add_note ─────────────────────────────────────────────────────────────
    add_note: llm.tool({
      description: [
        "Lagre et raskt notat for brukeren.",
        'Bruk når brukeren sier "noter", "skriv ned", "husk dette", "notat:", "ta notat".',
        "Tags er valgfrie emneord.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Notatets innhold i brukerens egne ord.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: 'Valgfrie emneord, f.eks. ["møte", "viktig"]. Maks 10.',
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
      execute: async ({ text, tags }: { text: string; tags?: string[] }) => {
        const tagsPart = tags && tags.length > 0 ? ` Tags: ${tags.join(", ")}.` : "";
        return ask(`Lagre notat: "${text}".${tagsPart}`, `add_note`);
      },
    }),

    // ── create_task ──────────────────────────────────────────────────────────
    create_task: llm.tool({
      description: [
        "Lag en personlig oppgave med valgfri frist og prioritet.",
        'Bruk når brukeren sier "gjør X i morgen", "minn meg om Y", "jeg må huske å Z",',
        '"legg til oppgave", "ny oppgave". Bruk set_reminder i stedet hvis brukeren',
        "vil ha en varsling på et eksakt klokkeslett.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: 'Oppgavebeskrivelse, f.eks. "Ring leverandøren om bestillingen".',
          },
          due_at: {
            type: "string",
            description:
              'Valgfri frist i ISO-8601, f.eks. "2026-05-22T12:00:00+02:00". ' +
              "Regn ut absolutt tid fra relative uttrykk.",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
            description: "Prioritet: low, normal, high, urgent. Standard: normal.",
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
      execute: async ({
        title,
        due_at,
        priority,
      }: {
        title: string;
        due_at?: string;
        priority?: string;
      }) => {
        const duePart = due_at ? ` Frist: ${due_at}.` : "";
        const prioPart = priority && priority !== "normal" ? ` Prioritet: ${priority}.` : "";
        return ask(`Lag oppgave: "${title}".${duePart}${prioPart}`, `create_task`);
      },
    }),

    // ── set_reminder ─────────────────────────────────────────────────────────
    set_reminder: llm.tool({
      description: [
        "Sett en påminnelse til et bestemt klokkeslett eller tidspunkt.",
        'Bruk når brukeren sier "minn meg klokken X", "om en time", "minn meg i morgen tidlig",',
        '"varsle meg når". Skiller seg fra create_task ved at det utløser en aktiv varsling.',
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Hva brukeren skal minnes på.",
          },
          fire_at: {
            type: "string",
            description:
              'Absolutt tidspunkt for varslingen i ISO-8601, f.eks. "2026-05-20T14:00:00+02:00". ' +
              'Regn ut fra relative uttrykk ("om en time" → nå + 1t).',
          },
        },
        required: ["text", "fire_at"],
        additionalProperties: false,
      },
      execute: async ({ text, fire_at }: { text: string; fire_at: string }) =>
        ask(`Sett påminnelse: "${text}" kl ${fire_at}.`, `set_reminder`),
    }),

    // ── get_history ──────────────────────────────────────────────────────────
    get_history: llm.tool({
      description: [
        "Hent brukerens siste aktivitet og hendelser.",
        'Bruk når brukeren sier "hva har jeg gjort", "mine siste handlinger",',
        '"hva skjedde tidligere i dag", "vis min aktivitet", "siste hendelser".',
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              'Valgfritt: filtrer på kategori, f.eks. "scheduling", "training", "contracts".',
          },
          limit: {
            type: "integer",
            description: "Antall hendelser. Standard 10, maks 50.",
          },
        },
        additionalProperties: false,
      },
      execute: async ({ category, limit }: { category?: string; limit?: number }) => {
        const catPart = category ? ` Kategori: ${category}.` : "";
        return ask(
          `Vis mine siste ${limit ?? 10} hendelser.${catPart}`,
          `get_history[${limit ?? 10}]`,
        );
      },
    }),

    // ── update_setting ───────────────────────────────────────────────────────
    update_setting: llm.tool({
      description: [
        "Oppdater en personlig innstilling eller preferanse.",
        'Bruk når brukeren sier "sett min preferanse", "endre min [innstilling]",',
        '"jeg foretrekker", "sett standard [X] til [Y]".',
        "Innstillingen lagres og huskes automatisk av agenten neste gang.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              'Innstillingsnøkkel, f.eks. "foretrukket_vakttype", "tiltaleform", "foretrukket_avdeling".',
          },
          value: {
            type: "string",
            description: 'Ny verdi, f.eks. "kveldsvakt", "du", "kjøkken".',
          },
        },
        required: ["key", "value"],
        additionalProperties: false,
      },
      execute: async ({ key, value }: { key: string; value: string }) =>
        ask(`Oppdater innstilling: ${key} = "${value}".`, `update_setting[${key}]`),
    }),
  };
}
