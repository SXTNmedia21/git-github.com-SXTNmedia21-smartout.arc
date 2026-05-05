"use client";

import { useState, useCallback, useContext, useMemo } from "react";
import {
  CheckCircle2,
  Loader2,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHandbookTools } from "./tools/handbook-tools";
import { CHAPTERS } from "@/app/dashboard/_components/document-mode/chapters";
import type { ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";
import { upsertHandbookChapterAction } from "@/app/dashboard/governance/_actions/update-handbook-chapter-action";
import type { SetupWizardState } from "./wizard-state";

// ─── Types ───────────────────────────────────────────────

type SavedChapter = {
  handbook_chapter_id: string;
  chapter_key: string;
  title: string;
  content: Json;
};

// ─── TipTap JSON Helpers ─────────────────────────────────

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string }>;
};

function heading(level: number, text: string): TipTapNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function para(text: string): TipTapNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function bulletList(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((t) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
    })),
  };
}

function doc(...nodes: TipTapNode[]): TipTapNode {
  return { type: "doc", content: nodes };
}

// ─── Auto-generate chapter content from wizard state ─────

function generateChapterContent(
  chapterKey: ChapterKey,
  state: SetupWizardState | undefined,
): TipTapNode | null {
  if (!state) return null;
  const { scrapedData, extractedData } = state;
  const name = scrapedData.companyName ?? "Virksomheten";

  const extracted = extractedData.handbookSections?.find((s) => s.chapterKey === chapterKey);
  if (extracted) {
    return doc(heading(2, chapterKey), para(extracted.content));
  }

  switch (chapterKey) {
    case "identity-mission": {
      const n: TipTapNode[] = [
        heading(2, `Velkommen til ${name}`),
        para(
          `${name} er ${scrapedData.industryType ? `en ${scrapedData.industryType}-virksomhet` : "en arbeidsplass"} som setter kvalitet og gjestene i sentrum. Denne h\u00e5ndboken er din guide til hvordan vi jobber, hva vi st\u00e5r for, og hva som forventes av deg som ansatt.`,
        ),
      ];
      if (scrapedData.aboutUs) n.push(para(scrapedData.aboutUs));
      if (scrapedData.ourHistory)
        n.push(heading(3, "V\u00e5r historie"), para(scrapedData.ourHistory));
      if (scrapedData.ourConcept)
        n.push(heading(3, "V\u00e5rt konsept"), para(scrapedData.ourConcept));
      n.push(
        heading(3, "V\u00e5re verdier"),
        para(
          `Hos ${name} er vi opptatt av \u00e5 levere en opplevelse som gjestene husker. Det betyr at vi er oppmerksomme, im\u00f8tekommende og l\u00f8sningsorienterte \u2014 hver dag, hvert skift.`,
        ),
      );
      if (scrapedData.address) n.push(para(`Adresse: ${scrapedData.address}`));
      if (scrapedData.website) n.push(para(`Nettside: ${scrapedData.website}`));
      return doc(...n);
    }

    case "organization-model": {
      const depts = scrapedData.departments ?? [];
      const n: TipTapNode[] = [
        heading(2, "Organisasjon og roller"),
        para(
          `${name} er organisert i avdelinger som samarbeider tett for \u00e5 gi gjestene en helhetlig opplevelse. Hver avdeling har en ansvarlig leder som rapporterer til daglig leder.`,
        ),
      ];
      if (depts.length > 0) {
        n.push(heading(3, "Avdelinger"), bulletList(depts));
      }
      n.push(
        heading(3, "Ansvarsfordeling"),
        bulletList([
          "Daglig leder: overordnet ansvar for drift, \u00f8konomi og personal",
          "Skiftleder: ansvarlig for daglig drift p\u00e5 sitt skift",
          "Ansatte: f\u00f8lger retningslinjer, melder avvik, bidrar til godt arbeidsmilj\u00f8",
        ]),
        heading(3, "Rapporteringslinjer"),
        para(
          "Alle ansatte rapporterer til sin n\u00e6rmeste leder. Ved frav\u00e6r av leder g\u00e5r henvendelser til skiftleder eller daglig leder.",
        ),
      );
      return doc(...n);
    }

    case "daily-operations": {
      const n: TipTapNode[] = [
        heading(2, "Daglig drift"),
        para(
          `Driften hos ${name} f\u00f8lger faste rutiner som sikrer kvalitet og effektivitet. Alle ansatte skal kjenne disse rutinene og f\u00f8lge dem konsekvent.`,
        ),
      ];
      if (scrapedData.openingHours) {
        n.push(heading(3, "\u00c5pningstider"), para(scrapedData.openingHours));
      }
      const shifts = extractedData.shiftPatterns ?? [];
      if (shifts.length > 0) {
        n.push(
          heading(3, "Vakttyper"),
          bulletList(shifts.map((s) => `${s.name}: ${s.startTime}\u2013${s.endTime}`)),
        );
      }
      n.push(
        heading(3, "\u00c5pningsrutiner"),
        bulletList([
          "Ankomst minimum 15 minutter f\u00f8r skiftstart",
          "Sjekk ren uniform, synlig navneskilt",
          "Gjennomg\u00e5 dagens bookinger og eventuelle beskjeder",
          "Sjekk at alle stasjoner er klargjort og rent",
          "Sett p\u00e5 musikk, juster belysning, \u00e5pne d\u00f8rer",
        ]),
        heading(3, "Lukkerutiner"),
        bulletList([
          "Siste gjest \u2014 like god service som f\u00f8rste gjest",
          "Rydd, renholdssjekk alle omr\u00e5der",
          "Kassaoppgj\u00f8r og daglig rapport",
          "L\u00e5s d\u00f8rer, slukk lys, aktiver alarm",
          "Meld avvik eller uregelmessigheter til leder",
        ]),
      );
      return doc(...n);
    }

    case "safety-compliance": {
      const policies = extractedData.policies ?? [];
      const n: TipTapNode[] = [
        heading(2, "Sikkerhet, helse og milj\u00f8"),
        para(
          "Alle ansatte har b\u00e5de rett og plikt til et trygt arbeidsmilj\u00f8. HMS-arbeid er ikke noe vi gj\u00f8r ved siden av \u2014 det er en del av alt vi gj\u00f8r.",
        ),
      ];
      if (policies.length > 0) {
        n.push(heading(3, "Aktive retningslinjer"), bulletList(policies.map((p) => p.name)));
      }
      n.push(
        heading(3, "Brannvern"),
        bulletList([
          "Kj\u00f8nn deg til n\u00e6rmeste n\u00f8dutgang og slukkeutstyr f\u00f8rste dag",
          "Ved brannalarm: evakuer via merket r\u00f8mningsvei til m\u00f8teplass",
          "Ring 110 ved reell brann",
          "Brannslukkere og branntepper skal alltid v\u00e6re tilgjengelige og synlige",
        ]),
        heading(3, "F\u00f8rstehjelp"),
        bulletList([
          "F\u00f8rstehjelpsskrin finnes ved hovedinngang og p\u00e5 kj\u00f8kkenet",
          "Ved alvorlig skade: ring 113, sikre skadestedet, gi f\u00f8rstehjelp",
          "Alle hendelser skal dokumenteres i avvikssystemet",
        ]),
        heading(3, "Mattrygghet"),
        bulletList([
          "HACCP-basert internkontroll \u2014 alle som h\u00e5ndterer mat m\u00e5 kjenne prinsippene",
          "Temperaturlogg f\u00f8res daglig for kj\u00f8l, frys og varmholding",
          "H\u00e5ndvask f\u00f8r og etter matbehandling, etter toalettbes\u00f8k",
          "14 hovedallergener skal kunne kommuniseres til gjester",
        ]),
      );
      if (scrapedData.phone) n.push(para(`N\u00f8dtelefon: ${scrapedData.phone}`));
      return doc(...n);
    }

    case "communication": {
      const contactItems: string[] = [];
      if (scrapedData.phone) contactItems.push(`Telefon: ${scrapedData.phone}`);
      if (scrapedData.email) contactItems.push(`E-post: ${scrapedData.email}`);
      if (scrapedData.website) contactItems.push(`Nettside: ${scrapedData.website}`);
      if (scrapedData.socialLinks) {
        for (const [platform, url] of Object.entries(scrapedData.socialLinks)) {
          contactItems.push(`${platform}: ${url}`);
        }
      }
      const n: TipTapNode[] = [
        heading(2, "Kommunikasjon"),
        para(
          `God kommunikasjon er grunnlaget for god drift. Hos ${name} bruker vi f\u00f8lgende kanaler:`,
        ),
        bulletList([
          "Daglige beskjeder: oppslagstavle og skiftbriefing ved oppstart",
          "Vaktplan og endringer: via Smartout-appen",
          "Akutte henvendelser: direkte til skiftleder eller daglig leder",
          "Varsling om kritikkverdige forhold: se retningslinje for varsling",
        ]),
      ];
      if (contactItems.length > 0) {
        n.push(heading(3, "Kontaktinformasjon"), bulletList(contactItems));
      }
      n.push(
        heading(3, "Eskalering"),
        para("Dersom noe ikke kan l\u00f8ses p\u00e5 stedet, eskaleres det slik:"),
        bulletList([
          "1. Pr\u00f8v \u00e5 l\u00f8se det selv eller med kollegaer",
          "2. Kontakt skiftleder",
          "3. Kontakt daglig leder",
          "4. Ved alvorlige tilfeller: varsle skriftlig via Smartout",
        ]),
      );
      return doc(...n);
    }

    case "onboarding-training":
      return doc(
        heading(2, "Onboarding og oppl\u00e6ring"),
        para(
          `Alle nye ansatte i ${name} gjennomg\u00e5r en strukturert oppl\u00e6ringsprosess. M\u00e5let er at du skal f\u00f8le deg trygg og selvstendig i rollen s\u00e5 raskt som mulig.`,
        ),
        heading(3, "Oppl\u00e6ringsforl\u00f8pet"),
        bulletList([
          "F\u00f8r oppstart: Du mottar kontrakt, h\u00e5ndbok og tilgang til Smartout digitalt",
          "Dag 1: Omvisning, m\u00f8te med teamet, introduksjon til rutiner og systemer",
          "Uke 1\u20132: Oppl\u00e6ring i kjerneoppgaver med fadder. Du f\u00f8lger en erfaren kollega",
          "Uke 2\u20134: Gradvis selvstendighet. Kunnskapstester for retningslinjer",
          "Etter 4 uker: Evaluering med leder. Du er klar for selvstendige skift",
        ]),
        heading(3, "Hva du m\u00e5 best\u00e5"),
        bulletList([
          "Kunnskapstest for alle aktive retningslinjer (HMS, hygiene, allergen, etc.)",
          "Praktisk gjennomgang av \u00e5pnings- og lukkerutiner",
          "Signert bekreftelse p\u00e5 at du har lest og forst\u00e5tt h\u00e5ndboken",
        ]),
        heading(3, "Pr\u00f8vetid"),
        para(
          "Pr\u00f8vetiden er normalt 6 m\u00e5neder. I denne perioden har du tett oppf\u00f8lging med jevnlige samtaler med din n\u00e6rmeste leder.",
        ),
      );

    case "scheduling":
      return doc(
        heading(2, "Vaktplan og bemanning"),
        para(
          `Vaktplanen hos ${name} publiseres via Smartout minimum 2 uker i forveien. Det er ditt ansvar \u00e5 sjekke vaktplanen og m\u00f8te til avtalt tid.`,
        ),
        heading(3, "Vaktbytte"),
        bulletList([
          "Vaktbytte m\u00e5 godkjennes av leder f\u00f8r det er gyldig",
          "Du er ansvarlig for \u00e5 finne en erstatter ved bytte",
          "Byttet m\u00e5 meldes minimum 48 timer f\u00f8r vakten",
        ]),
        heading(3, "Frav\u00e6r og sykdom"),
        bulletList([
          "Sykefrav\u00e6r meldes til n\u00e6rmeste leder s\u00e5 tidlig som mulig, senest 1 time f\u00f8r skiftstart",
          "Egenmelding i inntil 3 dager, deretter legeerkl\u00e6ring",
          "Planlagt frav\u00e6r (ferie, permisjon) s\u00f8kes via Smartout",
        ]),
        heading(3, "Overtid"),
        para(
          "Overtid skal alltid avtales med leder p\u00e5 forh\u00e5nd. Uautorisert overtid godkjennes ikke. Kompensasjon f\u00f8lger tariffavtalen: 50 % for de f\u00f8rste 2 timene, deretter 100 %.",
        ),
      );

    case "quality-service": {
      const n: TipTapNode[] = [
        heading(2, "Kvalitet og service"),
        para(
          `Hos ${name} er kvalitet noe vi leverer i hvert m\u00f8te med gjesten \u2014 fra velkomsten til avskjeden. Vi m\u00e5ler oss ikke p\u00e5 hva vi tror vi leverer, men p\u00e5 hva gjesten opplever.`,
        ),
        heading(3, "Servicestandard"),
        bulletList([
          "Gjesten skal f\u00f8le seg velkommen innen 30 sekunder etter ankomst",
          "\u00d8yekontakt, smil og en hilsen \u2014 uansett hvor travelt det er",
          "Spesielle \u00f8nsker og allergier h\u00e5ndteres proaktivt, aldri defensivt",
          "Klager er en gave \u2014 takk gjesten for tilbakemeldingen og l\u00f8s problemet med en gang",
        ]),
      ];
      if (scrapedData.restaurantType || scrapedData.cuisineTypes?.length) {
        const typeInfo = [scrapedData.restaurantType, scrapedData.cuisineTypes?.join(", ")]
          .filter(Boolean)
          .join(" \u2014 ");
        n.push(para(`Konsept: ${typeInfo}`));
      }
      n.push(
        heading(3, "H\u00e5ndtering av klager"),
        bulletList([
          "Lytt uten \u00e5 avbryte",
          "Beklager og vis forst\u00e5else",
          "Tilby en l\u00f8sning med en gang (ny rett, rabatt, etc.)",
          "F\u00f8lg opp \u2014 sjekk at gjesten er forn\u00f8yd f\u00f8r de g\u00e5r",
          "Rapporter hendelsen s\u00e5 vi kan l\u00e6re av den",
        ]),
      );
      return doc(...n);
    }

    case "incident-response": {
      const n: TipTapNode[] = [
        heading(2, "Avvik og hendelser"),
        para(
          "N\u00e5r noe g\u00e5r galt \u2014 eller nesten g\u00e5r galt \u2014 er det viktig at det dokumenteres og f\u00f8lges opp. Avviksrapportering er ikke straff, det er l\u00e6ring.",
        ),
        heading(3, "Hva er et avvik?"),
        bulletList([
          "Driftsforstyrrelser: utstyr som ikke fungerer, mangel p\u00e5 varer",
          "Sikkerhetsavvik: fall, brann, innbrudd, vold eller trusler",
          "Kvalitetsavvik: feil i matlevering, gjesteklager, hygienebrist",
          "HMS-hendelser: arbeidsulykker, nestenulykker, helsefare",
        ]),
        heading(3, "Slik rapporterer du"),
        bulletList([
          "Meld fra til skiftleder med en gang",
          "Registrer avviket i Smartout innen skiftets slutt",
          "Beskriv hva som skjedde, n\u00e5r, hvor, og hvilke tiltak som ble gjort",
          "Alvorlige hendelser: ring n\u00f8dnummer f\u00f8rst, dokumenter etterp\u00e5",
        ]),
      ];
      if (scrapedData.phone) n.push(para(`Virksomhetens n\u00f8dtelefon: ${scrapedData.phone}`));
      n.push(
        heading(3, "N\u00f8dnumre"),
        bulletList(["Brann: 110", "Politi: 112", "Ambulanse: 113", "Giftinformasjon: 22 59 13 00"]),
      );
      return doc(...n);
    }

    case "kpi-review":
      return doc(
        heading(2, "Oppf\u00f8lging og evaluering"),
        para(
          `Hos ${name} f\u00f8lger vi opp driften systematisk for \u00e5 sikre at vi leverer p\u00e5 det niv\u00e5et vi har satt oss. Tallene gir oss innsikt \u2014 samtalene gir oss retning.`,
        ),
        heading(3, "Daglig"),
        bulletList(["Omsetning vs. budsjett", "Antall gjester og snittpris", "Avvik og hendelser"]),
        heading(3, "Ukentlig"),
        bulletList([
          "Teammøte: hva gikk bra, hva kan forbedres?",
          "Gjennomgang av gjesteklager og avvik",
          "Status p\u00e5 oppl\u00e6ring og readiness",
        ]),
        heading(3, "M\u00e5nedlig"),
        bulletList([
          "L\u00f8nnskostnader vs. budsjett",
          "Medarbeidersamtaler og oppf\u00f8lging av pr\u00f8vetid",
          "Gjennomgang av retningslinjer \u2014 er de oppdaterte?",
        ]),
      );

    default:
      return null;
  }
}

