"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Phone,
  MoreHorizontal,
  Smile,
  Paperclip,
  Send,
  Mic,
  CheckCircle2,
  Settings,
  Users,
  X,
  Bell,
  Shield,
  LogOut,
  Sparkles,
  Mail,
  Clock,
  CalendarDays,
  Plus,
  PhoneCall,
} from "lucide-react";
import type { MissionId } from "@smartout/ai/missions";

function useWalkieTalkie({
  missionId,
  onSummary,
}: {
  missionId: MissionId;
  onSummary: () => void;
}) {
  const [isCalling, setIsCalling] = useState(false);
  const [uvStatus, setUvStatus] = useState("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);

  const stopCall = useCallback(
    (withSummary: boolean) => {
      sessionRef.current?.leaveCall();
      sessionRef.current = null;
      setIsCalling(false);
      setUvStatus("idle");
      if (withSummary) onSummary();
    },
    [onSummary],
  );

  const toggleWalkieTalkie = useCallback(async () => {
    if (isCalling) {
      stopCall(false);
      return;
    }

    setIsCalling(true);
    setUvStatus("connecting");
    try {
      const { UltravoxSession } = await import("ultravox-client");
      const currentSession = new UltravoxSession();
      sessionRef.current = currentSession;
      currentSession.addEventListener("status", () => {
        setUvStatus(currentSession.status || "idle");
      });

      const res = await fetch("/api/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission_id: missionId }),
      });

      if (res.ok) {
        const data = (await res.json()) as { joinUrl?: string };
        if (data.joinUrl && sessionRef.current === currentSession) {
          currentSession.joinCall(data.joinUrl);
        } else {
          setUvStatus("active");
        }
      } else {
        console.warn("[WalkieTalkie] API unavailable, falling back to UI simulation.");
        setUvStatus("active");
      }
    } catch (error) {
      console.error("[WalkieTalkie] Error:", error);
      setUvStatus("active");
    }
  }, [isCalling, missionId, stopCall]);

  useEffect(
    () => () => {
      sessionRef.current?.leaveCall();
    },
    [],
  );

  return {
    isCalling,
    uvStatus,
    toggleWalkieTalkie,
    endCallAndSummarize: () => stopCall(true),
  };
}

const CHATS_DATA = [
  {
    id: "alle",
    name: "Alle Ansatte - Oslo",
    participants: 24,
    preview: "Johan: Jeg kan ta oppgjøret.",
    time: "10:30",
    messages: [
      {
        id: 1,
        sender: "Kari (Manager)",
        content: "Hvem tar oppgjøret i kveld?",
        time: "10:00",
        reactions: [{ emoji: "✋", count: 2, userReacted: true }],
        replies: [],
      },
      {
        id: 2,
        sender: "Johan (Ansatt)",
        content: "Jeg kan ta oppgjøret.",
        time: "10:30",
        reactions: [{ emoji: "👍", count: 1, userReacted: false }],
        replies: [{ id: 21, sender: "Kari (Manager)", content: "Perfekt, takk!", time: "10:32" }],
      },
    ],
  },
  {
    id: "ledelse",
    name: "Ledergruppen",
    participants: 5,
    preview: "Husk ledermøtet kl 14",
    time: "I går",
    messages: [
      {
        id: 1,
        sender: "Admin",
        content: "Husk ledermøtet kl 14 i morgen. Vi skal gå gjennom nye rutiner.",
        time: "I går 13:00",
        reactions: [],
        replies: [],
      },
      {
        id: 2,
        sender: "Du",
        content: "Den er grei, jeg har forberedt tallene.",
        time: "I går 13:15",
        isMe: true,
        reactions: [{ emoji: "🔥", count: 1, userReacted: true }],
        replies: [],
      },
    ],
  },
  {
    id: "vaktansvarlige",
    name: "Vaktansvarlige",
    participants: 8,
    preview: "Kan noen ta over låsing i kveld?",
    time: "Tirsdag",
    messages: [
      {
        id: 1,
        sender: "Lise (Shift Manager)",
        content: "Kan noen ta over låsing i kveld? Må dra tidlig.",
        time: "Tirsdag 14:00",
        reactions: [{ emoji: "👀", count: 3, userReacted: false }],
        replies: [],
      },
    ],
  },
  {
    id: "smartout",
    name: "Smartout Support",
    participants: 1,
    preview: "System: Assistenten er klar.",
    time: "Nå",
    messages: [
      {
        id: 1,
        sender: "Smartout AI",
        content: "Hei! Hvordan kan jeg hjelpe deg med workspace Innstillinger i dag?",
        time: "Nå",
        isSystem: true,
        reactions: [],
        replies: [],
      },
    ],
  },
];

