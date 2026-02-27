import {
    CheckCircle2,
    Circle,
    Clock,
    AlertCircle,
    PlayCircle,
    Flame,
    Coffee,
    CalendarDays,
    ListTodo,
    FileCheck2,
    ChevronRight,
    Settings,
    UserCircle2,
    TerminalSquare,
    ArrowLeft,
    Sparkles
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function DailySessionSimple() {
    const router = useRouter();
    return (
        <div className="min-h-screen bg-[#050505] font-sans text-zinc-100 flex flex-col md:flex-row overflow-hidden selection:bg-orange-500/30 pt-16">
            <Navigation />

            {/* Dynamic Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
                <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[150px] mix-blend-screen" />
            </div>

            {/* SIDEBAR */}
            <aside className="w-72 bg-[#0a0a0c]/80 backdrop-blur-3xl border-r border-white/5 hidden md:flex flex-col z-20 shadow-2xl relative">
                <div className="p-6 flex items-center gap-3">
                    <button onClick={() => router.back()} className="group flex items-center gap-3 w-full text-left">
                        <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors absolute -left-10 opacity-0 group-hover:opacity-100 group-hover:left-2" />
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                            <Flame className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-black text-xl tracking-tight text-white">
                            Smartout
                        </span>
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-3">Today&apos;s Pipeline</div>

                    <NavItem icon={Flame} label="Kitchen Session" active badge="Live" />
                    <NavItem icon={Coffee} label="Front of House" />
                    <NavItem icon={TerminalSquare} label="Bar" badge="16:00" />

                    <div className="mt-8 mb-4 px-3 text-xs font-bold text-zinc-500 uppercase tracking-widest">Management</div>
                    <NavItem icon={ListTodo} label="All Tasks" />
                    <NavItem icon={CalendarDays} label="Shift Schedule" />
                    <NavItem icon={FileCheck2} label="Session Sign-offs" />
                </nav>

                {/* Waitlist Call to Action */}
                <div className="p-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent pointer-events-none rounded-t-3xl" />
                    <div className="relative border border-orange-500/20 bg-orange-500/5 rounded-2xl p-5 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-orange-400" />
                            Opplev magien
                        </h4>
                        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                            Bli med på reisen og revolusjoner restaurantdriften. Få tidlig tilgang til plattformen.
                        </p>
                        <Link href="/waitlist" className="block w-full text-center bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)]">
                            Sett meg på venteliste
                        </Link>
                    </div>
                </div>

                <div className="p-5 border-t border-white/5 bg-[#050505]/50">
                    <div className="flex items-center gap-3 px-2 cursor-pointer group">
                        <UserCircle2 className="w-8 h-8 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">Restaurant Admin</p>
                            <p className="text-xs text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">admin@smartout.no</p>
                        </div>
                        <Settings className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">

                {/* Mobile Header Overrides */}
                <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0a0a0c]/90 backdrop-blur-xl sticky top-0 z-20">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold">Tilbake</span>
                    </button>
                    <Link href="/waitlist" className="bg-orange-600 text-white font-bold px-4 py-1.5 rounded-full text-xs">
                        Waitlist
                    </Link>
                </div>

                {/* HEADER */}
                <header className="h-auto md:h-24 border-b border-white/5 bg-[#0a0a0c]/40 backdrop-blur-xl px-4 py-6 md:py-0 md:px-10 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-6 md:gap-0">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                            <span>24 Feb 2026</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400">Active Session</span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Kitchen Department</h1>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full md:w-auto">
                        <div className="flex gap-6 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
                            <Metric label="Tasks Completed" value="12 / 18" color="text-white" />
                            <Metric label="Overdue" value="1" color="text-rose-500" />
                            <Metric label="Staff Checked In" value="3" color="text-emerald-400" />
                        </div>
                    </div>
                </header>

                {/* TIMELINE / DAY VIEW */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative">

                    {/* Inner Grid Pattern */}
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-[length:32px_32px] bg-repeat opacity-[0.02] pointer-events-none"></div>

                    <div className="max-w-4xl mx-auto relative z-10">
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold text-white mb-4">Driftsflyt & Rutiner</h2>
                            <p className="text-zinc-400 text-lg leading-relaxed font-medium">
                                En restaurant tenker ikke i &quot;oppgaver&quot;, den tenker i <strong>dager</strong>. Her er operasjonsflyten for Kjøkkenet i dag, drevet frem av hendelsesbaserte &quot;hooks&quot; og sanntidsaktivitet.
                            </p>
                        </div>

                        <div className="relative border-l-2 border-white/10 ml-4 space-y-16 pb-32">

                            {/* PRE-OPEN HOOK */}
                            <TimelineSection time="08:00" title="Pre-Open Hook" status="Completed">
                                <TaskCard
                                    title="Lås opp dører og skru på ovner"
                                    assigned="Anna (Kokk)"
                                    status="completed"
                                    time="08:05"
                                    category="Prep"
                                />
                                <TaskCard
                                    title="Ta imot morgenleveranse fra Bama"
                                    assigned="Anna (Kokk)"
                                    status="completed"
                                    time="08:15"
                                    category="Inventory"
                                />
                            </TimelineSection>

                            {/* OPEN HOOK */}
                            <TimelineSection time="10:00" title="Opening Hook" status="Completed">
                                <TaskCard
                                    title="Temperaturkontroll - Kjølerom 1"
                                    assigned="Erik (Sous Chef)"
                                    status="completed"
                                    time="10:05"
                                    category="HACCP"
                                    data="Registrert: 3.2°C"
                                />
                                <TaskCard
                                    title="Mise en place for lunsj-rush"
                                    assigned="Skift-ansvarlig"
                                    status="completed"
                                    time="10:30"
                                    category="Prep"
                                />
                            </TimelineSection>

                            {/* MID-DAY ROUTINE (CURRENT TIME ZONE) */}
                            <TimelineSection time="14:00" title="Mid-Day Routine" status="Active" isCurrent>
                                <TaskCard
                                    title="Vask og desinfiser prep-stasjon"
                                    assigned="Alle på skift"
                                    status="in_progress"
                                    time="Startet 14:15"
                                    category="Cleaning"
                                    claimedBy="Lise"
                                />
                                <TaskCard
                                    title="Ettermiddagskontroll - Frys 2"
                                    assigned="Alle på skift"
                                    status="overdue"
                                    time="Frist 14:30"
                                    category="HACCP"
                                />
                                {/* Ad-hoc task inserted into timeline */}
                                <TaskCard
                                    title="Søl i Sone 3 - Dyprens nødvendig"
                                    assigned="Ad-hoc (Manager)"
                                    status="available"
                                    time="Opprettet 14:45"
                                    category="Ad-hoc"
                                />
                            </TimelineSection>

                            {/* PRE-CLOSE HOOK */}
                            <TimelineSection time="21:00" title="Pre-Close Hook" status="Upcoming">
                                <TaskCard
                                    title="Last Orders Call (Rop opp)"
                                    assigned="Kvelds-skift"
                                    status="pending"
                                    time="Planlagt 21:00"
                                    category="Service"
                                />
                                <TaskCard
                                    title="Begynn nedvask av frityr-området"
                                    assigned="Kvelds-skift"
                                    status="pending"
                                    time="Planlagt 21:15"
                                    category="Prep"
                                />
                            </TimelineSection>

                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon: Icon, label, active, badge }: { icon: React.ElementType, label: string, active?: boolean, badge?: string }) {
    return (
        <a href="#" className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
            <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'}`} />
                <span className={`text-[13px] tracking-wide ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
            </div>
            {badge && <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${active ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-white/5 text-zinc-500 border-white/10'}`}>{badge}</span>}
        </a>
    );
}