// ─── Toolbar ─────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `rounded-md p-2 transition-colors ${
      active
        ? "bg-brand-orange/20 text-brand-orange"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <div className="border-border flex items-center gap-1 border-b px-3 py-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive("heading", { level: 2 }))}
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive("heading", { level: 3 }))}
      >
        <Heading3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
      >
        <ListOrdered className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Inline Chapter Editor ───────────────────────────────

function ChapterEditor({
  chapterKey,
  chapterTitle,
  existingContent,
  onSaved,
  onCancel,
}: {
  chapterKey: ChapterKey;
  chapterTitle: string;
  existingContent: Json | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: (existingContent as Record<string, unknown>) ?? "",
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 `,
      },
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error("Editor not initialized");

      const content = editor.getJSON() as unknown as Json;

      // Resolve existing chapter_id (if any) before delegating to the Server
      // Action so the action can branch update vs create deterministically.
      const { data: existing } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("chapter_key", chapterKey)
        .maybeSingle();

      const result = await upsertHandbookChapterAction({
        chapter_id: existing?.handbook_chapter_id ?? null,
        chapter_key: chapterKey,
        title: chapterTitle,
        content,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      toast.success(`«${chapterTitle}» lagret`);
      void queryClient.invalidateQueries({
        queryKey: ["handbook-chapters", workspace.workspace_id],
      });
      void emit({
        event: "button clicked",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          trackingId: "handbook-chapter-saved",
          context: chapterKey,
        },
      });
      onSaved();
    },
    onError: () => {
      toast.error("Kunne ikke lagre kapitlet");
    },
  });

  return (
    <div className="border-border bg-card mt-2 overflow-hidden rounded-xl border">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="border-border flex items-center justify-end gap-2 border-t px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            saveMutation.isPending
              ? "cursor-not-allowed opacity-50"
              : "bg-brand-orange hover:bg-brand-orange/90 text-white"
          }`}
        >
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Lagre
        </button>
      </div>
    </div>
  );
}