export default function ChatPage() {
  // UI States
  const [chats, setChats] = useState(CHATS_DATA);
  const [activeChatId, setActiveChatId] = useState("alle");
  const [newMessage, setNewMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [createChatType, setCreateChatType] = useState<"group" | "dm" | "ai" | null>(null);
  const [newChatInput, setNewChatInput] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<{ messageId: number; sender: string } | null>(null);

  // active chat data
  const activeChat = (chats.find((c) => c.id === activeChatId) ?? chats[0])!;

  const handleWalkieTalkieSummary = useCallback(() => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: Date.now(),
                sender: "Smartout AI",
                content:
                  "Voice session avsluttet. Sammendrag: Drift og bemanning for helgen ble diskutert.",
                time: new Date().toLocaleTimeString("no-NO", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isSystem: true,
                reactions: [],
                replies: [],
              },
            ],
            preview: "Voice session avsluttet...",
            time: "Nå",
          };
        }
        return c;
      }),
    );
  }, [activeChatId]);

  const { isCalling, uvStatus, toggleWalkieTalkie, endCallAndSummarize } = useWalkieTalkie({
    missionId: "mr-botsson",
    onSummary: handleWalkieTalkieSummary,
  });

  const handleSend = () => {
    if (!newMessage.trim()) return;

    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          let updatedMessages = [...c.messages];
          if (replyingTo) {
            updatedMessages = updatedMessages.map((msg) => {
              if (msg.id === replyingTo.messageId) {
                return {
                  ...msg,
                  replies: [
                    ...(msg.replies || []),
                    {
                      id: Date.now(),
                      sender: "Du",
                      content: newMessage,
                      time: new Date().toLocaleTimeString("no-NO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      isMe: true,
                    },
                  ],
                };
              }
              return msg;
            });
          } else {
            updatedMessages.push({
              id: Date.now(),
              sender: "Du",
              content: newMessage,
              time: new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }),
              isMe: true,
              reactions: [],
              replies: [],
            });
          }

          return {
            ...c,
            messages: updatedMessages,
            preview: newMessage,
            time: "Nå",
          };
        }
        return c;
      }),
    );
    setNewMessage("");
    setReplyingTo(null);
  };

  const handleToggleReaction = (chatId: string, messageId: number, emoji: string) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: c.messages.map((msg) => {
              if (msg.id === messageId) {
                const existingReaction = (msg.reactions || []).find(
                  (r: { emoji: string; count: number; userReacted: boolean }) => r.emoji === emoji,
                );
                let newReactions = [...(msg.reactions || [])];

                if (existingReaction) {
                  if (existingReaction.userReacted) {
                    // Remove user's reaction
                    if (existingReaction.count === 1) {
                      newReactions = newReactions.filter((r) => r.emoji !== emoji);
                    } else {
                      existingReaction.count -= 1;
                      existingReaction.userReacted = false;
                    }
                  } else {
                    // Add user's reaction to existing
                    existingReaction.count += 1;
                    existingReaction.userReacted = true;
                  }
                } else {
                  // Add new reaction
                  newReactions.push({ emoji, count: 1, userReacted: true });
                }

                return { ...msg, reactions: newReactions };
              }
              return msg;
            }),
          };
        }
        return c;
      }),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050505] shadow-2xl"
      >
        <div className="absolute inset-x-0 top-0 z-50 h-1 bg-gradient-to-r from-cyan-400 to-sky-500"></div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Sidebar Contacts */}
          <div className="relative z-20 hidden w-72 flex-col border-r border-white/5 bg-black/40 md:flex">
            <div className="flex items-center justify-between border-b border-white/5 bg-[#050505]/50 p-4 backdrop-blur-sm sm:p-6">
              <h2 className="text-lg font-bold text-white">Meldinger</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsCreatingChat(!isCreatingChat);
                    setShowSettings(false);
                    setShowMembers(false);
                    setSelectedUser(null);
                    setCreateChatType(null);
                    setNewChatInput("");
                  }}
                  className={`rounded-full p-2 transition-colors ${isCreatingChat ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setShowMembers(false);
                    setIsCreatingChat(false);
                    setSelectedUser(null);
                  }}
                  className={`rounded-full p-2 transition-colors ${showSettings ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    if (isCalling) return; // Prevent switching while calling
                    setActiveChatId(chat.id);
                    setShowSettings(false);
                    setShowMembers(false);
                    setSelectedUser(null);
                    setIsCreatingChat(false);
                  }}
                  className={`flex gap-4 border-b border-white/5 p-4 transition-all ${isCalling ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${chat.id === activeChatId && !showSettings && !isCreatingChat && !selectedUser ? "border-l-2 border-l-cyan-500 bg-cyan-500/10 shadow-[inset_15px_0_20px_-15px_rgba(6,182,212,0.2)]" : isCalling ? "" : "hover:bg-white/[0.02]"}`}
                >
                  <div
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold shadow-inner ${chat.id === activeChatId && !showSettings && !selectedUser ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-cyan-500/20" : chat.id === "smartout" ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                  >
                    {chat.id === "smartout" ? (
                      <Sparkles className="h-5 w-5" />
                    ) : (
                      chat.name.charAt(0)
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate font-bold ${chat.id === activeChatId && !showSettings && !selectedUser ? "text-white" : chat.id === "smartout" ? "text-purple-400" : "text-zinc-300"}`}
                      >
                        {chat.name}
                      </span>
                      <span className="text-xs text-zinc-500">{chat.time}</span>
                    </div>
                    <span className="truncate text-sm text-zinc-400">{chat.preview}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Interaction Window */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050505]">
            {/* Inner Background Glow */}
            <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/grid.svg')] bg-[length:32px_32px] bg-repeat opacity-[0.02]"></div>

            {isCreatingChat ? (
              // Create Chat View
              <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto p-6">
                <div className="mt-10 w-full max-w-lg">
                  {!createChatType ? (
                    <>
                      <h2 className="mb-2 text-3xl font-black text-white">Start ny samtale</h2>
                      <p className="mb-8 font-medium text-zinc-400">
                        Opprett en ny gruppe for temaer eller start en direktemelding med en
                        kollega.
                      </p>

                      <div className="space-y-4">
                        <div
                          onClick={() => setCreateChatType("group")}
                          className="group cursor-pointer rounded-3xl border border-white/5 bg-[#111] p-5 transition-all hover:border-cyan-500/30 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 transition-transform group-hover:scale-105">
                              <Users className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-white transition-colors group-hover:text-cyan-400">
                                Ny Gruppe
                              </h4>
                              <p className="text-sm text-zinc-400">Team, avdeling eller prosjekt</p>
                            </div>
                          </div>
                        </div>

                        <div
                          onClick={() => setCreateChatType("dm")}
                          className="group cursor-pointer rounded-3xl border border-white/5 bg-[#111] p-5 transition-all hover:border-emerald-500/30 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 transition-transform group-hover:scale-105">
                              <MessageSquare className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-white transition-colors group-hover:text-emerald-400">
                                Direktemelding
                              </h4>
                              <p className="text-sm text-zinc-400">1-til-1 samtale med ansatt</p>
                            </div>
                          </div>
                        </div>

                        <div
                          onClick={() => setCreateChatType("ai")}
                          className="group cursor-pointer rounded-3xl border border-white/5 bg-[#111] p-5 transition-all hover:border-purple-500/30 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 transition-transform group-hover:scale-105">
                              <Sparkles className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-white transition-colors group-hover:text-purple-400">
                                Ny AI Assistent
                              </h4>
                              <p className="text-sm text-zinc-400">
                                Spesialisert chat for en oppgave
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                      <button
                        onClick={() => {
                          setCreateChatType(null);
                          setNewChatInput("");
                        }}
                        className="mb-6 flex items-center gap-2 font-medium text-zinc-500 transition-colors hover:text-white"
                      >
                        <X className="h-4 w-4" /> Avbryt
                      </button>

                      {createChatType === "group" && (
                        <>
                          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                            <Users className="h-6 w-6" />
                          </div>
                          <h2 className="mb-2 text-3xl font-black text-white">Opprett Ny Gruppe</h2>
                          <p className="mb-8 font-medium text-zinc-400">
                            Navngi gruppen og inviter teammedlemmer.
                          </p>

                          <div className="space-y-6">
                            <div>
                              <label className="mb-2 block text-sm font-bold text-zinc-300">
                                Gruppenavn
                              </label>
                              <input
                                type="text"
                                value={newChatInput}
                                onChange={(e) => setNewChatInput(e.target.value)}
                                placeholder="F.eks. Sommerkampanje 2024"
                                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white transition-all placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-bold text-zinc-300">
                                Legg til medlemmer
                              </label>
                              <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-2">
                                {["Kari (Manager)", "Johan (Ansatt)", "Ola (Servitør)"].map(
                                  (name, i) => (
                                    <div
                                      key={i}
                                      className="flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
                                        {name.charAt(0)}
                                      </div>
                                      <span className="flex-1 text-sm text-zinc-300">{name}</span>
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-white/10 bg-black accent-cyan-500"
                                      />
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                if (!newChatInput.trim()) return;
                                const newId = `group_${Date.now()}`;
                                setChats([
                                  {
                                    id: newId,
                                    name: newChatInput,
                                    participants: 2,
                                    preview: "Gruppen ble opprettet.",
                                    time: "Nå",
                                    messages: [
                                      {
                                        id: 1,
                                        sender: "System",
                                        content: `Du opprettet gruppen "${newChatInput}".`,
                                        time: "Nå",
                                        isSystem: true,
                                        reactions: [],
                                        replies: [],
                                      },
                                    ],
                                  },
                                  ...chats,
                                ]);
                                setActiveChatId(newId);
                                setIsCreatingChat(false);
                                setCreateChatType(null);
                                setNewChatInput("");
                              }}
                              disabled={!newChatInput.trim()}
                              className="w-full rounded-xl bg-cyan-500 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                            >
                              Opprett Gruppe
                            </button>
                          </div>
                        </>
                      )}

                      {createChatType === "dm" && (
                        <>
                          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                            <MessageSquare className="h-6 w-6" />
                          </div>
                          <h2 className="mb-2 text-3xl font-black text-white">
                            Start Direktemelding
                          </h2>
                          <p className="mb-8 font-medium text-zinc-400">
                            Velg en kollega for å starte en 1-til-1 samtale.
                          </p>

                          <div className="space-y-6">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Søk etter navn..."
                                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white transition-all placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>

                            <div className="space-y-2">
                              {["Maria (Hovmester)", "Per (Kokk)", "Anna (Bartender)"].map(
                                (name, i) => (
                                  <div
                                    onClick={() => {
                                      const newId = `dm_${Date.now()}`;
                                      setChats([
                                        {
                                          id: newId,
                                          name: name,
                                          participants: 2,
                                          preview: "Startet ny samtale.",
                                          time: "Nå",
                                          messages: [
                                            {
                                              id: 1,
                                              sender: "System",
                                              content: `Startet direktemelding med ${name}.`,
                                              time: "Nå",
                                              isSystem: true,
                                              reactions: [],
                                              replies: [],
                                            },
                                          ],
                                        },
                                        ...chats,
                                      ]);
                                      setActiveChatId(newId);
                                      setIsCreatingChat(false);
                                      setCreateChatType(null);
                                    }}
                                    key={i}
                                    className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-4 transition-all hover:border-white/5 hover:bg-white/5"
                                  >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-400 transition-colors group-hover:text-white">
                                      {name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-bold text-white">
                                        {name.split(" ")[0]}
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {name.split("(")[1]?.replace(")", "") || "Ansatt"}
                                      </div>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {createChatType === "ai" && (
                        <>
                          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
                            <Sparkles className="h-6 w-6" />
                          </div>
                          <h2 className="mb-2 text-3xl font-black text-white">Ny AI Assistent</h2>
                          <p className="mb-8 font-medium text-zinc-400">
                            Spinn opp en dedikert AI for et spesifikt prosjekt eller mål.
                          </p>

                          <div className="space-y-6">
                            <div>
                              <label className="mb-2 block text-sm font-bold text-zinc-300">
                                Hva skal assistentens navn være?
                              </label>
                              <input
                                type="text"
                                value={newChatInput}
                                onChange={(e) => setNewChatInput(e.target.value)}
                                placeholder="F.eks. Sommerkampanje 2024..."
                                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white transition-all placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-bold text-zinc-300">
                                Foreslåtte Maler
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                <div
                                  onClick={() => setNewChatInput("HR & Konflikthåndtering")}
                                  className="cursor-pointer rounded-xl border border-white/5 bg-[#111] p-3 text-sm text-zinc-300 transition-colors hover:border-purple-500/30"
                                >
                                  HR & Konflikthåndtering
                                </div>
                                <div
                                  onClick={() => setNewChatInput("Opplæringsmateriale")}
                                  className="cursor-pointer rounded-xl border border-white/5 bg-[#111] p-3 text-sm text-zinc-300 transition-colors hover:border-purple-500/30"
                                >
                                  Opplæringsmateriale
                                </div>
                                <div
                                  onClick={() => setNewChatInput("Budsjett & Kostnadskontroll")}
                                  className="cursor-pointer rounded-xl border border-white/5 bg-[#111] p-3 text-sm text-zinc-300 transition-colors hover:border-purple-500/30"
                                >
                                  Budsjett & Kostnadskontroll
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                if (!newChatInput.trim()) return;
                                const newId = `smartout_${Date.now()}`;
                                setChats([
                                  {
                                    id: newId,
                                    name: `AI: ${newChatInput}`,
                                    participants: 1,
                                    preview: "Spinn opp AI...",
                                    time: "Nå",
                                    messages: [
                                      {
                                        id: 1,
                                        sender: "Smartout AI",
                                        content: `Hei! Jeg er klar for å hjelpe deg med "${newChatInput}". Hva vil du starte med?`,
                                        time: "Nå",
                                        isSystem: true,
                                        reactions: [],
                                        replies: [],
                                      },
                                    ],
                                  },
                                  ...chats,
                                ]);
                                setActiveChatId(newId);
                                setIsCreatingChat(false);
                                setCreateChatType(null);
                                setNewChatInput("");
                              }}
                              disabled={!newChatInput.trim()}
                              className="w-full rounded-xl bg-purple-500 py-4 font-bold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                            >
                              Spinn opp Assistent
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : showSettings ? (
              // Settings View
              <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto p-6">
                <div className="mt-10 w-full max-w-lg">
                  <h2 className="mb-8 text-2xl font-bold text-white">
                    Innstillinger for Kommunikasjon
                  </h2>

                  <div className="space-y-4">
                    <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-[#111] p-4 transition-colors hover:border-cyan-500/30">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">Varslinger</h4>
                          <p className="text-xs text-zinc-400">
                            Administrer push- og e-postvarsler
                          </p>
                        </div>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-zinc-500" />
                    </div>

                    <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-[#111] p-4 transition-colors hover:border-cyan-500/30">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">Personvern & Roller</h4>
                          <p className="text-xs text-zinc-400">Hvem som kan kontakte deg direkte</p>
                        </div>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-zinc-500" />
                    </div>

                    <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-[#111] p-4 transition-colors hover:border-cyan-500/30">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                          <LogOut className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-rose-400">Forlat alle grupper</h4>
                          <p className="text-xs text-zinc-400">Dette krever admin-godkjenning</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedUser ? (
              // User Profile View
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-6 right-6 text-zinc-500 transition-colors hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
                <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-2xl">
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-600/20"></div>
                  <div className="relative z-10 flex flex-col items-center px-6 pt-20 pb-6 text-center">
                    <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#111] bg-zinc-800 text-3xl font-bold text-zinc-400 shadow-xl">
                      {selectedUser.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-bold text-white">{selectedUser.name}</h2>
                    <p className="mb-1 text-sm font-medium text-cyan-400">{selectedUser.role}</p>
                    <p className="mb-6 flex items-center gap-1 text-sm text-zinc-500">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Online now
                    </p>

                    <div className="mb-6 flex w-full gap-3">
                      <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 font-medium text-white transition-colors hover:bg-cyan-400">
                        <MessageSquare className="h-4 w-4" /> Message
                      </button>
                      <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700">
                        <Phone className="h-4 w-4" /> Call
                      </button>
                    </div>

                    <div className="w-full space-y-3 text-left">
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/50 p-3">
                        <Mail className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">
                          {selectedUser.name.toLowerCase().replace(" ", ".")}@smartout.no
                        </span>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/50 p-3">
                        <Clock className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">Neste vakt: I morgen 08:00</span>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/50 p-3">
                        <CalendarDays className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">Ansatt siden Jan 2024</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Chat & Walkie Talkie View
              <>
                {/* Chat Header */}
                <div
                  className="relative z-10 flex cursor-pointer items-center justify-between border-b border-white/5 bg-[#0a0a0c]/80 p-4 shadow-sm backdrop-blur-md sm:p-6"
                  onClick={() => setShowMembers(!showMembers)}
                >
                  <div className="group flex items-center gap-4">
                    <div
                      className={`h-10 w-10 ${activeChat.id === "smartout" ? "bg-gradient-to-br from-purple-500 to-indigo-600" : "bg-gradient-to-br from-cyan-400 to-blue-500"} flex items-center justify-center rounded-full font-bold text-white shadow-lg ${activeChat.id === "smartout" ? "shadow-purple-500/20" : "shadow-cyan-500/20"} transition-transform group-hover:scale-105`}
                    >
                      {activeChat.id === "smartout" ? (
                        <Sparkles className="h-5 w-5" />
                      ) : (
                        activeChat.name.charAt(0)
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`font-bold transition-colors ${activeChat.id === "smartout" ? "text-purple-400" : "text-white group-hover:text-cyan-400"}`}
                      >
                        {activeChat.name}
                      </span>
                      {activeChat.id === "smartout" ? (
                        <span className="flex items-center gap-1 text-xs text-purple-400">
                          <Sparkles className="h-3 w-3" /> System Support
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>{" "}
                          {activeChat.participants} aktive nå
                        </span>
                      )}
                    </div>
                    {activeChat.id !== "smartout" && (
                      <Users className="ml-2 h-4 w-4 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    {activeChat.id !== "smartout" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCalling) {
                            endCallAndSummarize();
                          } else {
                            toggleWalkieTalkie();
                          }
                        }}
                        className={`flex items-center justify-center gap-2 rounded-full p-3 font-bold transition-all ${isCalling ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600"}`}
                      >
                        {isCalling ? (
                          <Phone className="h-4 w-4" />
                        ) : (
                          <PhoneCall className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">
                          {isCalling ? "Avslutt Anrop" : "Start Walkie Talkie"}
                        </span>
                      </button>
                    )}
                    <button className="p-2 text-zinc-500 transition-colors hover:text-white">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="relative z-10 flex min-h-0 flex-1">
                  {/* Main Chat Column */}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    {/* Walkie-Talkie Active Banner */}
                    {isCalling && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="flex items-center gap-4 overflow-hidden border-b border-emerald-500/20 bg-emerald-950/40 p-4 backdrop-blur-md"
                      >
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                          <div className="absolute -inset-2 animate-ping rounded-full border border-emerald-500/30"></div>
                          <Mic className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <span className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-400 uppercase">
                            Aktiv Voice Channel
                            {uvStatus === "connecting" && (
                              <span className="tracking-normal text-zinc-400 normal-case">
                                (Kobler til...)
                              </span>
                            )}
                            {uvStatus === "active" && (
                              <span className="tracking-normal text-emerald-300 normal-case">
                                (Tilkoblet)
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-sm text-zinc-300">
                            AI og teamet lytter... Trykk for å snakke.
                          </span>
                        </div>
                        <div className="flex h-6 shrink-0 items-center gap-1 px-4">
                          {[1, 2, 3, 4].map((i) => (
                            <motion.div
                              key={i}
                              animate={
                                uvStatus === "active"
                                  ? { height: ["20%", "80%", "40%", "100%", "20%"] }
                                  : { height: "20%" }
                              }
                              transition={{
                                repeat: Infinity,
                                duration: 1.5,
                                delay: i * 0.1,
                                ease: "easeInOut",
                              }}
                              className={`w-1.5 rounded-full ${uvStatus === "active" ? "bg-emerald-500" : "bg-emerald-800"}`}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Message Area */}
                    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
                      <div className="my-4 text-center text-xs font-bold tracking-widest text-zinc-600 uppercase">
                        I dag
                      </div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {activeChat.messages.map((msg: any) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className={`flex w-full flex-col ${msg.isSystem ? "items-center" : msg.isMe ? "items-end" : "items-start"}`}
                        >
                          {msg.isSystem ? (
                            // System Message
                            <div className="my-4 flex w-full justify-center">
                              <div className="flex max-w-[85%] flex-col items-center rounded-2xl border border-purple-500/20 bg-purple-900/20 p-4 text-center sm:max-w-[75%]">
                                <Sparkles className="mb-2 h-5 w-5 text-purple-400" />
                                <span className="mb-1 block text-[11px] font-black tracking-wider text-purple-400 uppercase opacity-90">
                                  {msg.sender}
                                </span>
                                <p className="text-[14px] leading-relaxed text-purple-100/90">
                                  {msg.content}
                                </p>
                                <div className="mt-2 text-[10px] font-medium text-purple-500/50">
                                  {msg.time}
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Standard Message Wrapper
                            <div
                              className={`group relative flex max-w-[85%] flex-col sm:max-w-[75%] ${msg.isMe ? "items-end" : "items-start"}`}
                            >
                              {/* Hover Action Menu */}
                              {!msg.isSystem && (
                                <div
                                  className={`absolute -top-4 z-10 scale-95 transform opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 ${msg.isMe ? "-left-2 -translate-x-full" : "-right-2 translate-x-full"} flex items-center gap-1 rounded-full border border-white/10 bg-[#111] p-1.5 shadow-xl`}
                                >
                                  {["👍", "❤️", "😂"].map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() =>
                                        handleToggleReaction(activeChat.id, msg.id, emoji)
                                      }
                                      className="flex h-6 w-6 items-center justify-center rounded-full text-sm transition-colors hover:scale-110 hover:bg-white/10"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  <div className="mx-1 h-4 w-px bg-white/10"></div>
                                  <button
                                    onClick={() =>
                                      setReplyingTo({ messageId: msg.id, sender: msg.sender })
                                    }
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-cyan-500/20 hover:text-cyan-400"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Main Bubble */}
                              <div
                                className={`relative rounded-2xl p-4 shadow-md ${msg.isMe ? "rounded-br-sm bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/20" : "rounded-tl-sm border border-white/5 bg-[#111] text-zinc-200"}`}
                              >
                                {!msg.isMe && (
                                  <div
                                    className="mb-1 flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
                                    onClick={() =>
                                      setSelectedUser({
                                        name: msg.sender
                                          .replace(" (Manager)", "")
                                          .replace(" (CEO)", "")
                                          .replace(" (Sous Chef)", ""),
                                        role: msg.sender.includes("(")
                                          ? msg.sender.split("(")[1].replace(")", "")
                                          : "Ansatt",
                                      })
                                    }
                                  >
                                    <span className="text-[11px] font-black tracking-wider text-cyan-400 uppercase opacity-90">
                                      {msg.sender}
                                    </span>
                                  </div>
                                )}
                                <p className="text-[15px] leading-relaxed">{msg.content}</p>
                                <div
                                  className={`mt-2 flex items-center justify-end gap-1 text-[10px] font-medium ${msg.isMe ? "text-cyan-100/70" : "text-zinc-500"}`}
                                >
                                  {msg.time} {msg.isMe && <CheckCircle2 className="h-3.5 w-3.5" />}
                                </div>
                              </div>

                              {/* Reactions Row */}
                              {msg.reactions && msg.reactions.length > 0 && (
                                <div
                                  className={`mt-1.5 flex flex-wrap gap-1 ${msg.isMe ? "justify-end" : "justify-start"}`}
                                >
                                  {msg.reactions.map(
                                    (
                                      reaction: {
                                        emoji: string;
                                        count: number;
                                        userReacted: boolean;
                                      },
                                      i: number,
                                    ) => (
                                      <button
                                        key={i}
                                        onClick={() =>
                                          handleToggleReaction(
                                            activeChat.id,
                                            msg.id,
                                            reaction.emoji,
                                          )
                                        }
                                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${reaction.userReacted ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-100" : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"}`}
                                      >
                                        <span>{reaction.emoji}</span>{" "}
                                        <span className="text-[10px] font-bold">
                                          {reaction.count}
                                        </span>
                                      </button>
                                    ),
                                  )}
                                </div>
                              )}

                              {/* Nested Replies (Thread) */}
                              {msg.replies && msg.replies.length > 0 && (
                                <div
                                  className={`mt-2 flex w-[90%] flex-col gap-2 ${msg.isMe ? "items-end" : "items-start"}`}
                                >
                                  {msg.replies.map(
                                    (reply: {
                                      id: number;
                                      sender: string;
                                      content: string;
                                      time: string;
                                      isMe?: boolean;
                                    }) => (
                                      <div key={reply.id} className="flex items-end gap-2">
                                        {/* Thread Connector Line */}
                                        {!msg.isMe && (
                                          <div className="absolute -top-2 -left-2 h-px w-4 rounded-tl-lg border-t border-l border-white/10"></div>
                                        )}

                                        <div
                                          className={`rounded-2xl p-3 text-[13px] ${reply.isMe ? "rounded-br-sm border border-cyan-500/20 bg-cyan-900/40 text-white" : "rounded-tl-sm border border-white/5 bg-black/40 text-zinc-300"}`}
                                        >
                                          {!reply.isMe && (
                                            <span className="mb-0.5 block text-[10px] font-bold text-cyan-500">
                                              {reply.sender}
                                            </span>
                                          )}
                                          {reply.content}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* Input Area */}
                    <div className="flex shrink-0 flex-col gap-2 border-t border-white/5 bg-black/40 p-4">
                      {replyingTo && (
                        <div className="mb-[-8px] flex items-center justify-between rounded-t-xl border border-cyan-500/20 bg-cyan-900/20 px-4 py-2 text-xs text-cyan-400">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" /> Svarer{" "}
                            <b>{replyingTo.sender}</b>...
                          </span>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="transition-colors hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <button className="hidden rounded-full bg-white/5 p-3 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white sm:block">
                          <Paperclip className="h-5 w-5" />
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder={
                              replyingTo ? `Ditt svar...` : `Skriv til ${activeChat.name}...`
                            }
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSend();
                              }
                            }}
                            className="w-full rounded-full border border-white/10 bg-[#111] py-3.5 pr-12 pl-5 text-sm text-white shadow-inner transition-colors focus:border-cyan-500/50 focus:bg-black focus:outline-none"
                          />
                          <button className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 transition-colors hover:text-cyan-400">
                            <Smile className="h-5 w-5" />
                          </button>
                        </div>
                        <button
                          onClick={handleSend}
                          className={`flex items-center justify-center rounded-full p-3 transition-all ${newMessage.trim() ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-400" : "cursor-not-allowed bg-white/5 text-zinc-600"}`}
                        >
                          {newMessage.trim() ? (
                            <Send className="ml-1 h-5 w-5" />
                          ) : (
                            <Mic className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Members Sidebar (Expandable) */}
                  <AnimatePresence>
                    {showMembers && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 240, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="flex shrink-0 flex-col overflow-hidden border-l border-white/5 bg-[#0a0a0c]/60 backdrop-blur-md"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 p-4">
                          <h3 className="text-sm font-bold text-white">
                            Medlemmer ({activeChat.participants})
                          </h3>
                          <button
                            onClick={() => setShowMembers(false)}
                            className="text-zinc-500 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                          {Array.from({ length: Math.min(activeChat.participants, 10) }).map(
                            (_, i) => {
                              const mockNames = [
                                "Kari Johansen",
                                "Ola Normann",
                                "Erik Helsen",
                                "Anita Brun",
                                "Jonas Lie",
                              ];
                              const mockRoles = [
                                "Manager",
                                "Ansatt",
                                "Sous Chef",
                                "Servitør",
                                "Ansatt",
                              ];
                              const mockName =
                                mockNames[i % mockNames.length] + (i > 4 ? ` ${i}` : "");
                              const mockRole = mockRoles[i % mockRoles.length];

                              return (
                                <div
                                  key={i}
                                  onClick={() =>
                                    setSelectedUser({ name: mockName, role: mockRole })
                                  }
                                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
                                    {mockName.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-zinc-300">
                                      {mockName}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">{mockRole}</span>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
