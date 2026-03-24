"use client";

/**
 * NoteInput — Simple textarea + submit for adding shift notes.
 * Calls useShiftNotes.addNote() and clears input on success.
 */

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type NoteInputProps = {
  onSubmit: (content: string) => Promise<unknown>;
  isLoading?: boolean;
};

export function NoteInput({ onSubmit, isLoading }: NoteInputProps) {
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      await onSubmit(trimmed);
      setContent("");
    } catch {
      // Error handled by the hook (toast)
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="border-border/50 flex gap-2 border-t p-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Skriv et notat..."
        className="border-border/50 bg-card/50 min-h-[40px] resize-none text-sm"
        rows={1}
        disabled={isLoading}
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => void handleSubmit()}
        disabled={!content.trim() || isLoading}
        className="text-brand-orange hover:text-brand-orange-light shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