// ─── HandbookSetupStep ───────────────────────────────────

export function HandbookSetupStep({ wizardState }: { wizardState?: SetupWizardState }) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  const [editingKey, setEditingKey] = useState<ChapterKey | null>(null);

  // ── Query saved chapters ──
  const { data: savedChapters } = useQuery({
    queryKey: ["handbook-chapters", workspace.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id, chapter_key, title, content")
        .eq("workspace_id", workspace.workspace_id);
      if (error) throw error;
      return data as SavedChapter[];
    },
  });

  const savedMap = useMemo(() => {
    const map = new Map<string, SavedChapter>();
    for (const ch of savedChapters ?? []) {
      map.set(ch.chapter_key, ch);
    }
    return map;
  }, [savedChapters]);

  const handleWrite = useCallback((key: ChapterKey) => {
    setEditingKey(key);
  }, []);

  const handleSaved = useCallback(() => {
    setEditingKey(null);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingKey(null);
  }, []);

  // ── Generate content from wizard state ──
  const generatedMap = useMemo(() => {
    const map = new Map<ChapterKey, TipTapNode>();
    for (const chapter of CHAPTERS) {
      const content = generateChapterContent(chapter.key, wizardState);
      if (content) map.set(chapter.key, content);
    }
    return map;
  }, [wizardState]);

  const completedCount = savedMap.size;

  const savedChaptersArray = useMemo(() => Array.from(savedMap.values()), [savedMap]);

  const handbookTools = useHandbookTools(savedChaptersArray, CHAPTERS.length);
  useRegisterTools("wizard-setup-handbook", handbookTools);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-bold">Personalhåndbok</h3>
        <span className="text-muted-foreground text-sm">
          {completedCount}/{CHAPTERS.length} kapitler
        </span>
      </div>

      {/* Chapter list */}
      <div className="space-y-2">
        {CHAPTERS.map((chapter) => {
          const Icon = chapter.icon;
          const isSaved = savedMap.has(chapter.key);
          const isEditing = editingKey === chapter.key;
          const savedData = savedMap.get(chapter.key);
          const generatedContent = generatedMap.get(chapter.key);
          const hasGenerated = !isSaved && !!generatedContent;

          return (
            <div key={chapter.key}>
              <div
                className={`border-border bg-card flex items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
                  isSaved ? "border-success/30" : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">
                      {chapter.number}. {chapter.title}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">{chapter.description}</p>
                  </div>
                </div>

                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {isSaved && <CheckCircle2 className="text-success h-5 w-5" />}
                  {hasGenerated && !isSaved && (
                    <span className="bg-brand-orange/10 text-brand-orange rounded-full px-2 py-0.5 text-xs font-medium">
                      Klar
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleWrite(chapter.key)}
                    className={
                      isSaved
                        ? "text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                        : "bg-brand-orange hover:bg-brand-orange/90 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-colors"
                    }
                  >
                    {isSaved ? "Rediger" : "Skriv"}
                  </button>
                </div>
              </div>

              {isEditing && (
                <ChapterEditor
                  chapterKey={chapter.key}
                  chapterTitle={chapter.title}
                  existingContent={
                    savedData?.content ?? (generatedContent as unknown as Json) ?? null
                  }
                  onSaved={handleSaved}
                  onCancel={handleCancel}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
