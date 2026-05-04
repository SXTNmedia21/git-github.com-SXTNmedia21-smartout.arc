"use client";

import { useState } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { CHAPTERS, type ChapterKey } from "./chapters";
import type { JSONContent } from "@tiptap/core";

type TemplateItem = {
  id: string;
  label: string;
  content: JSONContent;
};

// Static templates derived from the engine handbook structure
// Each chapter has bullet-point templates that match the restaurant handbook template
const CHAPTER_TEMPLATES: Record<ChapterKey, TemplateItem[]> = {
  "identity-mission": [
    {
      id: "identity-full",
      label: "Komplett identitetsmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Identitet og Misjon" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Misjonserkl\u00e6ring" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Beskriv bedriftens misjon og hvorfor den eksisterer. Hva er kjerneoppdraget?",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Servicel\u00f8fte" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hva lover vi v\u00e5re gjester? Hvilken opplevelse skal de sitte igjen med?",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Beredskapsdefinisjon" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: 'N\u00e5r er en ansatt "klar"? Definer kriteriene for ansatt- og skiftberedskap.',
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Merkevaretone" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hvordan kommuniserer vi? Formelt, uformelt, profesjonelt? Beskriv tonen.",
              },
            ],
          },
        ],
      },
    },
  ],
  "organization-model": [
    {
      id: "org-full",
      label: "Organisasjonsstruktur",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Organisasjonsmodell" }],
          },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Avdelinger" }] },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "List opp alle avdelinger med form\u00e5l og ansvarsomr\u00e5de.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Team og Ledelse" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Definer team, teamledere og rapporteringslinjer." }],
          },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Rollestige" }] },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Beskriv rollene fra ansatt til leder, med ansvar og forventninger.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Beslutningsmyndighet" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hvem bestemmer hva? Definer beslutningsgrenser per rolle." },
            ],
          },
        ],
      },
    },
  ],
  "daily-operations": [
    {
      id: "ops-full",
      label: "Daglig driftmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Daglig Drift" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "\u00c5pningsrutine" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Standard sekvens for \u00e5pning. Hvem gj\u00f8r hva, n\u00e5r?",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Midt-skift Kontroll" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Kontrollpunkter midt i servicen. Hva sjekkes?" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Lukking og Overlevering" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Lukkesekvens og overleveringsrutine til neste skift." },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Event-dag Varianter" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Spesielle regler for eventdager, helligdager, eller h\u00f8ysesong.",
              },
            ],
          },
        ],
      },
    },
  ],
  "safety-compliance": [
    {
      id: "safety-full",
      label: "Sikkerhetsmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Sikkerhet og Etterlevelse" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Mattrygghet" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "HACCP-krav, temperaturkontroll, holdbarhet og merking." },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Hygiene og Sanitasjon" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Rutiner for h\u00e5ndvask, renhold, desinfisering og personlig hygiene.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Allergenh\u00e5ndtering" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Protokoll for allergener: identifisering, merking, kommunikasjon til gjest.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Alkohol og Alderskontroll" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Skjenkeregler, aldersverifisering, ansvarsfullt alkoholsalg.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Brannvern og Evakuering" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "R\u00f8mningsveier, slukningsutstyr, \u00f8velser og ansvarlig person.",
              },
            ],
          },
        ],
      },
    },
  ],
  communication: [
    {
      id: "comm-full",
      label: "Kommunikasjonsmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Kommunikasjon og Eskalering" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Kommunikasjonskanaler" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hvilke kanaler brukes for skiftkommunikasjon? Hvem har tilgang?",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Hendelsesrapportering" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hvordan rapporteres hendelser? Skjema, tidsfrist, mottaker." },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Eskaleringsmatrise" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Definer eskaleringssti: ansatt \u2192 skiftleder \u2192 daglig leder \u2192 eier.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Slutt-p\u00e5-skift Rapport" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Format og innhold for skiftrapport ved skiftslutt." }],
          },
        ],
      },
    },
  ],
  "onboarding-training": [
    {
      id: "onboarding-full",
      label: "Onboardingmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Onboarding og Oppl\u00e6ring" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Pre-boarding Sjekkliste" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hva m\u00e5 v\u00e6re klart f\u00f8r f\u00f8rste arbeidsdag? Uniform, tilganger, dokumenter.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Dag 1\u20137 Beredskapsmilep\u00e6ler" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hva skal ny ansatt mestre innen dag 1, 3, 5 og 7?" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Mentortildeling" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hvordan tildeles mentor? Mentors ansvar og oppf\u00f8lgingsplan.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Kunnskapstester" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hvilke tester m\u00e5 best\u00e5s? Terskel for godkjenning." },
            ],
          },
        ],
      },
    },
  ],
  scheduling: [
    {
      id: "schedule-full",
      label: "Vaktplanmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Vaktplan og Bemanning" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Planleggingsprinsipper" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hvordan planlegges vakter? Tidshorisont, ansvar, publiseringsfrist.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "\u00c5pne Vakter og Erstatning" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Prosess for \u00e5pne vakter: varsling, s\u00f8knad, tildeling.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Bytteprosess" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Regler for vaktbytte: godkjenning, kompetansekrav, frist." },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Overtid og Aldersrestriksjoner" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Regler for overtid, makstimer, og restriksjoner for unge arbeidere.",
              },
            ],
          },
        ],
      },
    },
  ],
  "quality-service": [
    {
      id: "quality-full",
      label: "Kvalitetsmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Kvalitet og Service" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Gjesteinteraksjon" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Standard for m\u00f8te med gjest: velkomst, oppmerksomhet, farvel.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Stasjonsberedskap" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Krav til stasjoner f\u00f8r service begynner." }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Service Recovery" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hva gj\u00f8r vi n\u00e5r noe g\u00e5r galt? Kompensasjon, oppf\u00f8lging.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Kvalitetskontroller" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Faste sjekker for kvalitetssikring i l\u00f8pet av servicen.",
              },
            ],
          },
        ],
      },
    },
  ],
  "incident-response": [
    {
      id: "incident-full",
      label: "Avviksmal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Avvik og Hendelser" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Avvikskategorier" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Typer avvik: mattrygghet, sikkerhet, service, HMS, personell.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Umiddelbare Tiltak" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "F\u00f8rstehjelp og containment: hva gj\u00f8res umiddelbart?",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Korrigerende Tiltak" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hvem eier korrigering? Tidsfrist og godkjenning." }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Lukking og Forebygging" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Registrering, rotorsaksanalyse og forebyggende tiltak." },
            ],
          },
        ],
      },
    },
  ],
  "kpi-review": [
    {
      id: "kpi-full",
      label: "KPI-mal",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "KPI og Evaluering" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Daglig Operativ KPI" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Daglig gjennomgang: omsetning, svinn, personalkost, gjestetilfredshet.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Ukentlig Bemanning og Compliance" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Ukentlig: timer vs budsjett, sykefrav\u00e6r, HMS-compliance.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "M\u00e5nedlig Kvalitet og Retention" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "M\u00e5nedlig: kvalitetsm\u00e5l, turnover, oppl\u00e6ringsfremdrift.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Handlingsplan" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Tiltak, ansvarlig, frist og oppf\u00f8lgingspunkt." }],
          },
        ],
      },
    },
  ],
};

