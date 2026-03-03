"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WhisperInputProps = {
  sessionId: string | null;
  onWhisper: (sessionId: string, message: string) => void;
};

export function WhisperInput({ sessionId, onWhisper }: WhisperInputProps) {
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !message.trim()) return;
    onWhisper(sessionId, message.trim());
    setMessage("");
  }

  return (
    <form onSubmit={handleSubmit} className="border-border flex gap-2 border-t p-3">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Whisper to agent..."
        disabled={!sessionId}
        className="flex-1"
      />
      <Button type="submit" size="icon" variant="ghost" disabled={!sessionId || !message.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
