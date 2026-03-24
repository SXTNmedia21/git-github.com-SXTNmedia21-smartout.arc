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
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CHAPTERS } from "@/app/dashboard/_components/document-mode/chapters";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import type { ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";
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
  const companyName = scrapedData.companyName ?? "Virksomheten";

  switch (chapterKey) {
    case "identity-mission": {
      const nodes: TipTapNode[] = [
        heading(2, `Om ${companyName}`),
        para(
          scrapedData.industryType
            ? `${companyName} er en ${scrapedData.industryType}-virksomhet.`
            : `${companyName} — vår identitet og misjon.`,
        ),
      ];
      if (scrapedData.address) nodes.push(para(`Adresse: ${scrapedData.address}`));
      if (scrapedData.website) nodes.push(para(`Nettside: ${scrapedData.website}`));
      nodes.push(
        heading(3, "Serviceløfte"),
        para("Beskriv virksomhetens serviceløfte og merkevare her."),
      );
      return doc(...nodes);
    }

    case "organization-model": {
      const nodes: TipTapNode[] = [heading(2, "Organisasjonsmodell")];
      const depts = scrapedData.departments ?? [];
      if (depts.length > 0) {
        nodes.push(para("Virksomheten har følgende avdelinger:"), bulletList(depts));
      } else {
        nodes.push(para("Legg til avdelingene og deres ansvarsområder her."));
      }
      nodes.push(heading(3, "Roller og ansvar"), para("Beskriv rollene i organisasjonen."));
      return doc(...nodes);
    }

    case "daily-operations": {
      const nodes: TipTapNode[] = [heading(2, "Daglig Drift")];
      if (scrapedData.openingHours) {
        nodes.push(para(`Åpningstider: ${scrapedData.openingHours}`));
      }
      const shifts = extractedData.shiftPatterns ?? [];
      if (shifts.length > 0) {
        nodes.push(
          heading(3, "Vakter"),
          bulletList(shifts.map((s) => `${s.name}: ${s.startTime}–${s.endTime}`)),
        );
      }
      nodes.push(
        heading(3, "Åpningsrutiner"),
        para("Beskriv hva som skal gjøres ved åpning."),
        heading(3, "Lukkerutiner"),
        para("Beskriv hva som skal gjøres ved lukking."),
      );
      return doc(...nodes);
    }

    case "safety-compliance": {
      const nodes: TipTapNode[] = [heading(2, "Sikkerhet og Etterlevelse")];
      const policies = extractedData.policies ?? [];
      const safetyPolicies = policies.filter(
        (p) =>
          p.name.toLowerCase().includes("sikkerhet") ||
          p.name.toLowerCase().includes("hygiene") ||
          p.name.toLowerCase().includes("haccp"),
      );
      if (safetyPolicies.length > 0) {
        nodes.push(
          para("Følgende retningslinjer gjelder:"),
          bulletList(safetyPolicies.map((p) => p.name)),
        );
      }
      nodes.push(
        heading(3, "Mattrygghet"),
        para("Beskriv rutiner for mattrygghet og allergenbehandling."),
        heading(3, "Brannvern"),
        para("Beskriv brannvernsrutiner og evakueringsplan."),
      );
      return doc(...nodes);
    }

    case "communication":
      return doc(
        heading(2, "Kommunikasjon"),
        para("Beskriv kommunikasjonskanalene i virksomheten."),
        heading(3, "Eskalering"),
        para("Beskriv eskaleringsprosedyren ved problemer eller klager."),
      );

    case "onboarding-training":
      return doc(
        heading(2, "Onboarding og Opplæring"),
        para(`Nye ansatte i ${companyName} gjennomgår følgende onboarding-prosess:`),
        bulletList([
          "Pre-boarding: dokumenter og kontrakt sendes digitalt",
          "Første dag: omvisning, introduksjon, systemtilganger",
          "Opplæringsperiode: veiledning og kunnskapstester",
          "Fullført: selvstendig i rollen",
        ]),
      );

    case "scheduling": {
      const nodes: TipTapNode[] = [heading(2, "Vaktplan og Bemanning")];
      if (state.seasonCreated) {
        nodes.push(para("Sesong er opprettet og styrer bemanningsplanlegging."));
      }
      nodes.push(
        heading(3, "Vaktbytter"),
        para("Beskriv reglene for vaktbytte og varslingsfrist."),
        heading(3, "Overtid"),
        para("Beskriv reglene for overtid."),
      );
      return doc(...nodes);
    }

    case "quality-service":
      return doc(
        heading(2, "Kvalitet og Service"),
        para("Beskriv servicenivået og standardene gjestene skal oppleve."),
        heading(3, "Service Recovery"),
        para("Beskriv hvordan klager og misnøye håndteres."),
      );

    case "incident-response":
      return doc(
        heading(2, "Avvik og Hendelser"),
        heading(3, "Kategorier"),
        bulletList(["Driftsforstyrrelser", "Sikkerhetsavvik", "Kvalitetsavvik", "HMS-hendelser"]),
        heading(3, "Rapportering"),
        para("Beskriv prosedyren for å rapportere avvik."),
      );

    case "kpi-review":
      return doc(
        heading(2, "KPI og Evaluering"),
        heading(3, "Daglig oppfølging"),
        para("Beskriv hvilke tall som følges opp daglig."),
        heading(3, "Ukentlig evaluering"),
        para("Beskriv ukentlig gjennomgang og teamsamlinger."),
      );

    default:
      return null;
  }
}

