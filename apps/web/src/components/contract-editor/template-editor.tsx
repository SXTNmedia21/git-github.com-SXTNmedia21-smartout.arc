"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Upload } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetadataBar } from "./metadata-bar";
import { EditorToolbarV2 } from "./editor-toolbar-v2";
import { SidebarPanel } from "./sidebar-panel";
import { StatusBar } from "./status-bar";
import type { PlaceholderItem } from "./placeholder-panel";
import type {
  SaveTemplateData,
  TemplateAttachment,
} from "@/app/platform-admin/contracts/templates/[id]/edit/save-action";
import { uploadAttachment } from "@/app/platform-admin/contracts/templates/[id]/edit/upload-action";
import { deleteAttachment } from "@/app/platform-admin/contracts/templates/[id]/edit/delete-attachment-action";

import {
  ClauseBlock,
  PlaceholderField,
  SignatureField,
  SectionSummary,
  DateField,
  HighlightSection,
} from "./extensions";

type TemplateEditorProps = {
  templateId: string;
  initialData: {
    name: string;
    contract_type: string;
    content_html: string;
    placeholders: PlaceholderItem[];
    description?: string;
    language?: string;
    status?: string;
    attachments?: TemplateAttachment[];
  };
  onSave: (data: SaveTemplateData) => Promise<{ templateId: string }>;
};

export function TemplateEditor({ templateId, initialData, onSave }: TemplateEditorProps) {
  const router = useRouter();

  // Core state
  const [name, setName] = useState(initialData.name);
  const [contractType, setContractType] = useState(initialData.contract_type);
  const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>(initialData.placeholders);
  const [description, setDescription] = useState(initialData.description || "");
  const [language, setLanguage] = useState(initialData.language || "no");
  const [status, setStatus] = useState(initialData.status || "draft");
  const [attachments, setAttachments] = useState<TemplateAttachment[]>(
    initialData.attachments || [],
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const contentRef = useRef(initialData.content_html);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TiptapPlaceholder.configure({
        placeholder: "Begynn a skrive kontraktsmalen...",
      }),
      ClauseBlock,
      PlaceholderField,
      SignatureField,
      SectionSummary,
      DateField,
      HighlightSection,
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
      setIsDirty(true);
    },
  });

  const handleSave = useCallback(
    async (newStatus?: string) => {
      if (!editor) return;
      setIsSaving(true);

      try {
        await onSave({
          name: name.trim() || "Uten navn",
          contract_type: contractType,
          content_html: editor.getHTML(),
          placeholders,
          description: description || undefined,
          language,
          status: newStatus || status,
          attachments,
        });

        if (newStatus) setStatus(newStatus);
        setIsDirty(false);
        setLastSavedAt(new Date());

        // For new templates, redirect happens in the server action
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kunne ikke lagre malen";
        // redirect() throws NEXT_REDIRECT — don't treat as error
        if (message.includes("NEXT_REDIRECT")) return;
        alert(message);
      } finally {
        setIsSaving(false);
      }
    },
    [editor, name, contractType, placeholders, description, language, status, attachments, onSave],
  );

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // File upload handler
  const handleUpload = useCallback(
    async (file: File) => {
      const effectiveId = templateId === "new" ? "draft" : templateId;
      const formData = new FormData();
      formData.set("file", file);
      formData.set("templateId", effectiveId);

      const { attachment } = await uploadAttachment(formData);
      setAttachments((prev) => [...prev, attachment]);
      setIsDirty(true);
    },
    [templateId],
  );

  // File remove handler
  const handleRemoveAttachment = useCallback(async (attachment: TemplateAttachment) => {
    await deleteAttachment(attachment.file_path);
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    setIsDirty(true);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="border-border bg-background flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/contracts/templates"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Badge variant="outline" className="text-xs">
            {status === "draft" ? "Utkast" : status === "active" ? "Aktiv" : "Arkivert"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave()}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            Lagre
          </Button>
          {status === "draft" && (
            <Button size="sm" onClick={() => handleSave("active")} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3.5 w-3.5" />
              )}
              Publiser
            </Button>
          )}
        </div>
      </div>

      {/* Metadata bar */}
      <MetadataBar
        name={name}
        onNameChange={(v) => {
          setName(v);
          setIsDirty(true);
        }}
        contractType={contractType}
        onContractTypeChange={(v) => {
          setContractType(v);
          setIsDirty(true);
        }}
        language={language}
        onLanguageChange={(v) => {
          setLanguage(v);
          setIsDirty(true);
        }}
        status={status}
        description={description}
        onDescriptionChange={(v) => {
          setDescription(v);
          setIsDirty(true);
        }}
      />

      {/* Enhanced toolbar */}
      <EditorToolbarV2 editor={editor} />

      {/* Main content: Editor (70%) + Sidebar (30%) */}
      <div className="flex min-h-0 flex-1">
        {/* Editor side */}
        <div className="flex w-[70%] flex-col">
          <div className="flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="border-border w-[30%] border-l">
          <SidebarPanel
            editor={editor}
            placeholders={placeholders}
            onPlaceholdersChange={(p) => {
              setPlaceholders(p);
              setIsDirty(true);
            }}
            contentHtml={contentRef.current}
            attachments={attachments}
            onUpload={handleUpload}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        editor={editor}
        lastSavedAt={lastSavedAt}
        isSaving={isSaving}
        isDirty={isDirty}
        attachmentCount={attachments.length}
      />
    </div>
  );
}