export function TemplatePicker({
  chapterKey,
  isDark,
  onApply,
}: {
  chapterKey: ChapterKey;
  isDark: boolean;
  onApply: (content: JSONContent) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const templates = CHAPTER_TEMPLATES[chapterKey] ?? [];
  const chapter = CHAPTERS.find((c) => c.key === chapterKey);

  if (templates.length === 0) {
    return (
      <p className={`text-xs ${isDark ? "text-muted-foreground" : "text-[oklch(0.55_0.015_50)]"}`}>
        Ingen maler tilgjengelig for dette kapittelet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className={`text-xs ${isDark ? "text-muted-foreground" : "text-[oklch(0.50_0.015_50)]"}`}>
        Velg en mal for <span className="font-semibold">{chapter?.title}</span>:
      </p>
      {templates.map((t) => (
        <div key={t.id} className="space-y-1.5">
          <button
            onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
              isDark
                ? "border-border bg-card text-foreground hover:bg-accent hover:border-orange-500/30"
                : "border-[oklch(0.88_0.01_50)] bg-white text-[oklch(0.25_0.015_45)] hover:border-orange-300 hover:bg-orange-50/50"
            }`}
          >
            <FileText
              className={`h-4 w-4 flex-shrink-0 ${isDark ? "text-muted-foreground" : "text-[oklch(0.55_0.015_50)]"}`}
            />
            <span className="flex-1 font-medium">{t.label}</span>
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${expanded === t.id ? "rotate-90" : ""} ${
                isDark ? "text-muted-foreground" : "text-[oklch(0.55_0.015_50)]"
              }`}
            />
          </button>
          {expanded === t.id && (
            <div
              className={`rounded-lg border p-3 ${isDark ? "border-border bg-card/50" : "border-[oklch(0.90_0.006_55)] bg-[oklch(0.97_0.003_55)]"}`}
            >
              <p
                className={`mb-2 text-xs ${isDark ? "text-muted-foreground" : "text-[oklch(0.50_0.015_50)]"}`}
              >
                Malen inneholder {t.content.content?.length ?? 0} blokker med overskrifter og
                plassholdertekst.
              </p>
              <button
                onClick={() => onApply(t.content)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isDark
                    ? "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
                    : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                }`}
              >
                Bruk denne malen
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
