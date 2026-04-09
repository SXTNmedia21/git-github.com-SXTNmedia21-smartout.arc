"use client";

import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo,
  Redo,
  Minus,
  Quote,
  SquarePlus,
  Paperclip,
  ChevronDown,
  Pen,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EditorToolbarV2Props = {
  editor: Editor | null;
  /** "preview" hides template-authoring dropdowns (Seksjon, Felt) */
  mode?: "full" | "preview";
};

type ToolbarButtonProps = {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
};

function ToolbarButton({ onClick, isActive, disabled, children, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="bg-border mx-1 h-6 w-px" />;
}

type DropdownItem = {
  label: string;
  icon: React.ReactNode;
  action: () => void;
};

function ToolbarDropdown({
  label,
  icon,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  items: DropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-accent inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors"
      >
        {icon}
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="bg-popover border-border absolute top-full left-0 z-50 mt-1 min-w-48 rounded-md border py-1 shadow-md">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorToolbarV2({ editor, mode = "full" }: EditorToolbarV2Props) {
  if (!editor) return null;

  const sectionItems: DropdownItem[] = [
    {
      label: "Generell seksjon",
      icon: <FileText className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "clauseBlock",
            attrs: {
              clauseId: crypto.randomUUID(),
              title: "Ny seksjon",
              category: "general",
            },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Innhold her..." }] }],
          })
          .run(),
    },
    {
      label: "Parter",
      icon: <FileText className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "clauseBlock",
            attrs: {
              clauseId: crypto.randomUUID(),
              title: "Parter",
              category: "parties",
            },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Avtalepartenes informasjon her..." }],
              },
            ],
          })
          .run(),
    },
    {
      label: "Priser og vilkar",
      icon: <FileText className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "clauseBlock",
            attrs: {
              clauseId: crypto.randomUUID(),
              title: "Priser og vilkar",
              category: "pricing",
            },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Prisdetaljer..." }] }],
          })
          .run(),
    },
    {
      label: "Leveranser",
      icon: <FileText className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "clauseBlock",
            attrs: {
              clauseId: crypto.randomUUID(),
              title: "Leveranser",
              category: "deliverables",
            },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Leveranser..." }] }],
          })
          .run(),
    },
    {
      label: "Juridisk",
      icon: <FileText className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "clauseBlock",
            attrs: {
              clauseId: crypto.randomUUID(),
              title: "Juridisk klausul",
              category: "legal",
            },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Klausul..." }] }],
          })
          .run(),
    },
    {
      label: "Signaturer",
      icon: <FileText className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "clauseBlock",
            attrs: {
              clauseId: crypto.randomUUID(),
              title: "Signaturer",
              category: "signatures",
            },
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Denne avtalen er gyldig nar begge parter har signert." },
                ],
              },
            ],
          })
          .run(),
    },
  ];

  const fieldItems: DropdownItem[] = [
    {
      label: "Plassholder",
      icon: <Paperclip className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "placeholderField",
            attrs: {
              key: "ny_plassholder",
              label: "Ny plassholder",
              placeholderType: "manual",
            },
          })
          .run(),
    },
    {
      label: "Signaturfelt",
      icon: <Pen className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "signatureField",
            attrs: {
              role: "recipient",
              label: "Signatur",
              required: true,
            },
          })
          .run(),
    },
    {
      label: "Datofelt",
      icon: <Calendar className="h-3.5 w-3.5" />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "dateField",
            attrs: {
              key: "dato",
              label: "Dato",
            },
          })
          .run(),
    },
  ];

  return (
    <div className="border-border bg-background flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Fet (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Kursiv (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Understreket (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Overskrift 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Overskrift 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Overskrift 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Punktliste"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Nummerert liste"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Sitat"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horisontal linje"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      {mode === "full" && (
        <>
          <ToolbarDivider />

          {/* Insert dropdowns — only in full template-authoring mode */}
          <ToolbarDropdown
            label="Seksjon"
            icon={<SquarePlus className="h-3.5 w-3.5" />}
            items={sectionItems}
          />
          <ToolbarDropdown
            label="Felt"
            icon={<Paperclip className="h-3.5 w-3.5" />}
            items={fieldItems}
          />
        </>
      )}

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Angre (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Gjenopprett (Ctrl+Shift+Z)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
