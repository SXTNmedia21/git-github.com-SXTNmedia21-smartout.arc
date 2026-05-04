"use client";

/**
 * Template definitions and hooks for the governance template picker.
 * Provides industry-filtered templates for the WorkspaceSetupWizard.
 * Each template creates a full policy → protocol → procedure → test → confirmation chain.
 * Connected to: GovernanceTemplatePicker, WorkspaceSetupWizard
 */

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type FilterKey =
  | "food"
  | "alcohol"
  | "overnight"
  | "delivery"
  | "nightwork"
  | "minors"
  | "foreignWorkers"
  | "cashHandling"
  | "tips";

type Industry = "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other";

type ProcedureStep = {
  title: string;
  description: string;
  step_order: number;
  is_required: boolean;
  estimated_minutes: number;
};

type TemplateProcedure = {
  name: string;
  description: string;
  procedure_type: "safety" | "custom" | "onboarding" | "standard" | "maintenance";
  steps: ProcedureStep[];
};

type TemplateQuestion = {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
};

export type GovernanceTemplate = {
  id: string;
  name: string;
  description: string;
  policy_type: "operational" | "haccp" | "hr" | "safety" | "access" | "payroll" | "custom";
  filterKey: FilterKey | null;
  protocol: {
    name: string;
    description: string;
  };
  procedures: TemplateProcedure[];
  knowledgeTest: {
    name: string;
    pass_threshold: number;
    questions: TemplateQuestion[];
  };
  confirmation: {
    name: string;
    confirmation_text: string;
    requires_signature: boolean;
  };
  longDescription: string;
  legalBasis: string | null;
};

// ══════════════════════════════════════════════════════════════
// Filter Questions
// ══════════════════════════════════════════════════════════════

export const FILTER_QUESTIONS: Array<{ key: FilterKey; label: string; description: string }> = [
  { key: "food", label: "Matservering", description: "Serverer dere mat til gjester?" },
  { key: "alcohol", label: "Alkoholservering", description: "Har dere skjenkebevilling?" },
  { key: "nightwork", label: "Nattarbeid", description: "Jobber ansatte etter kl. 00:00?" },
  { key: "overnight", label: "Overnatting", description: "Har dere overnattingsgjester?" },
  {
    key: "delivery",
    label: "Take-away / levering",
    description: "Tilbyr dere henting eller utkj\u00f8ring?",
  },
  {
    key: "minors",
    label: "Under\u00e5rige i arbeid",
    description: "Har dere ansatte under 18 \u00e5r?",
  },
  {
    key: "foreignWorkers",
    label: "Utenlandske arbeidstakere",
    description: "Ansetter dere arbeidstakere fra utlandet?",
  },
  {
    key: "cashHandling",
    label: "Kontanth\u00e5ndtering",
    description: "H\u00e5ndterer dere kontanter i kasse?",
  },
  {
    key: "tips",
    label: "Tipsh\u00e5ndtering",
    description: "Mottar ansatte tips/drikkepenger?",
  },
];

// ══════════════════════════════════════════════════════════════
// Industry Defaults
// ══════════════════════════════════════════════════════════════

export const INDUSTRY_DEFAULTS: Record<Industry, Record<FilterKey, boolean>> = {
  restaurant: {
    food: true,
    alcohol: true,
    overnight: false,
    delivery: true,
    nightwork: true,
    minors: false,
    foreignWorkers: true,
    cashHandling: true,
    tips: true,
  },
  hotel: {
    food: true,
    alcohol: true,
    overnight: true,
    delivery: false,
    nightwork: true,
    minors: false,
    foreignWorkers: true,
    cashHandling: true,
    tips: true,
  },
  cafe: {
    food: true,
    alcohol: false,
    overnight: false,
    delivery: false,
    nightwork: false,
    minors: true,
    foreignWorkers: false,
    cashHandling: true,
    tips: true,
  },
  bar: {
    food: false,
    alcohol: true,
    overnight: false,
    delivery: false,
    nightwork: true,
    minors: false,
    foreignWorkers: true,
    cashHandling: true,
    tips: true,
  },
  catering: {
    food: true,
    alcohol: false,
    overnight: false,
    delivery: true,
    nightwork: false,
    minors: false,
    foreignWorkers: false,
    cashHandling: false,
    tips: false,
  },
  other: {
    food: false,
    alcohol: false,
    overnight: false,
    delivery: false,
    nightwork: false,
    minors: false,
    foreignWorkers: false,
    cashHandling: false,
    tips: false,
  },
};

// ══════════════════════════════════════════════════════════════
// Governance Templates
// ══════════════════════════════════════════════════════════════

