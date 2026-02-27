"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MessageSquare, Phone, MoreHorizontal, Smile, Paperclip, Send, Mic, PhoneCall, CheckCircle2, Settings, Users, X, Bell, Shield, LogOut, Sparkles, Mail, Clock, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { UltravoxSession } from "ultravox-client";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

const CHATS_DATA = [
    {
        id: "alle",
        name: "Alle Ansatte",
        participants: 12,
        preview: "Kari: Fantastisk! Setter deg opp nå 👌",
        time: "14:27",
        messages: [
            { id: 1, sender: "Kari (Manager)", content: "Hvem kan ta kveldsvakten på lørdag?", time: "14:22" },
            { id: 2, sender: "Du", content: "Jeg kan ta den, trenger litt ekstra før jul!", time: "14:25", isMe: true },
            { id: 3, sender: "Kari (Manager)", content: "Fantastisk! Setter deg opp nå 👌", time: "14:27" },
        ]
    },
    {
        id: "leder",
        name: "Ledergruppen",
        participants: 4,
        preview: "Møte kl 10 på tirsdag",
        time: "I går",
        messages: [
            { id: 1, sender: "Bjørn (CEO)", content: "Møte kl 10 på tirsdag for å gå gjennom Q3 tallene.", time: "I går 09:00" },
        ]
    },
    {
        id: "kjokken",
        name: "Kjøkken Vakt",
        participants: 6,
        preview: "Husk å bestille mer laks",
        time: "Mandag",
        messages: [
            { id: 1, sender: "Erik (Sous Chef)", content: "Husk å bestille mer laks til helgen!", time: "Mandag 22:10" },
            { id: 2, sender: "Du", content: "Fikser det i morgen tidlig.", time: "Mandag 22:15", isMe: true },
        ]
    },
    {
        id: "smartout",
        name: "Smartout Support",
        participants: 1,
        preview: "System: Din konto ble oppgradert",
        time: "12:00",
        messages: [
            { id: 1, sender: "Smartout Ai", content: "Hei! Hvordan kan jeg hjelpe deg i dag?", time: "11:58", isSystem: true },
        ]
    }
];

export default function KommunikasjonPage() {
    const router = useRouter();

    // UI States
    const [chats, setChats] = useState(CHATS_DATA);
    const [activeChatId, setActiveChatId] = useState("alle");
    const [newMessage, setNewMessage] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedUser, setSelectedUser] = useState<any>(null); // For user profile modal

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
                        content: "Voice session avsluttet. Sammendrag: Teamet diskuterte vaktplanen for neste måned og ble enige om å flytte lørdagsvakten.",
                        time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
                        isSystem: true
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
                return {
                    ...c,
                    messages: [...c.messages, { id: Date.now(), sender: "Du", content: newMessage, time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }), isMe: true }],
                    preview: newMessage,
                    time: "Nå"
                };
            }
            return c;
        }));
        setNewMessage("");
    };

    return (
        <div className="h-screen overflow-hidden bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-8 pt-24 md:pt-28 selection:bg-cyan-500/30 flex flex-col">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6 shrink-0">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-4 mb-5 shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 to-sky-500 p-[1px] shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)]">
                        <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white">Sømløs Kommunikasjon</h1>
                        <p className="text-zinc-400 text-lg">Direkte chat og talekontroll for umiddelbar respons</p>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_-15px_rgba(34,211,238,0.2)] flex flex-col flex-1 min-h-0"
                >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-sky-500"></div>
                    <div className="absolute top-0 left-0 w-[50%] h-[20%] bg-cyan-500/10 blur-[100px] pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row flex-1 min-h-0">
                        {/* Sidebar Contacts */}
                        <div className="hidden md:flex flex-col w-72 border-r border-white/5 bg-black/40 z-20 relative">
                            <div className="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center bg-[#050505]/50 backdrop-blur-sm">
                                <h2 className="font-bold text-lg text-white">Meldinger</h2>
                                <button
                                    onClick={() => { setShowSettings(!showSettings); setShowMembers(false); }}
                                    className={`p-2 rounded-full transition-colors ${showSettings ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
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
                                        }}
                                        className={`p-4 border-b border-white/5 flex gap-4 transition-all ${isCalling ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${chat.id === activeChatId && !showSettings && !selectedUser ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500 shadow-[inset_15px_0_20px_-15px_rgba(6,182,212,0.2)]' : isCalling ? '' : 'hover:bg-white/[0.02]'}`}
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

                            {showSettings ? (
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
                                                    <motion.div key={msg.id} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                                        {msg.isSystem ? (
                                                            // System Message (Walkie Talkie summary or Smartout message)
                                                            <div className="w-full flex justify-center my-4">
                                                                <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-4 max-w-[85%] sm:max-w-[75%] flex flex-col items-center text-center">
                                                                    <Sparkles className="w-5 h-5 text-purple-400 mb-2" />
                                                                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-400 block mb-1 opacity-90">{msg.sender}</span>
                                                                    <p className="leading-relaxed text-[14px] text-purple-100/90">{msg.content}</p>
                                                                    <div className="text-[10px] mt-2 font-medium text-purple-500/50">{msg.time}</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // Standard Message
                                                            <div className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl relative shadow-md ${msg.isMe ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20 text-white rounded-br-sm' : 'bg-[#111] border border-white/5 text-zinc-200 rounded-tl-sm'}`}>
                                                                {!msg.isMe && (
                                                                    <div
                                                                        className="flex items-center gap-2 mb-1 cursor-pointer group hover:opacity-80 transition-opacity"
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
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* Input Area */}
                                            <div className="p-4 border-t border-white/5 bg-black/40 flex gap-4 items-center shrink-0">
                                                <button className="p-3 text-zinc-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors hidden sm:block">
                                                    <Paperclip className="w-5 h-5" />
                                                </button>
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        placeholder={`Skriv til ${activeChat.name}...`}
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

                <NextPageBanner
                    href="/features/shiftplanner"
                    title="Vaktliste & Lønn"
                    subtitle="Neste Funksjon"
                    color="from-orange-500/10"
                />
            </div>
        </div>
    );
}