function Metric({ label, value, color }: { label: string, value: string, color: string }) {
    return (
        <div className="flex flex-col bg-[#0a0a0c] px-4 py-2 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
            <span className={`text-xl font-black ${color}`}>{value}</span>
        </div>
    );
}

function TimelineSection({ time, title, status, isCurrent, children }: { time: string, title: string, status: string, isCurrent?: boolean, children: React.ReactNode }) {
    return (
        <div className="relative pl-8 sm:pl-10">
            {/* Node on the timeline */}
            <div className={`absolute -left-[10px] top-1 w-5 h-5 rounded-full border-4 border-[#050505] shadow-[0_0_20px_-5px_rgba(0,0,0,1)] flex items-center justify-center ${status === 'Completed' ? 'bg-zinc-600' :
                status === 'Active' ? 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]' :
                    'bg-zinc-800 border-zinc-700'
                }`} />

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6">
                <span className={`text-sm font-black tracking-wider ${isCurrent ? 'text-orange-500' : 'text-zinc-500'}`}>{time}</span>
                <h2 className={`text-xl font-black tracking-tight ${isCurrent ? 'text-white' : 'text-zinc-400'}`}>{title}</h2>
                {isCurrent && <span className="text-[10px] font-black bg-gradient-to-r from-orange-600 to-rose-600 text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-lg w-fit mt-2 sm:mt-0">Live Nå</span>}
            </div>

            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

function TaskCard({ title, assigned, status, time, category, claimedBy, data }: any) {

    const getStatusConfig = () => {
        switch (status) {
            case 'completed': return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20', text: 'text-zinc-500 line-through' };
            case 'in_progress': return { icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)]', text: 'text-white' };
            case 'overdue': return { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/40 shadow-[0_0_30px_-10px_rgba(243,62,92,0.2)]', text: 'text-rose-100' };
            case 'available': return { icon: Circle, color: 'text-orange-400', bg: 'bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5', text: 'text-zinc-100' };
            case 'pending': return { icon: Circle, color: 'text-zinc-600', bg: 'bg-[#0a0a0c]/50 border-white/5 opacity-60', text: 'text-zinc-500' };
            default: return { icon: Circle, color: 'text-zinc-500', bg: 'bg-[#0a0a0c] border-white/10', text: 'text-zinc-300' };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <div className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 backdrop-blur-xl ${config.bg}`}>

            <div className="flex items-start gap-4">
                <Icon className={`w-6 h-6 mt-0.5 flex-shrink-0 ${config.color} ${status === 'overdue' ? 'animate-pulse' : ''}`} />
                <div>
                    <h3 className={`text-base font-bold tracking-tight ${config.text}`}>
                        {title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className={`font-bold px-2 py-1 rounded-md flex items-center gap-1.5 ${status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                            status === 'overdue' ? 'bg-rose-500/10 text-rose-400' :
                                'bg-white/10 text-zinc-300'
                            }`}>
                            <Clock className="w-3 h-3" /> {time}
                        </span>
                        <span className="text-zinc-400 font-semibold">Ansvarlig: <span className="text-zinc-300">{assigned}</span></span>

                        {category && (
                            <>
                                <span className="text-zinc-600 hidden sm:inline">•</span>
                                <span className="text-zinc-500 font-black uppercase tracking-widest text-[9px] bg-[#0a0a0c] px-2 py-1 rounded-md border border-white/5">{category}</span>
                            </>
                        )}
                    </div>

                    {/* Conditional Data / Claims display */}
                    {claimedBy && status === 'in_progress' && (
                        <div className="mt-4 text-xs font-bold text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg inline-block border border-blue-500/20">
                            Utføres av: {claimedBy}
                        </div>
                    )}
                    {data && status === 'completed' && (
                        <div className="mt-4 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg inline-block border border-emerald-500/20">
                            {data}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex sm:flex-col gap-3 items-end shrink-0 pl-10 md:pl-0 w-full md:w-auto">
                {status === 'available' && (
                    <button className="w-full md:w-auto text-xs font-bold bg-white/5 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-400 border border-white/10 hover:border-orange-500/40 px-5 py-2.5 rounded-xl transition-all">
                        Ta oppdrag
                    </button>
                )}
                {status === 'in_progress' && (
                    <button className="w-full md:w-auto text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)] px-5 py-2.5 rounded-xl transition-all">
                        Marker Fullført
                    </button>
                )}
                {status === 'overdue' && (
                    <button className="w-full md:w-auto text-[10px] font-black bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 px-4 py-2 rounded-xl border border-rose-500/30 transition-all uppercase tracking-widest shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)]">
                        Håndter Avvik
                    </button>
                )}
            </div>

            <NextPageBanner
                href="/concepts/lokations"
                title="Tilbake til Lokasjoner"
                subtitle="Fullfør Gjennomgangen"
                color="from-orange-500/10"
            />
        </div>
    );
}