// ─── Toolbar ─────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `rounded p-1.5 transition-colors ${
      active
        ? "bg-orange-500/20 text-orange-500"
        : "text-muted-foreground hover:bg-accent hover:text-zinc-800"
    }`;

  return (
    <div className={`flex items-center gap-1 border-b px-2 py-1.5 ${"border-border"}`}>
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

      // Select-then-upsert pattern
      const { data: existing } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("chapter_key", chapterKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("handbook_chapter")
          .update({
            title: chapterTitle,
            content,
            updated_by: profileId,
          })
          .eq("handbook_chapter_id", existing.handbook_chapter_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("handbook_chapter").insert({
          chapter_key: chapterKey,
          title: chapterTitle,
          content,
          workspace_id: workspace.workspace_id,
          updated_by: profileId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`«${chapterTitle}» lagret`);
      void queryClient.invalidateQueries({
        queryKey: ["handbook-chapters", workspace.workspace_id],
      });
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
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
    <div className={`mt-2 overflow-hidden rounded-xl border ${"border-border bg-white"}`}>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className={`flex items-center justify-end gap-2 border-t px-3 py-2 ${"border-border"}`}>
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${"text-muted-foreground hover:bg-accent hover:text-zinc-700"}`}
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
              : "bg-orange-500 text-white hover:bg-orange-600"
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

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${"text-muted-foreground"}`}>Håndbok-kapitler</h3>
          <HelpTip text="Kapitlene er forhåndsutfylt basert på det du la inn i steg 1–6. Gå gjennom og rediger der det trengs." />
        </div>
        <span className={`text-xs font-medium ${"text-muted-foreground"}`}>
          {completedCount} av {CHAPTERS.length} fullført
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
              {/* Chapter row */}
              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${"border-border bg-white"}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${"bg-muted"}`}
                  >
                    <Icon className={`h-4 w-4 ${"text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${"text-foreground"}`}>
                      {chapter.number}. {chapter.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-xs ${"text-muted-foreground"}`}>
                        {chapter.description}
                      </p>
                      {hasGenerated && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${"bg-brand-orange text-brand-orange"}`}
                        >
                          Forhåndsutfylt
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {isSaved ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-success h-5 w-5" />
                      <button
                        type="button"
                        onClick={() => handleWrite(chapter.key)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${"text-muted-foreground hover:bg-accent hover:text-zinc-700"}`}
                      >
                        Rediger
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleWrite(chapter.key)}
                        className="bg-brand-orange rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                      >
                        Skriv
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) setEditingKey(null);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${"text-muted-foreground hover:text-zinc-600"}`}
                      >
                        Hopp over
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline editor */}
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
