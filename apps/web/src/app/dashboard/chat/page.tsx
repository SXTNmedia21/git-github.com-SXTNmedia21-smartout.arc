"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Phone, MoreHorizontal, Smile, Paperclip, Send, Mic, CheckCircle2, Settings, Users, X, Bell, Shield, LogOut, Sparkles, Mail, Clock, CalendarDays, Plus, PhoneCall } from "lucide-react";
import { UltravoxSession } from "ultravox-client";

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
        replies: []
      },
      {
        id: 2,
        sender: "Johan (Ansatt)",
        content: "Jeg kan ta oppgjøret.",
        time: "10:30",
        reactions: [{ emoji: "👍", count: 1, userReacted: false }],
        replies: [
          { id: 21, sender: "Kari (Manager)", content: "Perfekt, takk!", time: "10:32" }
        ]
      },
    ]
  },
  {
    id: "ledelse",
    name: "Ledergruppen",
    participants: 5,
    preview: "Husk ledermøtet kl 14",
    time: "I går",
    messages: [
      { id: 1, sender: "Admin", content: "Husk ledermøtet kl 14 i morgen. Vi skal gå gjennom nye rutiner.", time: "I går 13:00", reactions: [], replies: [] },
      { id: 2, sender: "Du", content: "Den er grei, jeg har forberedt tallene.", time: "I går 13:15", isMe: true, reactions: [{ emoji: "🔥", count: 1, userReacted: true }], replies: [] },
    ]
  },
  {
    id: "vaktansvarlige",
    name: "Vaktansvarlige",
    participants: 8,
    preview: "Kan noen ta over låsing i kveld?",
    time: "Tirsdag",
    messages: [
      { id: 1, sender: "Lise (Shift Manager)", content: "Kan noen ta over låsing i kveld? Må dra tidlig.", time: "Tirsdag 14:00", reactions: [{ emoji: "👀", count: 3, userReacted: false }], replies: [] },
    ]
  },
  {
    id: "smartout",
    name: "Smartout Support",
    participants: 1,
    preview: "System: Assistenten er klar.",
    time: "Nå",
    messages: [
      { id: 1, sender: "Smartout AI", content: "Hei! Hvordan kan jeg hjelpe deg med workspace Innstillinger i dag?", time: "Nå", isSystem: true, reactions: [], replies: [] },
    ]
  }
];

