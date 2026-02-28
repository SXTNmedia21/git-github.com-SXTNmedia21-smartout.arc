"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorToolbar } from "./toolbar";
import { PlaceholderPanel } from "./placeholder-panel";
import type { PlaceholderItem } from "./placeholder-panel";
import type { SaveTemplateData } from "@/app/platform-admin/contracts/templates/[id]/edit/save-action";

const CONTRACT_TYPES = [
  { value: "client", label: "Klient" },
  { value: "employee", label: "Ansatt" },
  { value: "haccp", label: "HACCP" },
  { value: "training", label: "Opplaring" },
  { value: "season", label: "Sesong" },
  { value: "custom", label: "Egendefinert" },
];

type TemplateEditorProps = {
  templateId: string;
  initialData: {
    name: string;
    contract_type: string;
    content_html: string;
    placeholders: PlaceholderItem[];
  };
  onSave: (data: SaveTemplateData) => Promise<{ templateId: string }>;
};

export function TemplateEditor({ templateId, initialData, onSave }: TemplateEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData.name);
  const [contractType, setContractType] = useState(initialData.contract_type);
  const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>(initialData.placeholders);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const contentRef = useRef(initialData.content_html);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TiptapPlaceholder.configure({
        placeholder: "Begynn a skrive kontraktsmalen...",
      }),
    ],
    content: initialData.content_html,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[500px] px-6 py-4 dark:prose-invert",
      },
    },
    onUpdate: ({ editor: ed }) => {
      contentRef.current = ed.getHTML();
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await onSave({
        name: name.trim() || "Uten navn",
        contract_type: contractType,
        content_html: editor.getHTML(),
        placeholders,
      });

      // For existing templates, show success feedback
      if (templateId !== "new") {
        setSaveMessage("Lagret!");
        setTimeout(() => setSaveMessage(null), 2000);
      }
      // For new templates, redirect happens in the server action
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke lagre malen";
      // redirect() throws NEXT_REDIRECT — don't treat as error
      if (message.includes("NEXT_REDIRECT")) return;
      setSaveMessage(message);
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  }, [editor, name, contractType, placeholders, onSave, templateId]);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-border bg-background flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/contracts/templates"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-64 text-sm font-semibold"
            placeholder="Malnavn"
          />
          <select
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
            className="bg-background border-input h-8 rounded-md border px-2 text-sm"
          >
            {CONTRACT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && <span className="text-muted-foreground text-xs">{saveMessage}</span>}
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            {isSaving ? "Lagrer..." : "Lagre"}
          </Button>
        </div>
      </div>

      {/* Main content: Editor (70%) + Placeholder Panel (30%) */}
      <div className="flex min-h-0 flex-1">
        {/* Editor side */}
        <div className="flex w-[70%] flex-col">
          <EditorToolbar editor={editor} />
          <div className="flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Placeholder Panel side */}
        <div className="border-border w-[30%] border-l">
          <PlaceholderPanel
            placeholders={placeholders}
            onChange={setPlaceholders}
            editor={editor}
            contentHtml={contentRef.current}
          />
        </div>
      </div>
    </div>
  );
}
