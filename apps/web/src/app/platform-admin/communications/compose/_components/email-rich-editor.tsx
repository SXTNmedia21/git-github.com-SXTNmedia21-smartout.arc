"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";

type EmailRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onAiCorrect?: (text: string) => Promise<string>;
  placeholder?: string;
};

export function EmailRichEditor({
  value,
  onChange,
  onAiCorrect,
  placeholder,
}: EmailRichEditorProps) {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TiptapLink.configure({ openOnClick: false }),
      TiptapPlaceholder.configure({
        placeholder: placeholder ?? "Skriv meldingen din...",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-3 py-2",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  async function handleAiCorrect() {
    if (!editor || !onAiCorrect) return;
    const text = editor.getText();
    if (!text.trim()) return;

    setIsAiLoading(true);
    try {
      const corrected = await onAiCorrect(text);
      editor.commands.setContent(corrected);
    } finally {
      setIsAiLoading(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="border-border rounded-md border">
      <div className="border-border flex items-center gap-1 border-b px-2 py-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Toggle>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>

        {onAiCorrect && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAiCorrect}
              disabled={isAiLoading}
              className="gap-1 text-xs"
            >
              {isAiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI
            </Button>
          </>
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