export default function ChatPage() {
  // UI States
  const [chats, setChats] = useState(CHATS_DATA);
  const [activeChatId, setActiveChatId] = useState("alle");
  const [newMessage, setNewMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [createChatType, setCreateChatType] = useState<'group' | 'dm' | 'ai' | null>(null);
  const [newChatInput, setNewChatInput] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<{ messageId: number, sender: string } | null>(null);

  // active chat data
  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  // Ultravox / Walkie Talkie States
  const [isCalling, setIsCalling] = useState(false);
  const [uvStatus, setUvStatus] = useState("idle");
  const sessionRef = useRef<UltravoxSession | null>(null);

  const toggleWalkieTalkie = async () => {
    if (isCalling) {
      sessionRef.current?.leaveCall();
      sessionRef.current = null;
      setIsCalling(false);
      setUvStatus("idle");
    } else {
      setIsCalling(true);
      setUvStatus("connecting");
      try {
        sessionRef.current = new UltravoxSession();
        sessionRef.current.addEventListener("status", () => {
          const nextStatus = sessionRef.current?.status || "idle";
          setUvStatus(nextStatus);
        });

        const res = await fetch("/api/wizard/start", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (sessionRef.current) {
            sessionRef.current.joinCall(data.joinUrl);
          }
        } else {
          console.warn("Could not connect to Ultravox, falling back to UI simulation.");
          setUvStatus("active");
        }
      } catch (error) {
        console.error("Ultravox error:", error);
        setUvStatus("active"); // Fallback for UI purposes if SDK fails
      }
    }
  };

  const endCallAndSummarize = () => {
    if (sessionRef.current) {
      sessionRef.current.leaveCall();
      sessionRef.current = null;
    }
    setIsCalling(false);
    setUvStatus("idle");

    // Insert summary message into active chat
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          messages: [...c.messages, {
            id: Date.now(),
            sender: "Smartout AI",
            content: "Voice session avsluttet. Sammendrag: Drift og bemanning for helgen ble diskutert.",
            time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
            isSystem: true,
            reactions: [],
            replies: []
          }],
          preview: "Voice session avsluttet...",
          time: "Nå"
        };
      }
      return c;
    }));
  };

  // Cleanup Ultravox on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.leaveCall();
      }
    };
  }, []);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        let updatedMessages = [...c.messages];
        if (replyingTo) {
          updatedMessages = updatedMessages.map(msg => {
            if (msg.id === replyingTo.messageId) {
              return {
                ...msg,
                replies: [...(msg.replies || []), { id: Date.now(), sender: "Du", content: newMessage, time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }), isMe: true }]
              }
            }
            return msg;
          });
        } else {
          updatedMessages.push({ id: Date.now(), sender: "Du", content: newMessage, time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }), isMe: true, reactions: [], replies: [] });
        }

        return {
          ...c,
          messages: updatedMessages,
          preview: newMessage,
          time: "Nå"
        };
      }
      return c;
    }));
    setNewMessage("");
    setReplyingTo(null);
  };

  const handleToggleReaction = (chatId: string, messageId: number, emoji: string) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: c.messages.map(msg => {
            if (msg.id === messageId) {
              const existingReaction = (msg.reactions || []).find((r: { emoji: string, count: number, userReacted: boolean }) => r.emoji === emoji);
              let newReactions = [...(msg.reactions || [])];

              if (existingReaction) {
                if (existingReaction.userReacted) {
                  // Remove user's reaction
                  if (existingReaction.count === 1) {
                    newReactions = newReactions.filter(r => r.emoji !== emoji);
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
          })
        };
      }
      return c;
    }));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#050505] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col flex-1 min-h-0"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-sky-500 z-50"></div>



        <div className="relative z-10 flex flex-col md:flex-row flex-1 min-h-0">
          {/* Sidebar Contacts */}
          <div className="hidden md:flex flex-col w-72 border-r border-white/5 bg-black/40 z-20 relative">
            <div className="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center bg-[#050505]/50 backdrop-blur-sm">
              <h2 className="font-bold text-lg text-white">Meldinger</h2>
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
                  className={`p-2 rounded-full transition-colors ${isCreatingChat ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowSettings(!showSettings); setShowMembers(false); setIsCreatingChat(false); setSelectedUser(null); }}
                  className={`p-2 rounded-full transition-colors ${showSettings ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
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
                  className={`p-4 border-b border-white/5 flex gap-4 transition-all ${isCalling ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${chat.id === activeChatId && !showSettings && !isCreatingChat && !selectedUser ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500 shadow-[inset_15px_0_20px_-15px_rgba(6,182,212,0.2)]' : isCalling ? '' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-inner ${chat.id === activeChatId && !showSettings && !selectedUser ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-cyan-500/20' : chat.id === 'smartout' ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                    {chat.id === 'smartout' ? <Sparkles className="w-5 h-5" /> : chat.name.charAt(0)}
                  </div>
                  <div className="flex flex-col justify-center flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <span className={`font-bold truncate ${chat.id === activeChatId && !showSettings && !selectedUser ? 'text-white' : chat.id === 'smartout' ? 'text-purple-400' : 'text-zinc-300'}`}>{chat.name}</span>
                      <span className="text-xs text-zinc-500">{chat.time}</span>
                    </div>
                    <span className="text-sm text-zinc-400 truncate">{chat.preview}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Interaction Window */}
          <div className="flex-1 flex flex-col bg-[#050505] relative min-h-0 overflow-hidden">
            {/* Inner Background Glow */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-[length:32px_32px] bg-repeat opacity-[0.02] pointer-events-none z-0"></div>

            {isCreatingChat ? (
              // Create Chat View
              <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar flex flex-col items-center">
                <div className="w-full max-w-lg mt-10">

                  {!createChatType ? (
                    <>
                      <h2 className="text-3xl font-black text-white mb-2">Start ny samtale</h2>
                      <p className="text-zinc-400 mb-8 font-medium">Opprett en ny gruppe for temaer eller start en direktemelding med en kollega.</p>

                      <div className="space-y-4">
                        <div onClick={() => setCreateChatType('group')} className="bg-[#111] border border-white/5 rounded-3xl p-5 hover:border-cyan-500/30 transition-all cursor-pointer group hover:bg-white/[0.02]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform"><Users className="w-6 h-6" /></div>
                            <div>
                              <h4 className="text-white font-bold group-hover:text-cyan-400 transition-colors text-lg">Ny Gruppe</h4>
                              <p className="text-sm text-zinc-400">Team, avdeling eller prosjekt</p>
                            </div>
                          </div>
                        </div>

                        <div onClick={() => setCreateChatType('dm')} className="bg-[#111] border border-white/5 rounded-3xl p-5 hover:border-emerald-500/30 transition-all cursor-pointer group hover:bg-white/[0.02]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform"><MessageSquare className="w-6 h-6" /></div>
                            <div>
                              <h4 className="text-white font-bold group-hover:text-emerald-400 transition-colors text-lg">Direktemelding</h4>
                              <p className="text-sm text-zinc-400">1-til-1 samtale med ansatt</p>
                            </div>
                          </div>
                        </div>

                        <div onClick={() => setCreateChatType('ai')} className="bg-[#111] border border-white/5 rounded-3xl p-5 hover:border-purple-500/30 transition-all cursor-pointer group hover:bg-white/[0.02]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform"><Sparkles className="w-6 h-6" /></div>
                            <div>
                              <h4 className="text-white font-bold group-hover:text-purple-400 transition-colors text-lg">Ny AI Assistent</h4>
                              <p className="text-sm text-zinc-400">Spesialisert chat for en oppgave</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                      <button
                        onClick={() => { setCreateChatType(null); setNewChatInput(""); }}
                        className="text-zinc-500 hover:text-white flex items-center gap-2 mb-6 transition-colors font-medium"
                      >
                        <X className="w-4 h-4" /> Avbryt
                      </button>

                      {createChatType === 'group' && (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-6"><Users className="w-6 h-6" /></div>
                          <h2 className="text-3xl font-black text-white mb-2">Opprett Ny Gruppe</h2>
                          <p className="text-zinc-400 mb-8 font-medium">Navngi gruppen og inviter teammedlemmer.</p>

                          <div className="space-y-6">
                            <div>
                              <label className="block text-sm font-bold text-zinc-300 mb-2">Gruppenavn</label>
                              <input
                                type="text"
                                value={newChatInput}
                                onChange={(e) => setNewChatInput(e.target.value)}
                                placeholder="F.eks. Sommerkampanje 2024"
                                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-zinc-600"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-bold text-zinc-300 mb-2">Legg til medlemmer</label>
                              <div className="bg-[#111] border border-white/10 rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {["Kari (Manager)", "Johan (Ansatt)", "Ola (Servitør)"].map((name, i) => (
                                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">{name.charAt(0)}</div>
                                    <span className="text-sm text-zinc-300 flex-1">{name}</span>
                                    <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-black accent-cyan-500" />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                if (!newChatInput.trim()) return;
                                const newId = `group_${Date.now()}`;
                                setChats([{
                                  id: newId,
                                  name: newChatInput,
                                  participants: 2,
                                  preview: "Gruppen ble opprettet.",
                                  time: "Nå",
                                  messages: [{ id: 1, sender: "System", content: `Du opprettet gruppen "${newChatInput}".`, time: "Nå", isSystem: true, reactions: [], replies: [] }]
                                }, ...chats]);
                                setActiveChatId(newId);
                                setIsCreatingChat(false);
                                setCreateChatType(null);
                                setNewChatInput("");
                              }}
                              disabled={!newChatInput.trim()}
                              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-cyan-500/20 disabled:shadow-none"
                            >
                              Opprett Gruppe
                            </button>
                          </div>
                        </>
                      )}

                      {createChatType === 'dm' && (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6"><MessageSquare className="w-6 h-6" /></div>
                          <h2 className="text-3xl font-black text-white mb-2">Start Direktemelding</h2>
                          <p className="text-zinc-400 mb-8 font-medium">Velg en kollega for å starte en 1-til-1 samtale.</p>

                          <div className="space-y-6">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Søk etter navn..."
                                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
                              />
                            </div>

                            <div className="space-y-2">
                              {["Maria (Hovmester)", "Per (Kokk)", "Anna (Bartender)"].map((name, i) => (
                                <div
                                  onClick={() => {
                                    const newId = `dm_${Date.now()}`;
                                    setChats([{
                                      id: newId,
                                      name: name,
                                      participants: 2,
                                      preview: "Startet ny samtale.",
                                      time: "Nå",
                                      messages: [{ id: 1, sender: "System", content: `Startet direktemelding med ${name}.`, time: "Nå", isSystem: true, reactions: [], replies: [] }]
                                    }, ...chats]);
                                    setActiveChatId(newId);
                                    setIsCreatingChat(false);
                                    setCreateChatType(null);
                                  }}
                                  key={i} className="flex items-center gap-4 p-4 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-2xl cursor-pointer transition-all group"
                                >
                                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 group-hover:text-white transition-colors">{name.charAt(0)}</div>
                                  <div className="flex-1">
                                    <div className="text-white font-bold">{name.split(' ')[0]}</div>
                                    <div className="text-xs text-zinc-500">{name.split('(')[1]?.replace(')', '') || 'Ansatt'}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {createChatType === 'ai' && (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6"><Sparkles className="w-6 h-6" /></div>
                          <h2 className="text-3xl font-black text-white mb-2">Ny AI Assistent</h2>
                          <p className="text-zinc-400 mb-8 font-medium">Spinn opp en dedikert AI for et spesifikt prosjekt eller mål.</p>

                          <div className="space-y-6">
                            <div>
                              <label className="block text-sm font-bold text-zinc-300 mb-2">Hva skal assistentens navn være?</label>
                              <input
                                type="text"
                                value={newChatInput}
                                onChange={(e) => setNewChatInput(e.target.value)}
                                placeholder="F.eks. Sommerkampanje 2024..."
                                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-zinc-600"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-bold text-zinc-300 mb-2">Foreslåtte Maler</label>
                              <div className="grid grid-cols-2 gap-3">
                                <div onClick={() => setNewChatInput('HR & Konflikthåndtering')} className="bg-[#111] p-3 rounded-xl border border-white/5 hover:border-purple-500/30 cursor-pointer text-sm text-zinc-300 transition-colors">HR & Konflikthåndtering</div>
                                <div onClick={() => setNewChatInput('Opplæringsmateriale')} className="bg-[#111] p-3 rounded-xl border border-white/5 hover:border-purple-500/30 cursor-pointer text-sm text-zinc-300 transition-colors">Opplæringsmateriale</div>
                                <div onClick={() => setNewChatInput('Budsjett & Kostnadskontroll')} className="bg-[#111] p-3 rounded-xl border border-white/5 hover:border-purple-500/30 cursor-pointer text-sm text-zinc-300 transition-colors">Budsjett & Kostnadskontroll</div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                if (!newChatInput.trim()) return;
                                const newId = `smartout_${Date.now()}`;
                                setChats([{
                                  id: newId,
                                  name: `AI: ${newChatInput}`,
                                  participants: 1,
                                  preview: "Spinn opp AI...",
                                  time: "Nå",
                                  messages: [{ id: 1, sender: "Smartout AI", content: `Hei! Jeg er klar for å hjelpe deg med "${newChatInput}". Hva vil du starte med?`, time: "Nå", isSystem: true, reactions: [], replies: [] }]
                                }, ...chats]);
                                setActiveChatId(newId);
                                setIsCreatingChat(false);
                                setCreateChatType(null);
                                setNewChatInput("");
                              }}
                              disabled={!newChatInput.trim()}
                              className="w-full bg-purple-500 hover:bg-purple-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-purple-500/20 disabled:shadow-none"
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
              <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar flex flex-col items-center">
                <div className="w-full max-w-lg mt-10">
                  <h2 className="text-2xl font-bold text-white mb-8">Innstillinger for Kommunikasjon</h2>

                  <div className="space-y-4">
                    <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-cyan-500/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400"><Bell className="w-5 h-5" /></div>
                        <div>
                          <h4 className="text-white font-bold">Varslinger</h4>
                          <p className="text-xs text-zinc-400">Administrer push- og e-postvarsler</p>
                        </div>
                      </div>
                      <MoreHorizontal className="w-5 h-5 text-zinc-500" />
                    </div>

                    <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-cyan-500/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Shield className="w-5 h-5" /></div>
                        <div>
                          <h4 className="text-white font-bold">Personvern & Roller</h4>
                          <p className="text-xs text-zinc-400">Hvem som kan kontakte deg direkte</p>
                        </div>
                      </div>
                      <MoreHorizontal className="w-5 h-5 text-zinc-500" />
                    </div>

                    <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-cyan-500/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400"><LogOut className="w-5 h-5" /></div>
                        <div>
                          <h4 className="text-rose-400 font-bold">Forlat alle grupper</h4>
                          <p className="text-xs text-zinc-400">Dette krever admin-godkjenning</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedUser ? (
              // User Profile View
              <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar flex flex-col items-center justify-center">
                <button onClick={() => setSelectedUser(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
                <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
                  <div className="h-32 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 absolute inset-x-0 top-0"></div>
                  <div className="px-6 pt-20 pb-6 flex flex-col items-center relative z-10 text-center">
                    <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-[#111] flex items-center justify-center text-3xl font-bold text-zinc-400 mb-4 shadow-xl">
                      {selectedUser.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-bold text-white">{selectedUser.name}</h2>
                    <p className="text-cyan-400 text-sm font-medium mb-1">{selectedUser.role}</p>
                    <p className="text-zinc-500 text-sm mb-6 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online now</p>

                    <div className="flex gap-3 mb-6 w-full">
                      <button className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Message
                      </button>
                      <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                        <Phone className="w-4 h-4" /> Call
                      </button>
                    </div>

                    <div className="w-full space-y-3 text-left">
                      <div className="bg-black/50 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">{selectedUser.name.toLowerCase().replace(' ', '.')}@smartout.no</span>
                      </div>
                      <div className="bg-black/50 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                        <Clock className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">Neste vakt: I morgen 08:00</span>
                      </div>
                      <div className="bg-black/50 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                        <CalendarDays className="w-4 h-4 text-zinc-500" />
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
                <div className="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0c]/80 backdrop-blur-md relative z-10 shadow-sm cursor-pointer" onClick={() => setShowMembers(!showMembers)}>
                  <div className="flex items-center gap-4 group">
                    <div className={`w-10 h-10 ${activeChat.id === 'smartout' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-cyan-400 to-blue-500'} rounded-full flex items-center justify-center text-white font-bold shadow-lg ${activeChat.id === 'smartout' ? 'shadow-purple-500/20' : 'shadow-cyan-500/20'} group-hover:scale-105 transition-transform`}>
                      {activeChat.id === 'smartout' ? <Sparkles className="w-5 h-5" /> : activeChat.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className={`font-bold transition-colors ${activeChat.id === 'smartout' ? 'text-purple-400' : 'text-white group-hover:text-cyan-400'}`}>{activeChat.name}</span>
                      {activeChat.id === 'smartout' ? (
                        <span className="text-xs text-purple-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> System Support</span>
                      ) : (
                        <span className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> {activeChat.participants} aktive nå</span>
                      )}
                    </div>
                    {activeChat.id !== 'smartout' && <Users className="w-4 h-4 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />}
                  </div>
                  <div className="flex gap-2">
                    {activeChat.id !== 'smartout' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCalling) {
                            endCallAndSummarize();
                          } else {
                            toggleWalkieTalkie();
                          }
                        }}
                        className={`p-3 rounded-full transition-all flex items-center justify-center gap-2 font-bold ${isCalling ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'}`}
                      >
                        {isCalling ? <Phone className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isCalling ? "Avslutt Anrop" : "Start Walkie Talkie"}</span>
                      </button>
                    )}
                    <button className="text-zinc-500 hover:text-white p-2 transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-1 min-h-0 relative z-10">

                  {/* Main Chat Column */}
                  <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    {/* Walkie-Talkie Active Banner */}
                    {isCalling && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-emerald-950/40 border-b border-emerald-500/20 p-4 flex items-center gap-4 overflow-hidden backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center relative shrink-0">
                          <div className="absolute -inset-2 rounded-full border border-emerald-500/30 animate-ping"></div>
                          <Mic className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <span className="text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                            Aktiv Voice Channel
                            {uvStatus === "connecting" && <span className="text-zinc-400 normal-case tracking-normal">(Kobler til Ultravox...)</span>}
                            {uvStatus === "active" && <span className="text-emerald-300 normal-case tracking-normal">(Tilkoblet)</span>}
                          </span>
                          <span className="text-zinc-300 text-sm mt-0.5 block">Ultravox AI og teamet lytter... Trykk for å snakke.</span>
                        </div>
                        <div className="flex gap-1 h-6 items-center shrink-0 px-4">
                          {[1, 2, 3, 4].map((i) => (
                            <motion.div
                              key={i}
                              animate={uvStatus === "active" ? { height: ["20%", "80%", "40%", "100%", "20%"] } : { height: "20%" }}
                              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1, ease: "easeInOut" }}
                              className={`w-1.5 rounded-full ${uvStatus === "active" ? "bg-emerald-500" : "bg-emerald-800"}`}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Message Area */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 custom-scrollbar">
                      <div className="text-center text-xs font-bold text-zinc-600 uppercase tracking-widest my-4">I dag</div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {activeChat.messages.map((msg: any) => (
                        <motion.div key={msg.id} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`flex flex-col w-full ${msg.isSystem ? 'items-center' : msg.isMe ? 'items-end' : 'items-start'}`}>
                          {msg.isSystem ? (
                            // System Message
                            <div className="w-full flex justify-center my-4">
                              <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-4 max-w-[85%] sm:max-w-[75%] flex flex-col items-center text-center">
                                <Sparkles className="w-5 h-5 text-purple-400 mb-2" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-purple-400 block mb-1 opacity-90">{msg.sender}</span>
                                <p className="leading-relaxed text-[14px] text-purple-100/90">{msg.content}</p>
                                <div className="text-[10px] mt-2 font-medium text-purple-500/50">{msg.time}</div>
                              </div>
                            </div>
                          ) : (
                            // Standard Message Wrapper
                            <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] group relative ${msg.isMe ? 'items-end' : 'items-start'}`}>

                              {/* Hover Action Menu */}
                              {!msg.isSystem && (
                                <div className={`absolute -top-4 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 ${msg.isMe ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} flex items-center gap-1 bg-[#111] border border-white/10 p-1.5 rounded-full shadow-xl`}>
                                  {["👍", "❤️", "😂"].map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleToggleReaction(activeChat.id, msg.id, emoji)}
                                      className="w-6 h-6 hover:bg-white/10 rounded-full flex items-center justify-center text-sm transition-colors hover:scale-110"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  <div className="w-px h-4 bg-white/10 mx-1"></div>
                                  <button onClick={() => setReplyingTo({ messageId: msg.id, sender: msg.sender })} className="w-6 h-6 hover:bg-cyan-500/20 text-zinc-500 hover:text-cyan-400 rounded-full flex items-center justify-center transition-colors">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Main Bubble */}
                              <div className={`p-4 rounded-2xl relative shadow-md ${msg.isMe ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20 text-white rounded-br-sm' : 'bg-[#111] border border-white/5 text-zinc-200 rounded-tl-sm'}`}>
                                {!msg.isMe && (
                                  <div
                                    className="flex items-center gap-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setSelectedUser({ name: msg.sender.replace(' (Manager)', '').replace(' (CEO)', '').replace(' (Sous Chef)', ''), role: msg.sender.includes('(') ? msg.sender.split('(')[1].replace(')', '') : 'Ansatt' })}
                                  >
                                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 opacity-90">{msg.sender}</span>
                                  </div>
                                )}
                                <p className="leading-relaxed text-[15px]">{msg.content}</p>
                                <div className={`text-[10px] mt-2 flex items-center justify-end gap-1 font-medium ${msg.isMe ? 'text-cyan-100/70' : 'text-zinc-500'}`}>
                                  {msg.time} {msg.isMe && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </div>
                              </div>

                              {/* Reactions Row */}
                              {msg.reactions && msg.reactions.length > 0 && (
                                <div className={`flex flex-wrap gap-1 mt-1.5 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                  {msg.reactions.map((reaction: { emoji: string; count: number; userReacted: boolean }, i: number) => (
                                    <button
                                      key={i}
                                      onClick={() => handleToggleReaction(activeChat.id, msg.id, reaction.emoji)}
                                      className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-colors ${reaction.userReacted ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-100' : 'bg-white/5 border-white/10 hover:border-white/20 text-zinc-300'}`}
                                    >
                                      <span>{reaction.emoji}</span> <span className="text-[10px] font-bold">{reaction.count}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Nested Replies (Thread) */}
                              {msg.replies && msg.replies.length > 0 && (
                                <div className={`mt-2 flex flex-col gap-2 w-[90%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                  {msg.replies.map((reply: { id: number; sender: string; content: string; time: string; isMe?: boolean }) => (
                                    <div key={reply.id} className="flex gap-2 items-end">
                                      {/* Thread Connector Line */}
                                      {!msg.isMe && <div className="w-4 h-px border-t border-l border-white/10 rounded-tl-lg absolute -left-2 -top-2"></div>}

                                      <div className={`p-3 rounded-2xl text-[13px] ${reply.isMe ? 'bg-cyan-900/40 border border-cyan-500/20 text-white rounded-br-sm' : 'bg-black/40 border border-white/5 text-zinc-300 rounded-tl-sm'}`}>
                                        {!reply.isMe && <span className="text-[10px] font-bold text-cyan-500 block mb-0.5">{reply.sender}</span>}
                                        {reply.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/5 bg-black/40 flex flex-col gap-2 shrink-0">
                      {replyingTo && (
                        <div className="flex items-center justify-between bg-cyan-900/20 border border-cyan-500/20 px-4 py-2 rounded-t-xl mb-[-8px] text-xs text-cyan-400">
                          <span className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Svarer <b>{replyingTo.sender}</b>...</span>
                          <button onClick={() => setReplyingTo(null)} className="hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      <div className="flex gap-4 items-center">
                        <button className="p-3 text-zinc-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors hidden sm:block">
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder={replyingTo ? `Ditt svar...` : `Skriv til ${activeChat.name}...`}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSend();
                              }
                            }}
                            className="w-full bg-[#111] border border-white/10 shadow-inner rounded-full pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:border-cyan-500/50 focus:bg-black transition-colors text-white"
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-cyan-400 transition-colors">
                            <Smile className="w-5 h-5" />
                          </button>
                        </div>
                        <button
                          onClick={handleSend}
                          className={`p-3 rounded-full transition-all flex items-center justify-center ${newMessage.trim() ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-zinc-600 cursor-not-allowed'}`}
                        >
                          {newMessage.trim() ? <Send className="w-5 h-5 ml-1" /> : <Mic className="w-5 h-5" />}
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
                        className="border-l border-white/5 bg-[#0a0a0c]/60 backdrop-blur-md overflow-hidden shrink-0 flex flex-col"
                      >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                          <h3 className="font-bold text-white text-sm">Medlemmer ({activeChat.participants})</h3>
                          <button onClick={() => setShowMembers(false)} className="text-zinc-500 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                          {Array.from({ length: Math.min(activeChat.participants, 10) }).map((_, i) => {
                            const mockNames = ["Kari Johansen", "Ola Normann", "Erik Helsen", "Anita Brun", "Jonas Lie"];
                            const mockRoles = ["Manager", "Ansatt", "Sous Chef", "Servitør", "Ansatt"];
                            const mockName = mockNames[i % mockNames.length] + (i > 4 ? ` ${i}` : "");
                            const mockRole = mockRoles[i % mockRoles.length];

                            return (
                              <div
                                key={i}
                                onClick={() => setSelectedUser({ name: mockName, role: mockRole })}
                                className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                                  {mockName.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm text-zinc-300 font-medium">{mockName}</span>
                                  <span className="text-[10px] text-zinc-500">{mockRole}</span>
                                </div>
                              </div>
                            );
                          })}
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
