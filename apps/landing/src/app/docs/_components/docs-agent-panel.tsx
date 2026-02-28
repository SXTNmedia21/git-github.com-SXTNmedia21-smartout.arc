"use client";

import { useMemo, useState } from "react";
import { Bot, Loader2, SendHorizonal } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function DocsAgentPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hei! Jeg er LISA Docs Agent. Spør meg om setup, vaktplan, onboarding, HACCP eller rapporter.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextUserMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, nextUserMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/docs-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed request");
      }

      const data = (await response.json()) as { answer?: string };
      const answer =
        data.answer ??
        "Beklager, jeg fikk ikke hentet et svar akkurat na. Proev igjen om et oyeblikk.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Jeg fikk en teknisk feil. Sjekk at OPENROUTER_API_KEY er satt, og proev igjen.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0d0d11] to-[#09090c] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/15">
          <Bot className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h3 className="font-bold tracking-tight text-white">LISA Docs Agent</h3>
          <p className="text-sm text-zinc-400">Spør om hele Smartout-dokumentasjonen</p>
        </div>
      </div>

      <div className="custom-scrollbar max-h-[420px] space-y-3 overflow-y-auto p-5">
        {messages.map((message, idx) => (
          <div
            key={`${message.role}-${idx}`}
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              message.role === "assistant"
                ? "border border-white/10 bg-white/5 text-zinc-200"
                : "ml-8 border border-orange-500/30 bg-orange-500/15 text-orange-100"
            }`}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Tenker...
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/20 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Spør om Smartout docs..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/40 focus:outline-none"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isLoading}
            className="rounded-xl border border-orange-500/30 bg-orange-500/20 px-3.5 py-2.5 text-orange-300 transition-colors hover:bg-orange-500/30 disabled:opacity-50"
            aria-label="Send message"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
