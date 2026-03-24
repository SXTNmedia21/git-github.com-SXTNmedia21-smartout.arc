"use client";

/**
 * ShiftClockTabs — Three-tab section for the active shift view.
 *
 * Tabs:
 * - Oppgaver (default): session tasks placeholder
 * - Chat: session chat + shift thread from useShiftChat
 * - Notater: notes list from useShiftNotes + NoteInput
 */

import { useState, useRef, useEffect } from "react";
import { ListTodo, MessageCircle, StickyNote, Send } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NoteInput } from "./NoteInput";

type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    profile_id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type ShiftNote = {
  id: string;
  content: string;
  created_at: string;
};

type ShiftClockTabsProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  sessionMessages: ChatMessage[];
  shiftMessages: ChatMessage[];
  onSendSessionMessage: (content: string) => Promise<unknown>;
  onSendShiftMessage: (content: string) => Promise<unknown>;
  notes: ShiftNote[];
  onAddNote: (content: string) => Promise<unknown>;
  currentProfileId: string | null;
  isChatLoading?: boolean;
  isNotesLoading?: boolean;
};

export function ShiftClockTabs({
  activeTab,
  onTabChange,
  sessionMessages,
  shiftMessages,
  onSendSessionMessage,
  onSendShiftMessage,
  notes,
  onAddNote,
  currentProfileId,
  isChatLoading,
  isNotesLoading,
}: ShiftClockTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-1 flex-col px-4">
      <TabsList className="bg-muted/50 grid w-full grid-cols-3">
        <TabsTrigger value="tasks" className="gap-1.5 text-xs">
          <ListTodo className="h-3.5 w-3.5" />
          Oppgaver
        </TabsTrigger>
        <TabsTrigger value="chat" className="gap-1.5 text-xs">
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </TabsTrigger>
        <TabsTrigger value="notes" className="gap-1.5 text-xs">
          <StickyNote className="h-3.5 w-3.5" />
          Notater
        </TabsTrigger>
      </TabsList>

      {/* Tasks tab — placeholder for session tasks */}
      <TabsContent value="tasks" className="flex-1 overflow-y-auto">
        <TasksPlaceholder />
      </TabsContent>

      {/* Chat tab */}
      <TabsContent value="chat" className="flex flex-1 flex-col overflow-hidden">
        <ChatPanel
          sessionMessages={sessionMessages}
          shiftMessages={shiftMessages}
          onSendSessionMessage={onSendSessionMessage}
          onSendShiftMessage={onSendShiftMessage}
          currentProfileId={currentProfileId}
          isLoading={isChatLoading}
        />
      </TabsContent>

      {/* Notes tab */}
      <TabsContent value="notes" className="flex flex-1 flex-col overflow-hidden">
        <NotesPanel notes={notes} onAddNote={onAddNote} isLoading={isNotesLoading} />
      </TabsContent>
    </Tabs>
  );
}

/* ── Tasks placeholder ──────────────────────────────────────── */

function TasksPlaceholder() {
  return (
    <div className="space-y-3 py-3">
      {/* Placeholder task cards — will be replaced with real session_task data */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="border-border/30 bg-card/30 rounded-xl border p-4">
          <div className="bg-muted/50 mb-2 h-3 w-3/4 rounded" />
          <div className="bg-muted/30 h-2.5 w-1/2 rounded" />
        </div>
      ))}
      <p className="text-muted-foreground/60 text-center text-xs">Oppgaver hentes fra dagsplanen</p>
    </div>
  );
}

/* ── Chat panel ─────────────────────────────────────────────── */

function ChatPanel({
  sessionMessages,
  shiftMessages,
  onSendSessionMessage,
  onSendShiftMessage,
  currentProfileId,
  isLoading,
}: {
  sessionMessages: ChatMessage[];
  shiftMessages: ChatMessage[];
  onSendSessionMessage: (content: string) => Promise<unknown>;
  onSendShiftMessage: (content: string) => Promise<unknown>;
  currentProfileId: string | null;
  isLoading?: boolean;
}) {
  const [chatType, setChatType] = useState<"session" | "shift">("session");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = chatType === "session" ? sessionMessages : shiftMessages;
  const sendFn = chatType === "session" ? onSendSessionMessage : onSendShiftMessage;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    try {
      await sendFn(trimmed);
      setInput("");
    } catch {
      // Error handled by hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Chat type toggle */}
      <div className="border-border/30 flex gap-1 border-b px-1 pt-1 pb-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs transition-colors ${
            chatType === "session"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setChatType("session")}
        >
          Alle pa vakt
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs transition-colors ${
            chatType === "shift"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setChatType("shift")}
        >
          Leder-trad
        </button>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {messages.length === 0 && (
          <p className="text-muted-foreground/60 py-8 text-center text-xs">
            {chatType === "session"
              ? "Ingen meldinger i sesjons-chatten enna"
              : "Ingen meldinger i leder-traden enna"}
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentProfileId;
          return (
            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  isOwn ? "bg-brand-orange/20 text-foreground" : "bg-muted/50 text-foreground"
                }`}
              >
                {!isOwn && msg.sender?.display_name && (
                  <div className="text-muted-foreground mb-0.5 text-xs font-medium">
                    {msg.sender.display_name}
                  </div>
                )}
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-border/30 flex gap-2 border-t p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv en melding..."
          className="border-border/50 bg-card/50 min-h-[36px] resize-none text-sm"
          rows={1}
          disabled={isLoading}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isLoading}
          className="text-brand-orange hover:text-brand-orange-light shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Notes panel ────────────────────────────────────────────── */

function NotesPanel({
  notes,
  onAddNote,
  isLoading,
}: {
  notes: ShiftNote[];
  onAddNote: (content: string) => Promise<unknown>;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {notes.length === 0 && (
          <p className="text-muted-foreground/60 py-8 text-center text-xs">
            Ingen notater enna. Skriv ditt forste notat nedenfor.
          </p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="border-border/30 bg-card/30 rounded-xl border p-3">
            <p className="text-foreground text-sm">{note.content}</p>
            <time className="text-muted-foreground/60 mt-1.5 block text-xs">
              {new Date(note.created_at).toLocaleTimeString("nb-NO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))}
      </div>

      <NoteInput onSubmit={onAddNote} isLoading={isLoading} />
    </div>
  );
}