export const GOVERNANCE_TEMPLATES: GovernanceTemplate[] = [
  // 1. Arbeidsmiljo og HMS (mandatory)
  {
    id: "tpl-arbeidsmiljo-hms",
    name: "Arbeidsmiljo og HMS",
    description: "Grunnleggende retningslinjer for helse, miljo og sikkerhet pa arbeidsplassen.",
    policy_type: "safety",
    filterKey: null,
    protocol: {
      name: "HMS-protokoll",
      description: "Protokoll for oppfolging av helse, miljo og sikkerhet.",
    },
    procedures: [
      {
        name: "Vernerunde",
        description: "Systematisk gjennomgang av arbeidsplassen for a identifisere farer.",
        procedure_type: "safety",
        steps: [
          {
            title: "Forberedelse",
            description: "Hent sjekkliste og gjennomga forrige vernerunde-rapport.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Befaring",
            description: "Ga gjennom alle omrader og noter avvik og farer.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 30,
          },
          {
            title: "Rapportering",
            description: "Dokumenter funn, prioriter tiltak og sett frister.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 15,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "HMS-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "hms-q1",
          text: "Hva er formalet med en vernerunde?",
          options: [
            { id: "hms-q1-a", text: "A kontrollere ansattes arbeidstid" },
            { id: "hms-q1-b", text: "A identifisere farer og avvik pa arbeidsplassen" },
            { id: "hms-q1-c", text: "A planlegge neste ukes vaktliste" },
            { id: "hms-q1-d", text: "A evaluere ansattes prestasjoner" },
          ],
          correctOptionId: "hms-q1-b",
        },
        {
          id: "hms-q2",
          text: "Hvem har ansvar for HMS pa arbeidsplassen?",
          options: [
            { id: "hms-q2-a", text: "Kun verneombudet" },
            { id: "hms-q2-b", text: "Kun daglig leder" },
            { id: "hms-q2-c", text: "Arbeidsgiver har hovedansvaret, men alle bidrar" },
            { id: "hms-q2-d", text: "Ingen spesielt, det er frivillig" },
          ],
          correctOptionId: "hms-q2-c",
        },
      ],
    },
    confirmation: {
      name: "HMS-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for helse, miljo og sikkerhet pa arbeidsplassen.",
      requires_signature: true,
    },
    longDescription:
      "Denne retningslinjen dekker alle aspekter av helse, miljo og sikkerhet pa arbeidsplassen. Den inkluderer vernerunder, forstehjelpsutstyr, nodutganger og rapportering av avvik. Alle ansatte skal kjenne til HMS-rutinene og vite hvor sikkerhetsutstyr befinner seg.",
    legalBasis: "Arbeidsmiljoloven \u00A73-1: Krav til systematisk HMS-arbeid",
  },

  // 2. Brannsikkerhet (mandatory)
  {
    id: "tpl-brannsikkerhet",
    name: "Brannsikkerhet",
    description: "Retningslinjer for brannforebygging, varsling og evakuering.",
    policy_type: "safety",
    filterKey: null,
    protocol: {
      name: "Brannsikkerhetsprotokoll",
      description: "Protokoll for brannforebygging og evakuering.",
    },
    procedures: [
      {
        name: "Evakueringsprosedyre",
        description: "Trinnvis prosedyre for sikker evakuering ved brannalarm.",
        procedure_type: "safety",
        steps: [
          {
            title: "Varsling",
            description: "Aktiver brannalarm og ring 110 ved behov.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 2,
          },
          {
            title: "Evakuering",
            description:
              "Folg oppmerket romningsvei til monstringsplass. Hjelp gjester og kolleger.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Opptelling",
            description:
              "Gjennomfor opptelling pa monstringsplass og rapporter til brannansvarlig.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Brannsikkerhet-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "brann-q1",
          text: "Hva er det forste du gjor ved en brannalarm?",
          options: [
            { id: "brann-q1-a", text: "Samle personlige eiendeler" },
            { id: "brann-q1-b", text: "Folge romningsvei til monstringsplass" },
            { id: "brann-q1-c", text: "Vente pa instruksjoner fra leder" },
            { id: "brann-q1-d", text: "Forsoke a slokke brannen selv" },
          ],
          correctOptionId: "brann-q1-b",
        },
        {
          id: "brann-q2",
          text: "Hvilket nummer ringer du til brannvesenet?",
          options: [
            { id: "brann-q2-a", text: "112" },
            { id: "brann-q2-b", text: "113" },
            { id: "brann-q2-c", text: "110" },
            { id: "brann-q2-d", text: "114" },
          ],
          correctOptionId: "brann-q2-c",
        },
      ],
    },
    confirmation: {
      name: "Brannsikkerhet-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar brannsikkerhetsrutinene, inkludert romningsveier og monstringsplass.",
      requires_signature: true,
    },
    longDescription:
      "Brannforebygging og evakuering er lovpalagt for alle virksomheter. Denne retningslinjen dekker evakueringsplaner, brannslukningsutstyr, moteplasser og varslingsrutiner. Alle ansatte ma kjenne evakueringsplanen og naermeste nodutgang.",
    legalBasis: "Brann- og eksplosjonsvernloven \u00A76: Forebyggende plikter",
  },

  // 3. Mathandtering og hygiene (food)
  {
    id: "tpl-mathandtering-hygiene",
    name: "Mathandtering og hygiene",
    description: "Retningslinjer for trygg mathandtering, temperaturkontroll og personlig hygiene.",
    policy_type: "haccp",
    filterKey: "food",
    protocol: {
      name: "Mathandteringsprotokoll",
      description: "Protokoll for hygiene og temperaturkontroll ved mathandtering.",
    },
    procedures: [
      {
        name: "Temperaturkontroll",
        description: "Daglig kontroll av temperaturer i kjoleskap, fryser og varmbeholding.",
        procedure_type: "standard",
        steps: [
          {
            title: "Mal temperaturer",
            description: "Bruk kalibrert termometer til a male alle kjole- og fryseenheter.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Loggfor verdier",
            description: "Registrer alle temperaturer i loggskjema med dato og klokkeslett.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Handter avvik",
            description: "Ved avvik: varsle leder, flytt varer om nodvendig, dokumenter tiltak.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 10,
          },
        ],
      },
      {
        name: "Handhygiene",
        description: "Korrekt handvask for a forebygge kryssforurensning.",
        procedure_type: "standard",
        steps: [
          {
            title: "Vat hender",
            description: "Bruk rennende varmt vann og sape. Vask i minst 20 sekunder.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 1,
          },
          {
            title: "Torr og desinfiser",
            description: "Bruk engangshandklede og pafor desinfeksjon om nodvendig.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 1,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Mathandtering-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "mat-q1",
          text: "Hva er korrekt temperatur for kjoleskap?",
          options: [
            { id: "mat-q1-a", text: "0-4 grader" },
            { id: "mat-q1-b", text: "5-8 grader" },
            { id: "mat-q1-c", text: "8-12 grader" },
            { id: "mat-q1-d", text: "Under 0 grader" },
          ],
          correctOptionId: "mat-q1-a",
        },
        {
          id: "mat-q2",
          text: "Nar skal du vaske hendene?",
          options: [
            { id: "mat-q2-a", text: "Bare for arbeidsdagen starter" },
            { id: "mat-q2-b", text: "Bare etter toalettbesok" },
            {
              id: "mat-q2-c",
              text: "For og etter mathandtering, etter toalettbesok, og ved skifte av oppgave",
            },
            { id: "mat-q2-d", text: "Bare hvis hendene er synlig skitne" },
          ],
          correctOptionId: "mat-q2-c",
        },
      ],
    },
    confirmation: {
      name: "Mathandtering-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for mathandtering og hygiene.",
      requires_signature: true,
    },
    longDescription:
      "Korrekt handtering av mat fra mottak til servering. Dekker temperaturkontroll, handhygiene, kryssforurensning og oppbevaring. Alle som handterer mat ma forsta HACCP-prinsippene og folge temperaturloggene daglig.",
    legalBasis: "Matloven \u00A75 og Mattilsynets forskrift om naeringsmiddelhygiene",
  },

  // 4. Allergenhandtering (food)
  {
    id: "tpl-allergenhandtering",
    name: "Allergenhandtering",
    description: "Retningslinjer for korrekt merking, handtering og kommunikasjon av allergener.",
    policy_type: "haccp",
    filterKey: "food",
    protocol: {
      name: "Allergenprotokoll",
      description: "Protokoll for a sikre trygg handtering av allergener i all matservering.",
    },
    procedures: [
      {
        name: "Allergenmerking",
        description: "Systematisk merking av allergener i menyer og ved tilberedning.",
        procedure_type: "standard",
        steps: [
          {
            title: "Identifiser allergener",
            description: "Ga gjennom alle ingredienser og identifiser de 14 hovedallergenene.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 15,
          },
          {
            title: "Merk menyer og retter",
            description: "Oppdater menyer med allergensymboler. Merk tilberedningsstasjoner.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 20,
          },
          {
            title: "Kommuniser til gjest",
            description:
              "Informer gjesten om allergeninnhold og krysskontaminering ved bestilling.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Allergen-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "allergen-q1",
          text: "Hvor mange hovedallergener ma merkes ifolge lovverket?",
          options: [
            { id: "allergen-q1-a", text: "8" },
            { id: "allergen-q1-b", text: "10" },
            { id: "allergen-q1-c", text: "14" },
            { id: "allergen-q1-d", text: "20" },
          ],
          correctOptionId: "allergen-q1-c",
        },
        {
          id: "allergen-q2",
          text: "Hva gjor du om en gjest opplyser om allergi?",
          options: [
            { id: "allergen-q2-a", text: "Sier at alle retter er trygge" },
            {
              id: "allergen-q2-b",
              text: "Sjekker ingredienser og informerer om risiko for krysskontaminering",
            },
            { id: "allergen-q2-c", text: "Anbefaler gjesten a spise et annet sted" },
            { id: "allergen-q2-d", text: "Fjerner kun synlige allergener fra retten" },
          ],
          correctOptionId: "allergen-q2-b",
        },
      ],
    },
    confirmation: {
      name: "Allergen-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for allergenhandtering og -merking.",
      requires_signature: true,
    },
    longDescription:
      "EU-forordningen krever merking av 14 hovedallergener. Denne retningslinjen sikrer at alle ansatte kan identifisere allergener, informere gjester korrekt, og handtere allergi-hendelser trygt.",
    legalBasis: "EU-forordning 1169/2011 om allergenmerking",
  },

  // 5. Alkoholservering (alcohol)
  {
    id: "tpl-alkoholservering",
    name: "Alkoholservering",
    description: "Retningslinjer for ansvarlig alkoholservering og alderskontroll.",
    policy_type: "operational",
    filterKey: "alcohol",
    protocol: {
      name: "Alkoholserveringsprotokoll",
      description: "Protokoll for ansvarlig servering og kontroll av alkoholholdig drikke.",
    },
    procedures: [
      {
        name: "Alderskontroll",
        description: "Prosedyre for a verifisere gjestens alder ved alkoholservering.",
        procedure_type: "standard",
        steps: [
          {
            title: "Vurder alder",
            description: "Be om legitimasjon hvis gjesten ser ut til a vaere under 25 ar.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 1,
          },
          {
            title: "Kontroller legitimasjon",
            description:
              "Sjekk gyldig ID (pass, forerkort, bankkort med bilde). Verifiser fodselsdato.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 1,
          },
          {
            title: "Avvis eller server",
            description: "Avvis hoeflig hvis gjesten er under 18. Dokumenter eventuelle hendelser.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 2,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Alkoholservering-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "alkohol-q1",
          text: "Hva er aldersgrensen for kjop av alkohol i Norge?",
          options: [
            { id: "alkohol-q1-a", text: "16 ar" },
            { id: "alkohol-q1-b", text: "18 ar" },
            { id: "alkohol-q1-c", text: "20 ar" },
            { id: "alkohol-q1-d", text: "21 ar" },
          ],
          correctOptionId: "alkohol-q1-b",
        },
        {
          id: "alkohol-q2",
          text: "Nar bor du be om legitimasjon?",
          options: [
            { id: "alkohol-q2-a", text: "Bare hvis gjesten ser veldig ung ut" },
            { id: "alkohol-q2-b", text: "Kun pa helgedager" },
            { id: "alkohol-q2-c", text: "Hvis gjesten ser ut til a vaere under 25 ar" },
            { id: "alkohol-q2-d", text: "Aldri, det er uhoflig" },
          ],
          correctOptionId: "alkohol-q2-c",
        },
      ],
    },
    confirmation: {
      name: "Alkoholservering-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for ansvarlig alkoholservering.",
      requires_signature: true,
    },
    longDescription:
      "Ansvarlig alkoholservering i trad med alkoholloven. Dekker alderskontroll, serveringsregler, skjenketider og konsekvenser ved brudd. Alle som serverer alkohol ma kjenne aldersgrensene og legitimasjonskravene.",
    legalBasis: "Alkoholloven \u00A71-5: Aldersgrenser for salg og skjenking",
  },

  // 6. Skjenkekontroll (alcohol)
  {
    id: "tpl-skjenkekontroll",
    name: "Skjenkekontroll",
    description: "Retningslinjer for a vurdere beruselsesniva og nekte servering ved behov.",
    policy_type: "operational",
    filterKey: "alcohol",
    protocol: {
      name: "Skjenkekontrollprotokoll",
      description: "Protokoll for vurdering av beruselse og nekting av servering.",
    },
    procedures: [
      {
        name: "Beruselseskontroll",
        description: "Prosedyre for a vurdere og handtere berusede gjester.",
        procedure_type: "standard",
        steps: [
          {
            title: "Observer gjesten",
            description: "Se etter tegn pa beruselse: ustott gange, hoey stemme, uklart blikk.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 2,
          },
          {
            title: "Begrens servering",
            description: "Tilby vann og mat. Reduser alkoholservering gradvis.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Nekt servering",
            description:
              "Informer gjesten hoeflig om at servering stanses. Varsle leder ved behov.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Skjenkekontroll-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "skjenke-q1",
          text: "Hva gjor du om en gjest viser tegn pa beruselse?",
          options: [
            { id: "skjenke-q1-a", text: "Fortsetter a servere som normalt" },
            { id: "skjenke-q1-b", text: "Tilbyr vann og mat, begrenser alkoholservering" },
            { id: "skjenke-q1-c", text: "Ringer politiet umiddelbart" },
            { id: "skjenke-q1-d", text: "Ignorerer det og haper det gar over" },
          ],
          correctOptionId: "skjenke-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Skjenkekontroll-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for skjenkekontroll og handtering av berusede gjester.",
      requires_signature: true,
    },
    longDescription:
      "Internkontroll for a ivareta skjenkebevillingen. Dekker vurdering av beruselsesgrad, nektelse av servering, og dokumentasjon. Brudd kan fore til prikker og inndragning av bevillingen.",
    legalBasis: "Alkoholloven \u00A74-7: Kontroll med salgs- og skjenkebevillinger",
  },

  // 7. Gjestesikkerhet (overnight)
  {
    id: "tpl-gjestesikkerhet",
    name: "Gjestesikkerhet",
    description: "Retningslinjer for sikkerhet og trygghet for overnattingsgjester.",
    policy_type: "safety",
    filterKey: "overnight",
    protocol: {
      name: "Gjestesikkerhetsprotokoll",
      description: "Protokoll for a ivareta gjestenes sikkerhet under oppholdet.",
    },
    procedures: [
      {
        name: "Nokkelkort-handtering",
        description: "Prosedyre for utstedelse og kontroll av nokkelkort.",
        procedure_type: "safety",
        steps: [
          {
            title: "Verifiser identitet",
            description: "Sjekk legitimasjon og bestillingsbekreftelse for utstedelse.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 3,
          },
          {
            title: "Programmer nokkelkort",
            description: "Aktiver nokkelkort for riktig rom og periode. Gi maks to kort per rom.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 2,
          },
          {
            title: "Deaktiver ved utsjekk",
            description: "Samle inn og deaktiver alle nokkelkort ved utsjekk. Loggfor i systemet.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 2,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Gjestesikkerhet-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "gjest-q1",
          text: "Hva gjor du hvis en gjest har mistet nokkelkortet?",
          options: [
            { id: "gjest-q1-a", text: "Gir dem et nytt kort uten videre" },
            {
              id: "gjest-q1-b",
              text: "Verifiserer identitet, deaktiverer det gamle kortet, og utsteder nytt",
            },
            { id: "gjest-q1-c", text: "Ber dem vente til neste dag" },
            { id: "gjest-q1-d", text: "Apner doren manuelt uten a sjekke ID" },
          ],
          correctOptionId: "gjest-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Gjestesikkerhet-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for gjestesikkerhet og nokkelkort-handtering.",
      requires_signature: true,
    },
    longDescription:
      "Sikkerhet for overnattingsgjester inkluderer nokkelkort-handtering, identitetskontroll, nodprosedyrer og romtilgang. Gjestenes trygghet er virksomhetens ansvar gjennom hele oppholdet.",
    legalBasis: null,
  },

  // 8. Romrenhold (overnight)
  {
    id: "tpl-romrenhold",
    name: "Romrenhold",
    description: "Retningslinjer for daglig renhold og klargjoring av gjesterom.",
    policy_type: "operational",
    filterKey: "overnight",
    protocol: {
      name: "Romrenholdprotokoll",
      description: "Protokoll for systematisk renhold og kvalitetskontroll av gjesterom.",
    },
    procedures: [
      {
        name: "Daglig romrenhold",
        description: "Standard prosedyre for daglig rengjoring av gjesterom.",
        procedure_type: "standard",
        steps: [
          {
            title: "Forberedelse",
            description:
              "Samle utstyr og sjekk rommets status i systemet. Bank pa doren for inngang.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 3,
          },
          {
            title: "Seng og tekstiler",
            description: "Skift sengetoy, bytt handklaer, legg frem nye toalettartikler.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Bad og overflater",
            description: "Rengjor bad, toalett, vask, speil. Tort av alle overflater.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Kvalitetskontroll",
            description: "Sjekk rommet med sjekkliste. Meld fra om skader eller mangler.",
            step_order: 4,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Romrenhold-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "rom-q1",
          text: "Hva gjor du for du gar inn pa et gjesterom for rengjoring?",
          options: [
            { id: "rom-q1-a", text: "Gar rett inn med nokkelkort" },
            { id: "rom-q1-b", text: "Banker pa doren og venter for du gar inn" },
            { id: "rom-q1-c", text: "Roper gjennom doren" },
            { id: "rom-q1-d", text: "Sjekker bare om det er stille" },
          ],
          correctOptionId: "rom-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Romrenhold-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for romrenhold og kvalitetskontroll.",
      requires_signature: true,
    },
    longDescription:
      "Standard for renhold av gjesterom sikrer konsistent kvalitet og hygiene. Dekker sengetoy, bad, stovsuting og pafyll av amenities. Riktig rekkefolge forhindrer kryssforurensning.",
    legalBasis: null,
  },

  // 9. Leveringssikkerhet (delivery)
  {
    id: "tpl-leveringssikkerhet",
    name: "Leveringssikkerhet",
    description: "Retningslinjer for trygg pakking, oppbevaring og levering av mat.",
    policy_type: "operational",
    filterKey: "delivery",
    protocol: {
      name: "Leveringsprotokoll",
      description: "Protokoll for a sikre matsikkerhet gjennom hele leveringskjeden.",
    },
    procedures: [
      {
        name: "Pakking og levering",
        description: "Prosedyre for sikker pakking og transport av mat til kunder.",
        procedure_type: "standard",
        steps: [
          {
            title: "Kontroller bestilling",
            description: "Verifiser at alle varer er korrekte og allergeninformasjon er vedlagt.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 3,
          },
          {
            title: "Pakk forsvarlig",
            description: "Bruk godkjent emballasje. Separer varme og kalde varer. Forsegl.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Lever innen tid",
            description:
              "Folg planlagt rute. Maks leveringstid 45 minutter. Mal temperatur ved levering.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 30,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Leveringssikkerhet-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "lev-q1",
          text: "Hva er viktigst a sjekke for du pakker en bestilling?",
          options: [
            { id: "lev-q1-a", text: "At emballasjen ser pen ut" },
            { id: "lev-q1-b", text: "At alle varer er korrekte og allergeninformasjon er med" },
            { id: "lev-q1-c", text: "At det er nok servietter i posen" },
            { id: "lev-q1-d", text: "At logoen er synlig pa posen" },
          ],
          correctOptionId: "lev-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Leveringssikkerhet-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for trygg pakking og levering.",
      requires_signature: true,
    },
    longDescription:
      "Trygg handtering av mat for take-away og levering. Dekker temperaturkontroll under transport, korrekt emballering, allergenmerking pa emballasje, og kontroll av bestillinger for utlevering.",
    legalBasis: "Matloven \u00A75: Krav til naeringsmiddelsikkerhet ved omsetning",
  },

  // ── MANDATORY: Trakassering og varsling ──
  {
    id: "tpl-trakassering-varsling",
    name: "Trakassering og varsling",
    description: "Forebygging av trakassering og rutiner for varsling pa arbeidsplassen.",
    policy_type: "hr",
    filterKey: null,
    protocol: {
      name: "Trakasseringsprotokoll",
      description: "Protokoll for forebygging, varsling og handtering av trakassering.",
    },
    procedures: [
      {
        name: "Varslingsprosedyre",
        description:
          "Hvordan ansatte kan varsle om kritikkverdige forhold, trakassering eller diskriminering.",
        procedure_type: "standard",
        steps: [
          {
            title: "Identifiser forholdet",
            description:
              "Vurder om situasjonen utgjor trakassering, diskriminering eller annet kritikkverdig forhold.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Dokumenter hendelsen",
            description:
              "Skriv ned hva som skjedde, nar, hvor, hvem var involvert og eventuelle vitner.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 15,
          },
          {
            title: "Varsle leder eller verneombud",
            description:
              "Meld fra til naermeste leder, verneombud, eller bruk virksomhetens varslingskanal. Du kan ogsa varsle eksternt til Arbeidstilsynet.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 10,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Trakassering-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "trk-q1",
          text: "Hva er arbeidsgivers plikt nar det gjelder trakassering?",
          options: [
            { id: "trk-q1-a", text: "Ha nulltoleranse og skrive det pa veggen" },
            {
              id: "trk-q1-b",
              text: "Aktivt forebygge, ha rutiner for varsling, og folge opp alle meldinger",
            },
            { id: "trk-q1-c", text: "Handtere det nar det skjer" },
            { id: "trk-q1-d", text: "Overlate det til de ansatte selv" },
          ],
          correctOptionId: "trk-q1-b",
        },
        {
          id: "trk-q2",
          text: "Hva er viktig nar du varsler om trakassering?",
          options: [
            { id: "trk-q2-a", text: "Bare si fra muntlig og hape det ordner seg" },
            { id: "trk-q2-b", text: "Dokumentere hendelsen skriftlig med tid, sted og vitner" },
            { id: "trk-q2-c", text: "Vente til det skjer flere ganger" },
            { id: "trk-q2-d", text: "Konfrontere personen alene" },
          ],
          correctOptionId: "trk-q2-b",
        },
      ],
    },
    confirmation: {
      name: "Trakassering-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for forebygging av trakassering og varsling, og vet hvordan jeg melder fra.",
      requires_signature: true,
    },
    longDescription:
      "Alle arbeidsgivere har plikt til a aktivt forebygge trakassering og diskriminering. Denne retningslinjen dekker hva trakassering er, hvordan varsle, varslervern, og arbeidsgivers handteringsplikt. Serveringsbransjen har et av de hoyeste nivaene av seksuell trakassering i Norge.",
    legalBasis:
      "Likestillings- og diskrimineringsloven \u00A726 + AML \u00A72A-1: Aktivitetsplikt og varslervern",
  },

  // ── MANDATORY: Forstehjelp ──
  {
    id: "tpl-forstehjelp",
    name: "Forstehjelp",
    description: "Retningslinjer for forstehjelpsberedskap, utstyr og nodprosedyrer.",
    policy_type: "safety",
    filterKey: null,
    protocol: {
      name: "Forstehjelpprotokoll",
      description: "Protokoll for forstehjelpsberedskap og nodhandtering.",
    },
    procedures: [
      {
        name: "Forstehjelpsprosedyre",
        description: "Handtering av skader og akutte medisinske hendelser pa arbeidsplassen.",
        procedure_type: "safety",
        steps: [
          {
            title: "Sikre skadestedet",
            description:
              "Vurder faren. Sikre omradet for deg selv og den skadde. Ring 113 ved alvorlige hendelser.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 2,
          },
          {
            title: "Gi forstehjelp",
            description:
              "Stans blodning, legg i stabilt sideleie ved bevisstloshet, start HLR om nodvendig. Bruk forstehjelpsskrin.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Dokumenter og fold opp",
            description:
              "Registrer hendelsen i avvikssystemet. Varsle leder. Sikre oppfolging av den skadde.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 10,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Forstehjelp-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "fh-q1",
          text: "Hvilket nummer ringer du ved akutt sykdom eller skade?",
          options: [
            { id: "fh-q1-a", text: "110 (brann)" },
            { id: "fh-q1-b", text: "112 (politi)" },
            { id: "fh-q1-c", text: "113 (ambulanse)" },
            { id: "fh-q1-d", text: "116 117 (legevakt)" },
          ],
          correctOptionId: "fh-q1-c",
        },
        {
          id: "fh-q2",
          text: "Hvor finner du forstehjelpsutstyret pa arbeidsplassen?",
          options: [
            { id: "fh-q2-a", text: "Det vet jeg ikke" },
            { id: "fh-q2-b", text: "Pa merket og tilgjengelig plass — sjekk ved oppstart" },
            { id: "fh-q2-c", text: "I bilen utenfor" },
            { id: "fh-q2-d", text: "Bare leder vet det" },
          ],
          correctOptionId: "fh-q2-b",
        },
      ],
    },
    confirmation: {
      name: "Forstehjelp-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg vet hvor forstehjelpsutstyret er, og har lest prosedyren for nodhandtering pa arbeidsplassen.",
      requires_signature: true,
    },
    longDescription:
      "Arbeidsgiver ma sikre tilstrekkelig forstehjelpsberedskap. Denne retningslinjen dekker plassering av utstyr, hvem som er forstehjelpansvarlig, nodprosedyrer og dokumentasjon av hendelser.",
    legalBasis: "AML \u00A73-2 + Forskrift om organisering \u00A714-2: Krav til forstehjelp",
  },

  // ── FILTER: Nattarbeid ──
  {
    id: "tpl-nattarbeid",
    name: "Nattarbeid",
    description: "Retningslinjer for arbeid etter kl. 21:00 med hensyn til helse og sikkerhet.",
    policy_type: "hr",
    filterKey: "nightwork",
    protocol: {
      name: "Nattarbeidprotokoll",
      description: "Protokoll for helse, sikkerhet og arbeidstid ved nattarbeid.",
    },
    procedures: [
      {
        name: "Nattarbeidsprosedyre",
        description: "Rutiner for a ivareta ansattes helse og sikkerhet under nattarbeid.",
        procedure_type: "standard",
        steps: [
          {
            title: "Arbeidstidskontroll",
            description:
              "Maks 8 timer per 24 timer i gjennomsnitt for nattarbeidere. Minimum 11 timer hvile mellom vakter.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Helsetilbud",
            description:
              "Arbeidsgiver ma tilby helseundersokelse til nattarbeidere. Ved helseproblemer har arbeidstaker rett til overgang til dagarbeid.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Sikkerhet ved alenearbeid",
            description:
              "Aldri alene pa nattskift uten kommunikasjonsmulighet. Sjekk at nodutganger er tilgjengelige.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Nattarbeid-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "natt-q1",
          text: "Hva er minste hvile mellom en kveldsvakt (slutt 03:00) og neste vakt?",
          options: [
            { id: "natt-q1-a", text: "8 timer" },
            { id: "natt-q1-b", text: "11 timer" },
            { id: "natt-q1-c", text: "6 timer" },
            { id: "natt-q1-d", text: "Det er ingen regel" },
          ],
          correctOptionId: "natt-q1-b",
        },
        {
          id: "natt-q2",
          text: "Hvilke rettigheter har nattarbeidere?",
          options: [
            { id: "natt-q2-a", text: "Ingen spesielle rettigheter" },
            {
              id: "natt-q2-b",
              text: "Rett til helseundersokelse og overgang til dagarbeid ved helseproblemer",
            },
            { id: "natt-q2-c", text: "Bare hoyere lonn" },
            { id: "natt-q2-d", text: "Lengre ferie" },
          ],
          correctOptionId: "natt-q2-b",
        },
      ],
    },
    confirmation: {
      name: "Nattarbeid-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for nattarbeid, inkludert arbeidstidsregler og helsetilbud.",
      requires_signature: true,
    },
    longDescription:
      "Nattarbeid (etter kl. 21:00) har egne regler for arbeidstid, hvileperioder og helse. Arbeidsgiver ma tilby helseundersokelse, overholde maks 8-timersregel, og sikre minimum 11 timers hvile mellom vakter. Gravide har rett til fritak fra nattarbeid.",
    legalBasis: "AML \u00A710-11: Nattarbeid — arbeidstid, helse og sikkerhet",
  },

  // ── FILTER: Underarige i arbeid ──
  {
    id: "tpl-underaarige",
    name: "Underarige i arbeid",
    description: "Retningslinjer for ansettelse og arbeid med personer under 18 ar.",
    policy_type: "hr",
    filterKey: "minors",
    protocol: {
      name: "Underarigeprotokoll",
      description: "Protokoll for sikker sysselsetting av arbeidstakere under 18 ar.",
    },
    procedures: [
      {
        name: "Risikovurdering for unge arbeidstakere",
        description: "Pliktig risikovurdering for inntak av arbeidstaker under 18 ar.",
        procedure_type: "safety",
        steps: [
          {
            title: "Kartlegg arbeidsoppgaver",
            description:
              "Identifiser hvilke oppgaver den unge skal utfore. Sjekk mot forbudte oppgaver: alkoholservering, farlige maskiner (oppvaskmaskin OK, slicer/frityr under 16 ikke OK), alenearbeid pa kveld.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 15,
          },
          {
            title: "Gjennomfor risikovurdering",
            description:
              "Vurder fysiske, kjemiske og psykiske farer. Dokumenter vurderingen skriftlig FoR den unge starter.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 20,
          },
          {
            title: "Innhent foresattes samtykke",
            description:
              "For arbeidstakere under 15 ar: skriftlig samtykke fra foresatte. For 15-17 ar: informer foresatte om arbeidstid og oppgaver.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 10,
          },
        ],
      },
      {
        name: "Arbeidstidskontroll for unge",
        description: "Overholdelse av arbeidstidsregler for arbeidstakere under 18 ar.",
        procedure_type: "standard",
        steps: [
          {
            title: "Sjekk arbeidstidsgrenser",
            description:
              "Under 15: maks 2t/dag pa skoledager, 7t frie dager. 15-17: maks 8t/dag, 40t/uke. Aldri mer enn dette.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Kontroller kveldsgrenser",
            description:
              "Under 15: ikke etter kl. 20:00. 15-17: ikke etter kl. 21:00 (23:00 med tariffavtale i serveringsbransjen). Aldri etter midnatt.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Sikre hvileperioder",
            description:
              "Minimum 12 timer sammenhengende hvile per dogn. Minimum 48 timer sammenhengende hvile per uke, inkludert sondag.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Underaarige-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "ung-q1",
          text: "Kan en 16-aring servere alkohol?",
          options: [
            { id: "ung-q1-a", text: "Ja, med opplaering" },
            { id: "ung-q1-b", text: "Ja, men bare ol og vin" },
            { id: "ung-q1-c", text: "Nei, man ma vaere 18 for a servere alkohol" },
            { id: "ung-q1-d", text: "Ja, hvis leder er til stede" },
          ],
          correctOptionId: "ung-q1-c",
        },
        {
          id: "ung-q2",
          text: "Hva ma gjores FoR en underarig starter i jobb?",
          options: [
            { id: "ung-q2-a", text: "Ingenting spesielt" },
            {
              id: "ung-q2-b",
              text: "Skriftlig risikovurdering og samtykke fra foresatte (under 15)",
            },
            { id: "ung-q2-c", text: "Bare signere arbeidskontrakt" },
            { id: "ung-q2-d", text: "La dem prove en dag forst" },
          ],
          correctOptionId: "ung-q2-b",
        },
      ],
    },
    confirmation: {
      name: "Underaarige-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar reglene for sysselsetting av underarige, inkludert arbeidstidsgrenser, forbudte oppgaver og risikovurderingskrav.",
      requires_signature: true,
    },
    longDescription:
      "Strenge regler for arbeidstakere under 18. Dekker arbeidstidsgrenser (varierer med alder), forbudte oppgaver (alkoholservering, farlig utstyr, alenearbeid kveld/natt), pliktig risikovurdering for oppstart, og krav til foresattes samtykke. Brudd kan medfoere bater og straffeansvar.",
    legalBasis: "AML kap. 11 + Forskrift om organisering kap. 12: Unge arbeidstakere",
  },

  // ── FILTER: Utenlandske arbeidstakere ──
  {
    id: "tpl-utenlandske-arbeidstakere",
    name: "Utenlandske arbeidstakere",
    description: "Retningslinjer for ansettelse og oppfolging av utenlandske arbeidstakere.",
    policy_type: "hr",
    filterKey: "foreignWorkers",
    protocol: {
      name: "Utenlandske arbeidstakere-protokoll",
      description:
        "Protokoll for lovlig ansettelse og likebehandling av utenlandske arbeidstakere.",
    },
    procedures: [
      {
        name: "Kontroll av arbeidstillatelse",
        description:
          "Verifisering av oppholdstillatelse og arbeidsrett for utenlandske arbeidstakere.",
        procedure_type: "standard",
        steps: [
          {
            title: "Sjekk oppholdsstatus",
            description:
              "EU/EoS-borgere: registreringsbevis. Tredjelandsborgere: gyldig oppholdstillatelse med arbeidsrett. Ta kopi av dokumentene.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Registrer i a-melding",
            description:
              "Alle utenlandske arbeidstakere ma registreres korrekt i a-meldingen med riktig nasjonalitet og ID-nummer.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Sikre allmenngjort lonn",
            description:
              "Serveringsbransjen er allmenngjort. Alle ansatte — uansett nasjonalitet — har krav pa minstelonnen i tariffavtalen.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Utenlandske-arbeidstakere-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "utl-q1",
          text: "Hva ma du sjekke for du ansetter en utenlandsk arbeidstaker?",
          options: [
            { id: "utl-q1-a", text: "Ingenting spesielt" },
            { id: "utl-q1-b", text: "At de har gyldig oppholdstillatelse med arbeidsrett" },
            { id: "utl-q1-c", text: "Bare at de snakker norsk" },
            { id: "utl-q1-d", text: "At de har bodd i Norge i 3 ar" },
          ],
          correctOptionId: "utl-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Utenlandske-arbeidstakere-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar reglene for ansettelse av utenlandske arbeidstakere, inkludert krav til arbeidstillatelse og allmenngjort lonn.",
      requires_signature: true,
    },
    longDescription:
      "Serveringsbransjen har mange utenlandske ansatte og er gjenstand for malrettede tilsyn fra Arbeidstilsynet. Denne retningslinjen dekker kontroll av arbeidstillatelse, krav til allmenngjort lonn (minstelonnen gjelder alle uansett nasjonalitet), og dokumentasjonsplikt.",
    legalBasis:
      "Utlendingsloven \u00A727 + Allmenngjoeringsloven: Arbeidstillatelse og minstelonnsgaranti",
  },

  // ── FILTER: Kassahandtering og ranforebygging ──
  {
    id: "tpl-kassahandtering-ran",
    name: "Kassahandtering og ranforebygging",
    description: "Retningslinjer for sikker kontanthandtering og forebygging av ran.",
    policy_type: "safety",
    filterKey: "cashHandling",
    protocol: {
      name: "Kassahandteringsprotokoll",
      description: "Protokoll for sikker kassahandtering, nattsafe og ranforebygging.",
    },
    procedures: [
      {
        name: "Ranforebyggende rutiner",
        description: "Tiltak for a redusere ranrisiko og beskytte ansatte.",
        procedure_type: "safety",
        steps: [
          {
            title: "Begrens kontanter i kassen",
            description:
              "Maks kontantbehold i kassen til et minimum. Legg overskytende i safe regelmessig gjennom skiftet.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Sikkerhet ved stenging",
            description:
              "Aldri forlat lokalet alene med kontanter pa kveld/natt. To personer ved kassaoppgjor. Varier bankinnleveringstidspunkt.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Ved ran: gi fra deg verdiene",
            description:
              "Din sikkerhet forst. Gi fra deg pengene uten motstand. Observer gjerningspersonen. Ring 112 nar det er trygt. Ikke ror noe pa astedet.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Etter ran: oppfolging",
            description:
              "Arbeidsgiver ma sikre psykologisk oppfolging for alle involvert. Rapporter til forsikring og Arbeidstilsynet.",
            step_order: 4,
            is_required: true,
            estimated_minutes: 10,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Kassahandtering-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "kassa-q1",
          text: "Hva gjor du hvis du blir utsatt for ran?",
          options: [
            { id: "kassa-q1-a", text: "Forsok a stoppe raneren" },
            {
              id: "kassa-q1-b",
              text: "Gi fra deg verdiene uten motstand og ring 112 nar det er trygt",
            },
            { id: "kassa-q1-c", text: "Lop ut av lokalet" },
            { id: "kassa-q1-d", text: "Aktiver alarmen mens raneren ser pa" },
          ],
          correctOptionId: "kassa-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Kassahandtering-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar rutinene for kassahandtering og ranforebygging, og vet hva jeg skal gjore ved et ran.",
      requires_signature: true,
    },
    longDescription:
      "Virksomheter som handterer kontanter ma risikovurdere ranfare og ha forebyggende tiltak. Dekker kontantbegrensning i kasse, saferutiner, sikkerhet ved alenearbeid kveld/natt, handtering under ran, og pliktig psykologisk oppfolging etterpå.",
    legalBasis: "AML \u00A73-2 + Forskrift om utforelse av arbeid kap. 23A: Vold og trusler",
  },

  // ── FILTER: Tipsh\u00e5ndtering ──
  {
    id: "tpl-tipshandtering",
    name: "Tipsh\u00e5ndtering",
    description: "Retningslinjer for innsamling, fordeling og rapportering av tips.",
    policy_type: "operational",
    filterKey: "tips",
    protocol: {
      name: "Tipsprotokoll",
      description: "Protokoll for rettferdig og lovlig h\u00e5ndtering av drikkepenger.",
    },
    procedures: [
      {
        name: "Tipsrutine",
        description: "Rutiner for innsamling, fordeling og skattemessig rapportering av tips.",
        procedure_type: "standard" as const,
        steps: [
          {
            title: "Innsamling",
            description:
              "Tips samles via kasse, Vipps eller kontant. Alle tips registreres i kassasystemet eller eget skjema. Ingenting holdes utenfor.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 5,
          },
          {
            title: "Fordeling",
            description:
              "Tips fordeles etter virksomhetens modell (likt, vektet etter timer, eller poolbasert). Fordelingsmodellen m\u00e5 v\u00e6re dokumentert og kjent for alle ansatte.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 10,
          },
          {
            title: "Rapportering til skatt",
            description:
              "Arbeidsgiver rapporterer tips via a-meldingen. Alle tips er skattepliktig inntekt. Arbeidsgiveravgift beregnes p\u00e5 tips.",
            step_order: 3,
            is_required: true,
            estimated_minutes: 10,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Tips-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "tips-q1",
          text: "Er tips skattepliktig inntekt i Norge?",
          options: [
            { id: "tips-q1-a", text: "Nei, tips er skattefritt" },
            { id: "tips-q1-b", text: "Ja, alle tips er skattepliktig inntekt" },
            { id: "tips-q1-c", text: "Bare tips over 500 kr" },
            { id: "tips-q1-d", text: "Bare kontanttips" },
          ],
          correctOptionId: "tips-q1-b",
        },
        {
          id: "tips-q2",
          text: "Hvem har ansvar for \u00e5 rapportere tips til skattemyndighetene?",
          options: [
            { id: "tips-q2-a", text: "Hver enkelt ansatt" },
            { id: "tips-q2-b", text: "Arbeidsgiver, via a-meldingen" },
            { id: "tips-q2-c", text: "Ingen, det er frivillig" },
            { id: "tips-q2-d", text: "Regnskapsf\u00f8rer" },
          ],
          correctOptionId: "tips-q2-b",
        },
      ],
    },
    confirmation: {
      name: "Tips-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forst\u00e5r tipsrutinene, og vet at alle tips er skattepliktig inntekt som rapporteres av arbeidsgiver.",
      requires_signature: true,
    },
    longDescription:
      "Alle tips er skattepliktig inntekt fra 2019. Arbeidsgiver m\u00e5 rapportere tips via a-meldingen og betale arbeidsgiveravgift. Denne retningslinjen dekker innsamling, fordelingsmodell og skattemessig rapportering. Skatteetaten utf\u00f8rer aktive kontroller i serveringsbransjen.",
    legalBasis: "Skatteloven \u00A75-1 + A-opplysningsloven: Tips er skattepliktig inntekt",
  },

  // 10. Emballasjehygiene (delivery)
  {
    id: "tpl-emballasjehygiene",
    name: "Emballasjehygiene",
    description: "Retningslinjer for hygienisk handtering og kontroll av emballasje for take-away.",
    policy_type: "haccp",
    filterKey: "delivery",
    protocol: {
      name: "Emballasjehygieneprotokoll",
      description: "Protokoll for hygienekontroll av emballasje brukt til matlevering.",
    },
    procedures: [
      {
        name: "Emballasjekontroll",
        description: "Kontroll av emballasjens tilstand og hygiene for bruk.",
        procedure_type: "standard",
        steps: [
          {
            title: "Visuell inspeksjon",
            description: "Sjekk at emballasje er uapnet, uskadet og innenfor holdbarhetsdato.",
            step_order: 1,
            is_required: true,
            estimated_minutes: 3,
          },
          {
            title: "Lagringskontroll",
            description: "Verifiser at emballasje lagres tort, rent og adskilt fra kjemikalier.",
            step_order: 2,
            is_required: true,
            estimated_minutes: 5,
          },
        ],
      },
    ],
    knowledgeTest: {
      name: "Emballasjehygiene-kunnskapstest",
      pass_threshold: 80,
      questions: [
        {
          id: "emb-q1",
          text: "Hvordan skal emballasje oppbevares?",
          options: [
            { id: "emb-q1-a", text: "Pa gulvet i narheten av kjokken" },
            { id: "emb-q1-b", text: "Tort, rent og adskilt fra kjemikalier" },
            { id: "emb-q1-c", text: "I kjolerommet sammen med mat" },
            { id: "emb-q1-d", text: "Ute pa bakrommet" },
          ],
          correctOptionId: "emb-q1-b",
        },
      ],
    },
    confirmation: {
      name: "Emballasjehygiene-bekreftelse",
      confirmation_text:
        "Jeg bekrefter at jeg har lest og forstar retningslinjene for emballasjehygiene.",
      requires_signature: true,
    },
    longDescription:
      "Hygienisk handtering og oppbevaring av emballasje brukt til take-away. Dekker inspeksjon av emballasje, lagringsforhold og sporbarhet. Kontaminert emballasje er en mattrygghetsrisiko.",
    legalBasis: "Forskrift om materialer og gjenstander i kontakt med naeringsmidler",
  },
];

// ══════════════════════════════════════════════════════════════
// Pure Helper
// ══════════════════════════════════════════════════════════════

export function getVisibleTemplates(filters: Record<FilterKey, boolean>) {
  const mandatory = GOVERNANCE_TEMPLATES.filter((t) => t.filterKey === null);
  const recommended = GOVERNANCE_TEMPLATES.filter(
    (t) => t.filterKey !== null && filters[t.filterKey],
  );
  return { mandatory, recommended };
}

// ══════════════════════════════════════════════════════════════
// Hooks
// ══════════════════════════════════════════════════════════════

export function useIndustryFilters(): Record<FilterKey, boolean> {
  const { workspace } = useWorkspace();
  const companyId = workspace.company_id;

  const { data } = useQuery({
    queryKey: ["industry-filters", companyId],
    queryFn: async () => {
      if (!companyId) return INDUSTRY_DEFAULTS.other;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("company")
        .select("industry")
        .eq("company_id", companyId)
        .single();

      if (error) throw error;

      const industry = (data.industry ?? "other") as Industry;
      return INDUSTRY_DEFAULTS[industry] ?? INDUSTRY_DEFAULTS.other;
    },
    enabled: !!companyId,
  });

  return data ?? INDUSTRY_DEFAULTS.other;
}

export function useCreatedPolicies() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("policy")
        .select("policy_id, name, protocol(protocol_id, procedure(procedure_id))")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateFromTemplate() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (template: GovernanceTemplate) => {
      const supabase = createClient();

      // 1. Insert policy
      const { data: policy, error: policyError } = await supabase
        .from("policy")
        .insert({
          name: template.name,
          statement: template.description,
          policy_type: template.policy_type,
          policy_scope: "workspace" as const,
          workspace_id: workspace.workspace_id,
          created_by: profileId!,
        })
        .select()
        .single();

      if (policyError) throw policyError;

      // 2. Insert protocol
      const { data: protocol, error: protocolError } = await supabase
        .from("protocol")
        .insert({
          name: template.protocol.name,
          description: template.protocol.description,
          policy_id: policy.policy_id,
          owner_profile_id: profileId!,
          workspace_id: workspace.workspace_id,
          created_by: profileId!,
        })
        .select()
        .single();

      if (protocolError) throw protocolError;

      // 3. Insert procedures + steps
      for (const proc of template.procedures) {
        const { data: procedure, error: procError } = await supabase
          .from("procedure")
          .insert({
            name: proc.name,
            description: proc.description,
            protocol_id: protocol.protocol_id,
            procedure_type: proc.procedure_type,
          })
          .select()
          .single();

        if (procError) throw procError;

        if (proc.steps.length > 0) {
          const { error: stepsError } = await supabase.from("procedure_step").insert(
            proc.steps.map((s) => ({
              title: s.title,
              description: s.description,
              procedure_id: procedure.procedure_id,
              step_order: s.step_order,
              is_required: s.is_required,
              estimated_minutes: s.estimated_minutes,
            })),
          );

          if (stepsError) throw stepsError;
        }
      }

      // 4. Insert knowledge test
      const { error: testError } = await supabase
        .from("knowledge_test")
        .insert({
          name: template.knowledgeTest.name,
          protocol_id: protocol.protocol_id,
          pass_threshold: template.knowledgeTest.pass_threshold,
          questions: template.knowledgeTest.questions as unknown as Json,
        })
        .select()
        .single();

      if (testError) throw testError;

      // 5. Insert confirmation
      const { error: confirmError } = await supabase
        .from("confirmation")
        .insert({
          name: template.confirmation.name,
          confirmation_text: template.confirmation.confirmation_text,
          protocol_id: protocol.protocol_id,
          requires_signature: template.confirmation.requires_signature,
        })
        .select()
        .single();

      if (confirmError) throw confirmError;

      return policy;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          trackingId: "governance-template-created",
          context: data.policy_id,
        },
      });
      toast.success("Retningslinje opprettet fra mal");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette retningslinje");
    },
  });
}
