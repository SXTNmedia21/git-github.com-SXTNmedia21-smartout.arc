"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Highlighter,
  Undo,
  Redo,
} from "lucide-react";

type ToolbarProps = {
  editor: Editor | null;
  isDark: boolean;
};

type ToolbarButton = {
  icon: React.ElementType;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
};

const TOOLBAR_ITEMS: (ToolbarButton | "separator")[] = [
  {
    icon: Bold,
    label: "Fet",
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
  },
  {
    icon: Italic,
    label: "Kursiv",
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
  },
  {
    icon: UnderlineIcon,
    label: "Understreking",
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive("underline"),
  },
  {
    icon: Highlighter,
    label: "Markering",
    action: (e) => e.chain().focus().toggleHighlight().run(),
    isActive: (e) => e.isActive("highlight"),
  },
  "separator",
  {
    icon: Heading1,
    label: "Overskrift 1",
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    icon: Heading2,
    label: "Overskrift 2",
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    icon: Heading3,
    label: "Overskrift 3",
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
  },
  "separator",
  {
    icon: List,
    label: "Punktliste",
    action: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
  },
  {
    icon: ListOrdered,
    label: "Nummerert liste",
    action: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
  },
  {
    icon: Quote,
    label: "Sitat",
    action: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
  },
  "separator",
  {
    icon: Undo,
    label: "Angre",
    action: (e) => e.chain().focus().undo().run(),
  },
  {
    icon: Redo,
    label: "Gjør om",
    action: (e) => e.chain().focus().redo().run(),
  },
];

export function DocumentModeToolbar({ editor, isDark }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div
      className={`flex items-center gap-0.5 border-b px-4 py-2 ${
        isDark
          ? "border-border bg-card/50"
          : "border-[oklch(0.90_0.006_55)] bg-[oklch(0.97_0.003_55)]"
      }`}
    >
      {TOOLBAR_ITEMS.map((item, i) => {
        if (item === "separator") {
          return (
            <div
              key={`sep-${i}`}
              className={`mx-1 h-5 w-px ${isDark ? "bg-border" : "bg-[oklch(0.88_0.006_55)]"}`}
            />
          );
        }
        const Icon = item.icon;
        const active = item.isActive?.(editor) ?? false;
        return (
          <button
            key={item.label}
            onClick={() => item.action(editor)}
            title={item.label}
            className={`rounded-md p-1.5 transition-colors ${
              active
                ? isDark
                  ? "bg-orange-500/15 text-orange-400"
                  : "bg-orange-100 text-orange-600"
                : isDark
                  ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  : "text-[oklch(0.50_0.015_50)] hover:bg-[oklch(0.93_0.005_55)] hover:text-[oklch(0.30_0.02_50)]"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
