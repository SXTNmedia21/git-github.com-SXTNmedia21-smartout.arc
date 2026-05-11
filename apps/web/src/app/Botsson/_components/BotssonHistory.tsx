"use client";

/**
 * BotssonHistory.tsx — Two-state chat history panel for Botsson arena.
 *
 * State 'list'         — Paginated session list grouped by relative date.
 *                        Per-row hover-archive via useArchiveSession (optimistic).
 *                        Sonner toast on archive (no modal, no undo — Council G1 MVP).
 *
 * State 'conversation' — Single session transcript reader.
 *                        Back-button returns to list. Dropdown archive action.
 *
 * ADR-0296: engine_sessions is the canonical chat-persistence surface.
 * ADR-0133: web-first, mobile follow-up PR.
 * Nordic Split: warm OKLCH tokens, Geist Sans group headers, spring animations.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquarePlus,
  MessageSquare,
  Archive,
  MoreVertical,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBotsson } from "./BotssonProvider";
import { useSessions, useSession, useArchiveSession } from "./use-botsson-sessions";
import type { SessionListItem } from "@/app/api/botsson/sessions/_schema";

/* ── Animation spring ────────────────────────────────────────────────── */
const SPRING = { type: "spring" as const, stiffness: 120, damping: 18, mass: 0.6 };

/* ── Date grouping helpers ───────────────────────────────────────────── */
type DateGroup = "I dag" | "I går" | "Denne uka" | "Eldre";

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return "I dag";
  if (diffDays < 2) return "I går";
  if (diffDays < 7) return "Denne uka";
  return "Eldre";
}

function groupSessions(sessions: SessionListItem[]): [DateGroup, SessionListItem[]][] {
  const groups: Partial<Record<DateGroup, SessionListItem[]>> = {};
  const order: DateGroup[] = ["I dag", "I går", "Denne uka", "Eldre"];

  for (const session of sessions) {
    const group = getDateGroup(session.last_turn_at);
    if (!groups[group]) groups[group] = [];
    groups[group]!.push(session);
  }

  return order.filter((g) => groups[g]?.length).map((g) => [g, groups[g]!]);
}

function getSessionTitle(session: SessionListItem): string {
  if (session.summary) return session.summary;
  return "Botsson chat";
}

/* ── Session row ─────────────────────────────────────────────────────── */
function SessionRow({
  session,
  isActive,
  onSelect,
  onArchive,
}: {
  session: SessionListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const relTime = formatDistanceToNow(new Date(session.last_turn_at), {
    addSuffix: false,
    locale: nb,
  });

  const title = getSessionTitle(session);

  return (
    <button
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      onClick={() => onSelect(session.id)}
      className="group bg-card/40 hover:bg-card/70 focus-visible:ring-brand-orange/40 relative w-full rounded-lg p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-1"
    >
      <p className="text-foreground/85 line-clamp-2 text-xs leading-tight font-medium">
        {title.slice(0, 60)}
      </p>
      <p className="text-muted-foreground/50 mt-0.5 text-[10px]">
        {relTime} · {session.turn_count} meldinger
      </p>

      {/* Archive button — visible on hover */}
      <button
        aria-label="Arkiver samtale"
        onClick={(e) => {
          e.stopPropagation();
          onArchive(session.id);
        }}
        className="text-muted-foreground/40 hover:text-destructive/60 absolute top-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus:outline-none focus-visible:opacity-100"
      >
        <Archive className="h-3 w-3" />
      </button>
    </button>
  );
}

/* ── List state ──────────────────────────────────────────────────────── */
function ListView({
  onSelectSession,
  onNewChat,
}: {
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}) {
  const { data: sessions, isLoading, isError } = useSessions();
  const { currentSessionId } = useBotsson();
  const archiveMutation = useArchiveSession();

  function handleArchive(id: string) {
    archiveMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Samtale arkivert");
      },
      onError: () => {
        toast.error("Kunne ikke arkivere samtalen");
      },
    });
  }

  return (
    <div className="flex h-full flex-col" data-botsson-content>
      {/* Header */}
      <div className="border-border/20 flex items-center justify-between border-b px-4 pt-3 pb-2">
        <h3 className="font-heading text-foreground text-sm font-bold">Historikk</h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ny chat"
          onClick={onNewChat}
          className="text-muted-foreground hover:text-foreground h-7 w-7"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2" role="listbox" aria-label="Samtalehistorikk">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-muted-foreground/40 h-4 w-4 animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-muted-foreground/40 px-2 py-4 text-center text-xs">
            Kunne ikke laste historikk
          </p>
        )}

        {!isLoading && !isError && (!sessions || sessions.length === 0) && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
            <MessageSquare className="text-brand-orange/30 h-6 w-6" />
            <p className="text-muted-foreground/50 text-center text-xs">
              Start en samtale — Botsson husker alt
            </p>
          </div>
        )}

        {sessions &&
          sessions.length > 0 &&
          groupSessions(sessions).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="text-muted-foreground/60 px-2 pt-2 pb-1 font-sans text-[10px] font-normal tracking-wide uppercase">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSelect={onSelectSession}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── Conversation state ──────────────────────────────────────────────── */
function ConversationView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { data: session, isLoading, isError } = useSession(sessionId);
  const archiveMutation = useArchiveSession();

  function handleArchive() {
    archiveMutation.mutate(sessionId, {
      onSuccess: () => {
        toast.success("Samtale arkivert");
        onBack();
      },
      onError: () => {
        toast.error("Kunne ikke arkivere samtalen");
      },
    });
  }

  const title = session?.summary ?? "Samtale";

  return (
    <div className="flex h-full flex-col" data-botsson-content>
      {/* Header */}
      <div className="border-border/20 flex items-center gap-2 border-b px-2 pt-3 pb-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tilbake til historikk"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <h3 className="font-heading text-foreground min-w-0 flex-1 truncate text-sm font-bold">
          {title}
        </h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Handlinger"
              className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={handleArchive}
              className="text-destructive/70 focus:text-destructive"
            >
              <Archive className="mr-2 h-3.5 w-3.5" />
              Arkiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transcript */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-muted-foreground/40 h-4 w-4 animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-muted-foreground/40 px-2 py-4 text-center text-xs">
            Kunne ikke laste samtalen
          </p>
        )}

        {session?.conversation.map((turn, i) => {
          const isAssistant = turn.role === "assistant";
          if (turn.role === "system") return null;
          return (
            <div key={i} className={`flex gap-2 ${isAssistant ? "" : "flex-row-reverse"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${
                  isAssistant
                    ? "bg-muted/60 text-foreground/80"
                    : "bg-brand-orange/10 text-foreground/80"
                }`}
              >
                {turn.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── BotssonHistory (exported) ───────────────────────────────────────── */
export function BotssonHistory() {
  const [view, setView] = useState<"list" | "conversation">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { startNewChat, loadSession } = useBotsson();

  function handleSelectSession(id: string) {
    setSelectedId(id);
    setView("conversation");
    loadSession(id);
  }

  function handleBack() {
    setView("list");
    setSelectedId(null);
  }

  function handleNewChat() {
    startNewChat();
    setView("list");
  }

  return (
    <AnimatePresence mode="wait">
      {view === "list" ? (
        <motion.div
          key="list"
          className="h-full"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={SPRING}
        >
          <ListView onSelectSession={handleSelectSession} onNewChat={handleNewChat} />
        </motion.div>
      ) : (
        <motion.div
          key="conversation"
          className="h-full"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={SPRING}
        >
          <ConversationView sessionId={selectedId!} onBack={handleBack} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
