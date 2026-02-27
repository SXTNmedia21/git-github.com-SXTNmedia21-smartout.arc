"use client";

import React, { useContext, useState, useRef, createContext } from "react";
import {
  MoreVertical, Users, Briefcase, Network, Plus, Clock, CheckCircle2,
  AlertCircle, Circle, PlayCircle, Ban, PanelLeftClose, PanelLeftOpen, MapPin, ChevronDown, ListTodo, MessageSquare, Megaphone, X, CheckSquare, Mail, MessageCircle, FileText,
  Filter, Info, CalendarDays, CalendarCheck, Eye, Printer
} from "lucide-react";
import { DashboardContext } from "../layout";
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// DUMMY DATA FOR DYNAMIC ROSTER
const dummyEmployees = [
  { id: 'e1', name: 'Lars Erik Johansen', role: 'Sous Chef', team: 'Kjøkken', hours: '38.5', shifts: '5', avatarColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30', initials: 'LJ' },
  { id: 'e2', name: 'Ahmad Reza', role: 'Kokk', team: 'Kjøkken', hours: '30', shifts: '4', avatarColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30', initials: 'AR' },
  { id: 'e3', name: 'Ingrid Haugen', role: 'Manager', team: 'Sal & Service', hours: '40', shifts: '5', avatarColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30', initials: 'IH' },
  { id: 'e4', name: 'Fatima Abdi', role: 'Housekeeping', team: 'Drift', hours: '24', shifts: '4', avatarColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', initials: 'FA' },
  { id: 'e5', name: 'Karoline Smith', role: 'Servitør', team: 'Sal & Service', hours: '20', shifts: '3', avatarColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30', initials: 'KS' },
  { id: 'e6', name: 'Bjørn Isaksen', role: 'Oppvask', team: 'Kjøkken', hours: '15', shifts: '3', avatarColor: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', initials: 'BI' },
];

// HOVER CONTEXT FOR FAST-SWITCHING SHIFT CARDS
export const HoverContext = createContext({
  isFastMode: false,
  setFastMode: (_val: boolean) => { void _val; },
  clearFastModeTimeout: () => { },
  resetFastModeTimeout: () => { }
});

export default function SchedulePage() {
  const { isDark, scheduleLayout } = useContext(DashboardContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Daily Briefing State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // New UI States
  const [filterSituation, setFilterSituation] = useState('Alle');
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'open' | 'templates'>('open');

  // DnD State & Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeDragItem, setActiveDragItem] = useState<Record<string, string> | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current as Record<string, string> | null);
  };
  const handleDragEnd = () => {
    setActiveDragItem(null);
  };

  // Hover Context Provider Logic
  const [isFastMode, setFastMode] = useState(false);
  const fastModeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearFastModeTimeout = () => {
    if (fastModeTimerRef.current) clearTimeout(fastModeTimerRef.current);
  };
  const resetFastModeTimeout = () => {
    clearFastModeTimeout();
    fastModeTimerRef.current = setTimeout(() => {
      setFastMode(false);
    }, 500); // Wait 500ms outside of a card before turning off fast mode
  };

  return (
    <HoverContext.Provider value={{ isFastMode, setFastMode, clearFastModeTimeout, resetFastModeTimeout }}>
      <div className={`flex-1 flex flex-col ${isDark ? 'bg-[#050505]' : 'bg-zinc-50'} text-zinc-100 overflow-hidden font-sans rounded-2xl border border-white/5 relative shadow-2xl h-full print:border-none print:shadow-none print:overflow-visible print:h-auto print:block print:bg-white`}>
        {/* AMBIENT BACKGROUND */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 overflow-hidden rounded-2xl">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        {/* TOOLBAR FOR FILTERS AND USE CASES */}
        <div className={`shrink-0 z-20 flex flex-wrap items-center justify-between px-6 py-3 border-b border-white/5 ${isDark ? 'bg-[#0a0a0c]/80' : 'bg-white/80'} backdrop-blur-md print:hidden`}>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-sm xl:text-base font-black tracking-tight flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-orange-500" />
              Operasjonell Vaktplan
            </h1>
            <div className={`hidden sm:block h-4 w-px ${isDark ? 'bg-white/10' : 'bg-zinc-300'}`} />

            {/* Situation Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <div className={`flex bg-white/5 border border-white/10 rounded-lg p-0.5`}>
                {['Alle', 'Selskap', 'Krise', 'Normal'].map(sit => (
                  <button key={sit} onClick={() => setFilterSituation(sit)} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${filterSituation === sit ? (isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {sit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Guide / Brukemetode Button */}
          <div className="relative mt-2 sm:mt-0">
            <button onClick={() => setShowGuide(!showGuide)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${showGuide ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : isDark ? 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
              <Info className="w-4 h-4" /> Brukermetode
            </button>

            {showGuide && (
              <div className={`absolute right-0 top-full mt-2 w-80 p-5 rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[9999] ${isDark ? 'bg-[#111113]/95' : 'bg-white/95'} backdrop-blur-3xl animate-in fade-in slide-in-from-top-2`}>
                <h4 className="text-sm font-black mb-3 text-orange-400 border-b border-orange-500/20 pb-2">Slik styrer du dagen herfra</h4>
                <ul className="space-y-3.5 text-[11px] leading-relaxed text-zinc-300">
                  <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold mt-0.5 border border-blue-500/30">1</span> <span><strong>Pixel-perfekt drag & drop:</strong> Løs fravær umiddelbart ved å dra ansatte eller åpne vakter.</span></li>
                  <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold mt-0.5 border border-purple-500/30">2</span> <span><strong>Dagsbriefing:</strong> Klikk på en dag for å åpne kontrollsenteret. Opprett gjøremål og se varsler.</span></li>
                  <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold mt-0.5 border border-emerald-500/30">3</span> <span><strong>Sanntid Kostnad:</strong> Indikatorer per ansatt og dag sikrer at du lander på budsjett.</span></li>
                  <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold mt-0.5 border border-rose-500/30">4</span> <span><strong>Situasjonsfiltrering:</strong> Isoler dager med selskap eller fraværskriser via filteret over.</span></li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={`flex-1 flex overflow-hidden relative z-10 w-full ${isDark ? 'bg-[#030303]/50' : 'bg-zinc-100/50'} print:overflow-visible print:h-auto print:block print:bg-white`}>
            {/* LEFT CONTEXT SIDEBAR */}
            <aside className={`border-r border-white/5 ${isDark ? 'bg-[#0a0a0c]/40' : 'bg-white/60'} backdrop-blur-md hidden lg:flex flex-col z-20 shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 xl:w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'} print:hidden`}>
              <div className="p-4 xl:p-5 flex-1 overflow-y-auto custom-scrollbar w-64 xl:w-72 flex flex-col">
                <div className={`flex p-1 rounded-xl mb-4 gap-1 ${isDark ? 'bg-white/5' : 'bg-zinc-200/50'}`}>
                  <button onClick={() => setSidebarMode('open')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${sidebarMode === 'open' ? (isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500 hover:text-zinc-400'}`}>Ledige vakter</button>
                  <button onClick={() => setSidebarMode('templates')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${sidebarMode === 'templates' ? (isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500 hover:text-zinc-400'}`}>Vaktmaler</button>
                </div>

                {sidebarMode === 'open' ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] xl:text-xs font-black text-zinc-500 uppercase tracking-widest">Åpen Vakt</h3>
                      <button className="text-orange-400 hover:text-orange-300 p-1 bg-orange-500/10 rounded-md transition-colors" title="Opprett ny åpen vakt">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <OpenShiftCard id="open-1" title="Ekstra Servitør" time="17:00-23:00" />
                      <OpenShiftCard id="open-2" title="Vaskevakt" time="22:00-02:00" />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-[10px] xl:text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Maler per avdeling</h3>
                    <div className="space-y-6">
                      {['Servering', 'Kjøkken'].map(team => (
                        <div key={team}>
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-white/5 pb-1"><Briefcase className="w-3.5 h-3.5" /> {team}</h4>
                          <div className="space-y-2">
                            {team === 'Servering' ? (
                              <>
                                <TemplateCard id={`tpl-${team}-1`} title="Åpningsvakt" team={team} hours="08:00 - 16:00" routines={3} />
                                <TemplateCard id={`tpl-${team}-2`} title="Stengevakt" team={team} hours="16:00 - 00:00" routines={5} />
                              </>
                            ) : (
                              <TemplateCard id={`tpl-${team}-3`} title="Kjøkkensjef" team={team} hours="10:00 - 18:00" routines={8} />
                            )}
                          </div>
                        </div>
                      ))}
                      <button className={`w-full flex items-center justify-center gap-2 py-2 border border-dashed ${isDark ? 'border-zinc-500/30 text-zinc-500 hover:bg-white/5 hover:text-white' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'} rounded-xl transition-all text-xs font-bold`}>
                        <Plus className="w-3.5 h-3.5" /> Opprett ny mal
                      </button>
                    </div>
                  </>
                )}
              </div>
            </aside>

            {/* THE GRID (CALENDAR & LIST) */}
            <main className="flex-1 overflow-auto custom-scrollbar relative flex shrink-0 print:overflow-visible print:h-auto print:block">
              {scheduleLayout === 'daily' && <GridContent isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onDateClick={setSelectedDate} filterSituation={filterSituation} />}
              {scheduleLayout === 'weekly' && <WeeklyGridContent isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onDateClick={setSelectedDate} />}
              {scheduleLayout === 'monthly' && <MonthlyGridContent isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />}
              {scheduleLayout === 'list' && <ListGridContent onDateClick={setSelectedDate} />}
            </main>

            {/* DAILY BRIEFING SIDEBAR (RIGHT) */}
            <aside className={`absolute top-0 right-0 h-full border-l border-white/5 ${isDark ? 'bg-[#0a0a0c]/95' : 'bg-white/95'} backdrop-blur-3xl z-40 transition-all duration-300 ease-in-out flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)] ${selectedDate ? 'w-96 xl:w-[500px] translate-x-0' : 'w-96 xl:w-[500px] translate-x-full opacity-0 pointer-events-none'}`}>
              <DailyBriefingPanel date={selectedDate} onClose={() => setSelectedDate(null)} />
            </aside>
          </div>

          <DragOverlay zIndex={1000}>
            {activeDragItem ? (
              <div className={`p-2 md:p-3 ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'} border border-orange-500/50 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.3)] opacity-90 cursor-grabbing rotate-2 scale-105 transition-transform flex flex-col gap-1 w-48`}>
                <h4 className={`text-[12px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} leading-tight`}>{String(activeDragItem.title || activeDragItem.role || 'Vakt')}</h4>
                <div className="text-[10px] text-orange-400 font-medium"><Clock className="w-3 h-3 inline mr-1" />{String(activeDragItem.time || 'Tid')}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </HoverContext.Provider>
  )
}


function OpenShiftCard({ id, title, time }: { id: string, title: string, time: string }) {
  const { isDark } = useContext(DashboardContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { title, time, type: 'open-shift' }
  });

  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 50, position: 'relative' as React.CSSProperties['position'] } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-3 ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'} border border-white/5 hover:border-white/10 rounded-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-all group shadow-sm ${isDragging ? 'opacity-30' : ''}`}>
      <h4 className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} mb-1 group-hover:text-orange-400 transition-colors`}>{title}</h4>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
        <Clock className="w-3 h-3" />
        {time}
      </div>
    </div>
  )
}

// DUMMY DAYS & SHIFTS FOR ALIGNMENT
const dummyDays = [
  { id: 'd1', label: "Man 22/12", staff: 4, shifts: 4, cost: "5,264", messages: 2, tasks: { done: 3, total: 5 }, situation: 'Normal' },
  { id: 'd2', label: "Tir 23/12", staff: 3, shifts: 4, cost: "4,100", isToday: true, coverageAlert: "⚠️ Mangler Housekeeping", messages: 5, tasks: { done: 1, total: 6 }, situation: 'Krise' },
  { id: 'd3', label: "Ons 24/12", staff: 5, shifts: 5, cost: "9,681", isHoliday: true, messages: 0, tasks: { done: 0, total: 2 }, situation: 'Normal' },
  { id: 'd4', label: "Tor 25/12", staff: 0, shifts: 0, cost: "0", isHoliday: true, messages: 0, tasks: { done: 0, total: 0 }, situation: 'Normal' },
  { id: 'd5', label: "Fre 26/12", staff: 4, shifts: 4, cost: "6,200", messages: 1, tasks: { done: 4, total: 8 }, situation: 'Normal' },
  { id: 'd6', label: "Lør 27/12", staff: 6, shifts: 8, cost: "12,400", messages: 8, tasks: { done: 2, total: 10 }, situation: 'Selskap' },
  { id: 'd7', label: "Søn 28/12", staff: 4, shifts: 4, cost: "7,100", messages: 1, tasks: { done: 0, total: 4 }, situation: 'Normal' },
];

const dailyShifts = [
  // MONDAY
  { id: 's1', employeeId: 'e1', dateId: 'd1', role: 'Sous Chef', time: '15:00-23:00', status: 'completed', indicator: 'blue', zone: 'Hovedkjøkken' },
  { id: 's2', employeeId: 'e3', dateId: 'd1', role: 'Manager', time: '08:00-16:00', status: 'completed', indicator: 'purple', zone: 'Kontor / Floor' },
  { id: 's3', employeeId: 'e2', dateId: 'd1', type: 'absence', absenceType: 'Sykdom', reason: 'Sluttet 12:00' },
  { id: 's4', employeeId: 'e4', dateId: 'd1', role: 'Housekeeping', time: '22:00-02:00', status: 'published', indicator: 'emerald' },

  // TUESDAY
  { id: 's5', employeeId: 'e1', dateId: 'd2', role: 'Sous Chef', time: '10:00-14:00', status: 'published', indicator: 'blue', zone: 'Prep' },
  { id: 's6', employeeId: 'e1', dateId: 'd2', role: 'Sous Chef', time: '18:00-22:00', status: 'draft', indicator: 'blue', zone: 'Varmmat' },
  { id: 's7', employeeId: 'e3', dateId: 'd2', role: 'Manager', time: '10:00-18:00', status: 'active', indicator: 'purple', zone: 'Floor' },
  { id: 's8', employeeId: 'e2', dateId: 'd2', role: 'Kokk', time: '16:00-23:00', status: 'published', indicator: 'orange', zone: 'Kaldmat' },

  // WEDNESDAY
  { id: 's9', employeeId: 'e1', dateId: 'd3', role: 'Sous Chef', time: '08:00-16:00', status: 'published', indicator: 'blue', zone: 'Hovedkjøkken' },
  { id: 's10', employeeId: 'e3', dateId: 'd3', type: 'absence', absenceType: 'Ferie', reason: 'Julaften' },
  { id: 's11', employeeId: 'e2', dateId: 'd3', role: 'Kokk', time: '08:00-16:00', status: 'published', indicator: 'orange' },
  { id: 's12', employeeId: 'e4', dateId: 'd3', role: 'Housekeeping', time: '06:00-12:00', status: 'draft', indicator: 'emerald' },
];


function GridContent({ isSidebarOpen, setIsSidebarOpen, onDateClick, filterSituation = 'Alle' }: { isSidebarOpen: boolean, setIsSidebarOpen: (v: boolean) => void, onDateClick: (d: string) => void, filterSituation?: string }) {
  const { isDark, scheduleView, setScheduleView } = useContext(DashboardContext);

  const renderHeaders = () => (
    <div className="flex sticky top-0 z-40 w-fit min-w-full">
      <div className={`w-[200px] xl:w-[250px] shrink-0 border-r border-b border-white/5 ${isDark ? 'bg-[#0a0a0c]/95' : 'bg-white/95'} backdrop-blur-xl sticky left-0 z-50 h-24 xl:h-28 flex flex-col justify-between p-4 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}>
        <div className="flex items-center justify-between w-full">
          <div className="text-[9px] xl:text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Users className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
            Grupper
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`text-zinc-500 hover:text-white p-1 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} transition-colors`}>
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>
        <div className={`flex ${isDark ? 'bg-[#050505]' : 'bg-zinc-50'} p-0.5 rounded-lg border border-white/5 mt-auto`}>
          <button onClick={() => setScheduleView('ansatt')} className={`flex-1 py-1 xl:py-1.5 text-[9px] xl:text-[10px] font-bold rounded-md transition-colors ${scheduleView === 'ansatt' ? `${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} shadow-sm` : 'text-zinc-500 hover:text-zinc-300'}`}>Ansatt</button>
          <button onClick={() => setScheduleView('jobb')} className={`flex-1 py-1 xl:py-1.5 text-[9px] xl:text-[10px] font-bold rounded-md transition-colors ${scheduleView === 'jobb' ? `${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} shadow-sm` : 'text-zinc-500 hover:text-zinc-300'}`}>Rolle</button>
          <button onClick={() => setScheduleView('team')} className={`flex-1 py-1 xl:py-1.5 text-[9px] xl:text-[10px] font-bold rounded-md transition-colors ${scheduleView === 'team' ? `${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} shadow-sm` : 'text-zinc-500 hover:text-zinc-300'}`}>Team</button>
        </div>
      </div>

      {dummyDays.filter(day => filterSituation === 'Alle' || day.situation === filterSituation).map((day: typeof dummyDays[0]) => (
        <div key={day.id} className={`w-[280px] sm:w-[320px] lg:w-[400px] shrink-0 border-r border-b border-white/5 ${isDark ? 'bg-[#0a0a0c]/90' : 'bg-white/95'} backdrop-blur-xl h-24 xl:h-28 p-2 flex flex-col justify-between cursor-pointer hover:bg-white/5 group/day transition-colors ${day.isToday ? 'bg-orange-500/[0.02]' : ''}`} onClick={() => onDateClick(day.label)}>
          {day.coverageAlert ? (
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          ) : (
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500/20" />
          )}

          <div className="flex items-start justify-between">
            <h2 className={`text-[11px] sm:text-xs font-black tracking-tight flex items-center gap-1.5 truncate ${day.isToday ? 'text-orange-400' : day.isHoliday ? 'text-rose-400' : isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {day.label}
              {day.isToday && <span className="w-1 h-1 rounded-full shrink-0 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>}
            </h2>
            <button className={`text-zinc-500 hover:text-white shrink-0 p-1 ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} rounded-md transition-colors`}><MoreVertical className="w-3 h-3" /></button>
          </div>

          <div className="flex flex-col gap-1.5 mt-auto">
            <div className="flex flex-wrap gap-1.5 xl:gap-2 text-[8px] xl:text-[9px] font-bold text-zinc-500 uppercase tracking-widest items-center leading-none">
              <span className="flex items-center gap-0.5" title="Ansatte"><Users className="w-2.5 h-2.5 xl:w-3 xl:h-3" /> {day.staff}</span>
              <span className="flex items-center gap-0.5" title="Vakter"><Briefcase className="w-2.5 h-2.5 xl:w-3 xl:h-3" /> {day.shifts}</span>
              {day.messages !== undefined && (
                <span className={`flex items-center gap-0.5 ${day.messages > 0 ? 'text-blue-400' : ''}`} title="Meldinger for dagen"><MessageSquare className="w-2.5 h-2.5 xl:w-3 xl:h-3" /> {day.messages}</span>
              )}
              {day.tasks && (
                <span className={`flex items-center gap-0.5 ${day.tasks.done < day.tasks.total ? 'text-orange-400' : 'text-emerald-400'}`} title="Oppmøte / Gjøremål"><ListTodo className="w-2.5 h-2.5 xl:w-3 xl:h-3" /> {day.tasks.done}/{day.tasks.total}</span>
              )}
            </div>
            {day.coverageAlert ? (
              <div className="flex items-center gap-1 bg-red-500/10 text-red-500 px-1 py-0.5 rounded w-fit border border-red-500/20 text-[8px] font-bold max-w-full">
                <AlertCircle className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{day.coverageAlert}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-zinc-500 px-1 py-0.5 rounded w-fit text-[8px] font-bold max-w-full">
                <CheckCircle2 className="w-2.5 h-2.5 text-green-500/50 shrink-0" /> <span className="truncate">Optimal dekning</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-w-fit w-full">
      {renderHeaders()}

      <div className="flex-1 pb-20 w-fit min-w-full">
        {scheduleView === 'ansatt' && (
          <div className="flex flex-col">
            {dummyEmployees.map(emp => (
              <EmployeeRow key={emp.id} employee={emp} days={dummyDays} shifts={dailyShifts} filterSituation={filterSituation} />
            ))}
          </div>
        )}

        {scheduleView === 'jobb' && (
          <div className="flex flex-col">
            {Array.from(new Set(dummyEmployees.map(e => e.role))).map(role => {
              const employeesInRole = dummyEmployees.filter(e => e.role === role);
              return (
                <React.Fragment key={role}>
                  <GroupHeader title={role} count={employeesInRole.length} days={dummyDays} filterSituation={filterSituation} />
                  {employeesInRole.map(emp => (
                    <EmployeeRow key={emp.id} employee={emp} days={dummyDays} shifts={dailyShifts} subtitle={emp.team} filterSituation={filterSituation} />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {scheduleView === 'team' && (
          <div className="flex flex-col">
            {Array.from(new Set(dummyEmployees.map(e => e.team))).map(team => {
              const employeesInTeam = dummyEmployees.filter(e => e.team === team);
              return (
                <React.Fragment key={team}>
                  <GroupHeader title={team} count={employeesInTeam.length} days={dummyDays} filterSituation={filterSituation} />
                  {employeesInTeam.map(emp => (
                    <EmployeeRow key={emp.id} employee={emp} days={dummyDays} shifts={dailyShifts} subtitle={emp.role} filterSituation={filterSituation} />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// WEEKLY GRID COMPONENT (1-10)
function WeeklyGridContent({ isSidebarOpen, setIsSidebarOpen, onDateClick }: { isSidebarOpen: boolean, setIsSidebarOpen: (v: boolean) => void, onDateClick?: (d: string) => void }) {
  const { isDark, scheduleView, setScheduleView } = useContext(DashboardContext);
  // Generate 10 columns for the weekly sequence
  const columns = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="flex w-fit min-w-full">
      <div className={`w-[200px] xl:w-[250px] shrink-0 border-r border-white/5 ${isDark ? 'bg-[#0a0a0c]/60' : 'bg-white/80'} sticky left-0 z-30 backdrop-blur-md shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] flex flex-col`}>
        {/* Corner header with toggle & group select */}
        <div className={`h-24 xl:h-28 border-b ${isDark ? 'border-white/5' : 'border-zinc-200'} flex flex-col justify-between p-4 relative`}>
          <div className="flex items-center justify-between w-full">
            <div className="text-[9px] xl:text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-orange-500" />
              Rullerende
            </div>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`text-zinc-500 hover:text-white p-1 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} transition-colors`}>
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>

          <div className={`flex ${isDark ? 'bg-[#050505]' : 'bg-zinc-50'} p-0.5 rounded-lg border border-white/5 mt-auto`}>
            <button onClick={() => setScheduleView('ansatt')} className={`flex-1 py-1 xl:py-1.5 text-[9px] xl:text-[10px] font-bold rounded-md transition-colors ${scheduleView === 'ansatt' ? `\${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} shadow-sm` : 'text-zinc-500 hover:text-zinc-300'}`}>Ansatt</button>
            <button onClick={() => setScheduleView('jobb')} className={`flex-1 py-1 xl:py-1.5 text-[9px] xl:text-[10px] font-bold rounded-md transition-colors ${scheduleView === 'jobb' ? `\${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} shadow-sm` : 'text-zinc-500 hover:text-zinc-300'}`}>Rolle</button>
            <button onClick={() => setScheduleView('team')} className={`flex-1 py-1 xl:py-1.5 text-[9px] xl:text-[10px] font-bold rounded-md transition-colors ${scheduleView === 'team' ? `\${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} shadow-sm` : 'text-zinc-500 hover:text-zinc-300'}`}>Team</button>
          </div>
        </div>

        {/* Entity Rows (Sticky Left) Grouped */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <TeamGroup title="Kjøkken" count={2}>
            <EntityRow name="Lars Erik Johansen" subtitle="Sous Chef" hours="38.5" shifts="5" avatarColor="bg-blue-500/20 text-blue-400 border-blue-500/30" initials="LJ" />
            <EntityRow name="Ahmad Reza" subtitle="Kokk" hours="30" shifts="4" avatarColor="bg-orange-500/20 text-orange-400 border-orange-500/30" initials="AR" />
          </TeamGroup>
          <TeamGroup title="Sal & Service" count={1}>
            <EntityRow name="Ingrid Haugen" subtitle="Manager" hours="40" shifts="5" avatarColor="bg-purple-500/20 text-purple-400 border-purple-500/30" initials="IH" />
          </TeamGroup>
          <TeamGroup title="Drift" count={1}>
            <EntityRow name="Fatima Abdi" subtitle="Housekeeping" hours="24" shifts="4" avatarColor="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" initials="FA" />
          </TeamGroup>
        </div>
      </div>

      {/* Week Columns 1 to 10 */}
      {columns.map(col => (
        <div key={col} className={`w-40 xl:w-48 shrink-0 border-r ${isDark ? 'border-white/5' : 'border-zinc-200'} flex flex-col hover:bg-white/[0.02] transition-colors ${col === 3 ? 'bg-orange-500/[0.02]' : ''}`}>
          {/* Header */}
          <div onClick={() => onDateClick && onDateClick(`Uke ${col}`)} className={`h-24 xl:h-28 border-b border-white/5 p-3 xl:p-4 sticky top-0 ${isDark ? 'bg-[#0a0a0c]/80' : 'bg-white/90'} backdrop-blur-xl z-20 flex flex-col justify-center items-center relative cursor-pointer hover:bg-white/5`}>
            {col === 3 && <div className="absolute top-2 right-2 text-[9px] font-black uppercase text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">Aktiv</div>}
            <h2 className={`text-xl xl:text-3xl font-black tracking-tighter ${col === 3 ? 'text-orange-400' : isDark ? 'text-white' : 'text-zinc-900'}`}>{col}</h2>
            <span className="text-[9px] xl:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Uke / Periode</span>
          </div>

          {/* Placeholders for shift assignment patterns */}
          <GridCell>
            {col % 2 !== 0 ? <ShiftCard role="Sous Chef" time="5 vakter" status="published" indicator="blue" /> : <EmptyCell />}
          </GridCell>
          <GridCell>
            <ShiftCard role="Manager" time="5 vakter" status={col === 3 ? 'active' : 'published'} indicator="purple" />
          </GridCell>
          <GridCell>
            {col % 4 === 0 ? <AbsenceCard type="Avspasering" reason="Rotasjon" /> : <ShiftCard role="Kokk" time="4 vakter" status="draft" indicator="orange" />}
          </GridCell>
          <GridCell>
            <ShiftCard role="Housekeeping" time="4 vakter" status="published" indicator="emerald" />
          </GridCell>
        </div>
      ))}
    </div>
  )
}

function GroupHeader({ title, count, days, filterSituation = 'Alle' }: { title: string, count: number, days: typeof dummyDays, filterSituation?: string }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className="flex w-fit min-w-full group/header">
      <div className={`w-[200px] xl:w-[250px] shrink-0 border-r border-b border-white/5 ${isDark ? 'bg-white/5' : 'bg-zinc-100'} sticky left-0 z-30 px-3 flex items-center justify-between h-8 relative shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}>
        <span className={`text-[10px] xl:text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'} uppercase tracking-wider`}>{title}</span>
        <span className={`text-[9px] font-medium text-zinc-400 ${isDark ? 'bg-white/10' : 'bg-zinc-200'} px-1.5 py-0.5 rounded`}>{count}</span>
      </div>
      {days.filter(d => filterSituation === 'Alle' || d.situation === filterSituation).map((day: typeof dummyDays[0]) => (
        <div key={day.id} className={`w-[280px] sm:w-[320px] lg:w-[400px] shrink-0 border-r border-b ${isDark ? 'border-white/5' : 'border-zinc-200'} bg-white/[0.02] h-8`} />
      ))}
    </div>
  )
}

function EmployeeRow({ employee, subtitle, days, shifts, filterSituation = 'Alle' }: { employee: typeof dummyEmployees[0], subtitle?: string, days: typeof dummyDays, shifts: typeof dailyShifts, filterSituation?: string }) {
  const { isDark } = useContext(DashboardContext);
  const scheduledHours = parseFloat(employee.hours) || 0;
  const contractedHours = 37.5;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = 'bg-zinc-500';
  if (isOvertime) barColor = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
  else if (percentage >= 95) barColor = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
  else if (percentage >= 70) barColor = 'bg-orange-500';

  return (
    <div className="flex w-fit min-w-full group/row">
      <div className={`w-[200px] xl:w-[250px] shrink-0 border-r border-b border-white/5 ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'} sticky left-0 z-30 h-28 p-2 flex items-center gap-2 group-hover/row:bg-white/[0.02] transition-colors shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}>
        <div className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center font-black text-[9px] border ${employee.avatarColor}`}>
          {employee.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`text-[10px] xl:text-[11px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} truncate group-hover/row:text-orange-400 transition-colors leading-tight`}>{employee.name}</h3>
          <p className="text-[8px] xl:text-[9px] text-zinc-500 truncate mb-1 leading-tight">{subtitle || employee.role}</p>
          <div className="mt-1 space-y-1 pr-2">
            <div className="flex justify-between items-center text-[7px] font-bold uppercase tracking-widest">
              <span className="text-zinc-500">{employee.shifts} vakter</span>
              <span className={isOvertime ? 'text-red-400' : percentage >= 95 ? 'text-green-400' : 'text-zinc-400'}>
                {employee.hours} <span className="text-zinc-600">/{contractedHours}</span>
              </span>
            </div>
            <div className={`h-1 w-full ${isDark ? 'bg-white/5' : 'bg-zinc-100'} rounded-full overflow-hidden`}>
              <div className={`h-full ${barColor} transition-all rounded-full`} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        </div>
      </div>

      {days.filter(d => filterSituation === 'Alle' || d.situation === filterSituation).map((day: typeof dummyDays[0]) => {
        const dayShifts = shifts.filter((s: typeof dailyShifts[0]) => s.employeeId === employee.id && s.dateId === day.id);

        return (
          <MatrixCell key={day.id} isToday={day.isToday}>
            {dayShifts.length > 0 ? (
              <div className="flex flex-col gap-1 w-full h-full pb-1">
                {dayShifts.map((shift: typeof dailyShifts[0]) => (
                  shift.type === 'absence' ? (
                    <AbsenceCard key={shift.id} type={shift.absenceType as 'Sykdom' | 'Ferie' | 'Avspasering'} reason={shift.reason} />
                  ) : (
                    <ShiftCard key={shift.id} role={shift.role!} time={shift.time!} status={shift.status!} indicator={shift.indicator!} zone={shift.zone} id={shift.id} />
                  )
                ))}
              </div>
            ) : null}
          </MatrixCell>
        )
      })}
    </div>
  )
}

function MatrixCell({ children, isToday, id }: { children?: React.ReactNode, isToday?: boolean, id?: string }) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div ref={setNodeRef} className={`w-[280px] sm:w-[320px] lg:w-[400px] shrink-0 border-r border-b border-white/5 ${isDark ? 'bg-[#050505]' : 'bg-zinc-50'}/40 transition-colors p-1.5 relative flex flex-col gap-1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] overflow-hidden h-28 ${isOver ? 'bg-orange-500/20 border-orange-500/50 z-10 scale-[1.02] border border-dashed rounded-lg' : 'hover:bg-white/[0.04] group-hover/row:bg-white/[0.02]'} ${isToday ? 'bg-orange-500/[0.02]' : ''}`}>
      {children ? children : (
        <button className={`absolute inset-x-1.5 inset-y-1.5 rounded-md border border-dashed ${isDark ? 'border-white/10' : 'border-zinc-300'} bg-white/[0.01] hover:bg-white/[0.03] hover:border-orange-500/30 flex items-center justify-center text-orange-500/0 hover:text-orange-500/50 transition-all opacity-0 hover:opacity-100 cursor-pointer`}>
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function TeamGroup({ title, count, children }: { title: string, count: number, children: React.ReactNode }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className="flex flex-col mb-4">
      <div className={`px-3 py-2 flex items-center justify-between border-b border-white/5 ${isDark ? 'bg-white/5' : 'bg-zinc-100'}`}>
        <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'} uppercase tracking-wider`}>{title}</span>
        <span className={`text-[9px] font-medium text-zinc-400 ${isDark ? 'bg-white/10' : 'bg-zinc-200'} px-1.5 py-0.5 rounded`}>{count}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

// SHIFT CARD COMPONENT
function ShiftCard({ role, time, status, indicator, zone, id }: { role: string, time: string, status: string, indicator: string, zone?: string, id?: string }) {
  const { isDark } = useContext(DashboardContext);
  const { isFastMode, setFastMode, clearFastModeTimeout, resetFastModeTimeout } = useContext(HoverContext);

  const [isHovering, setIsHovering] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovering(true);
    clearFastModeTimeout();

    if (isFastMode) {
      setShowTooltip(true);
    } else {
      hoverTimer.current = setTimeout(() => {
        setShowTooltip(true);
        setFastMode(true);
      }, 1500);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setShowTooltip(false);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    resetFastModeTimeout();
  };

  const statusStyles: Record<string, string> = {
    draft: "border-orange-500/30 bg-orange-500/5",
    published: "border-white/10 bg-[#0a0a0c]",
    active: "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    completed: "border-white/5 bg-[#050505] opacity-60",
  };

  // Status mapping logic...
  const statusIcons: Record<string, React.ReactNode> = {
    draft: <AlertCircle className="w-3 h-3 text-orange-400" />,
    published: <Circle className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />,
    active: <PlayCircle className="w-3 h-3 text-emerald-400" />,
    completed: <CheckCircle2 className="w-3 h-3 text-zinc-600" />
  }

  const indicatorColors: Record<string, string> = {
    blue: "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]",
    emerald: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]",
    purple: "bg-purple-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]",
    orange: "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]",
  }

  const defaultId = React.useId();
  const draggableId = id || defaultId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { role, time, status, indicator, type: 'shift' }
  });

  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 50, position: 'relative' as React.CSSProperties['position'] } : undefined;

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`relative p-2 xl:p-2.5 rounded-lg border flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing group hover:border-white/30 ${isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-100'} select-none ${statusStyles[status]} overflow-visible ${isDragging ? 'opacity-30' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Indicator Line */}
      <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full ${indicatorColors[indicator]}`} />

      <div className="flex items-start justify-between relative z-10 w-full">
        <div className="min-w-0 pr-2">
          <span className={`text-[10px] xl:text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'} group-hover:text-amber-400 transition-colors leading-tight line-clamp-1 truncate block`}>{role}</span>
          {zone && <div className={`text-[9px] ${isDark ? 'text-zinc-400' : 'text-zinc-600'} flex items-center gap-1 mt-0.5 whitespace-nowrap`}><MapPin className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{zone}</span></div>}
        </div>

        {/* Progress Ring / Status Icon Anchor */}
        <div className="shrink-0 relative w-4 h-4 flex items-center justify-center">
          {(!isFastMode && isHovering && !showTooltip) ? (
            <svg className="w-4 h-4 -rotate-90 absolute top-0 left-0" viewBox="0 0 24 24">
              <circle className={`${isDark ? 'text-white' : 'text-zinc-900'}/5`} strokeWidth="3" stroke="currentColor" fill="transparent" r="10" cx="12" cy="12" />
              <circle
                className="text-orange-500 transition-all ease-linear"
                strokeWidth="3"
                strokeDasharray="63"
                strokeDashoffset="0"
                stroke="currentColor"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                style={{
                  animation: 'circleFill 1.5s linear forwards',
                }}
              />
              <style>{`
                @keyframes circleFill {
                  0% { stroke-dashoffset: 63; }
                  100% { stroke-dashoffset: 0; }
                }
              `}</style>
            </svg>
          ) : (
            statusIcons[status]
          )}
        </div>
      </div>

      <div className={`flex items-center gap-1.5 text-[9px] xl:text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-600'} font-medium mt-auto relative z-10`}>
        <Clock className={`w-3 h-3 text-zinc-500 group-hover:${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
        {time}

        {showTooltip && (
          <ShiftHoverCard role={role} time={time} zone={zone} />
        )}
      </div>
    </div>
  )
}

function ShiftHoverCard({ role, time, zone }: { role: string, time: string, zone?: string }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className={`absolute top-1/2 -left-2 -translate-x-full -translate-y-1/2 w-64 ${isDark ? 'bg-[#0a0a0c]/95' : 'bg-white/95'} backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,1)] z-[9999] pointer-events-none p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h4 className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{role}</h4>
          <div className="text-xs font-bold text-orange-400">{time}</div>
        </div>
      </div>

      <div className={`h-px w-full ${isDark ? 'bg-white/10' : 'bg-zinc-200'}`} />

      <div className="space-y-2">
        <div className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">{zone || 'Ingen sone valgt'}</span>
        </div>
        <div className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> Lars Erik Johansen
        </div>
        <div className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> 1 aktiv oppgave (Lukke)
        </div>
        <div className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> 0.5 timer Pause (Ubetalt)
        </div>
      </div>

      <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center">
        <span>Est. Lønn</span>
        <span className={`${isDark ? 'text-white' : 'text-zinc-900'}`}>1,624 kr</span>
      </div>
    </div>
  )
}

function EntityRow({ name, subtitle, hours, shifts, avatarColor, initials, contractedHours = 37.5 }: { name: string, subtitle?: string, hours: string, shifts: string, avatarColor: string, initials: string, contractedHours?: number }) {
  const { isDark } = useContext(DashboardContext);
  const scheduledHours = parseFloat(hours) || 0;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = 'bg-zinc-500'; // Default Neutral
  if (isOvertime) barColor = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
  else if (percentage >= 95) barColor = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
  else if (percentage >= 70) barColor = 'bg-orange-500';

  return (
    <div className={`h-24 border-b border-white/5 p-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors group cursor-pointer ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'}`}>
      <div className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center font-black text-[9px] border ${avatarColor}`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={`text-[10px] xl:text-[11px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} truncate group-hover:text-orange-400 transition-colors leading-tight`}>{name}</h3>
        <p className="text-[8px] xl:text-[9px] text-zinc-500 truncate mb-1 leading-tight">{subtitle}</p>

        {/* Capacity Progress Bar */}
        <div className="mt-1 space-y-1">
          <div className="flex justify-between items-center text-[7px] font-bold uppercase tracking-widest">
            <span className="text-zinc-500">{shifts} vakter</span>
            <span className={isOvertime ? 'text-red-400' : percentage >= 95 ? 'text-green-400' : 'text-zinc-400'}>
              {hours} <span className="text-zinc-600">/{contractedHours}</span>
            </span>
          </div>
          <div className={`h-1 w-full ${isDark ? 'bg-white/5' : 'bg-zinc-100'} rounded-full overflow-hidden`}>
            <div className={`h-full ${barColor} transition-all rounded-full`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function DayColumn({ date, staff, shifts, isHoliday, isToday, coverageAlert, onClick, children }: any) {

  const { isDark, scheduleLayout } = useContext(DashboardContext);
  const minWidthClass = scheduleLayout === 'daily' ? 'min-w-[280px] sm:min-w-[320px] lg:min-w-[400px]' : 'min-w-[110px] sm:min-w-[130px] lg:min-w-[140px] xl:min-w-[160px] max-w-[200px]';

  return (
    <div className={`flex-1 shrink-0 border-r ${isDark ? 'border-white/5' : 'border-zinc-200'} flex flex-col ${minWidthClass} ${isToday ? 'bg-orange-500/[0.02]' : ''}`}>
      {/* Header Sticky block */}
      <div onClick={onClick} className={`h-24 border-b border-white/5 p-2 sticky top-0 ${isDark ? 'bg-[#0a0a0c]/80' : 'bg-white/90'} backdrop-blur-xl z-20 flex flex-col justify-between cursor-pointer hover:bg-white/5 group/day transition-colors`}>

        {/* Coverage Warning Banner */}
        {coverageAlert ? (
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
        ) : (
          <div className="absolute top-0 left-0 w-full h-1 bg-green-500/20" />
        )}

        <div className="flex items-start justify-between">
          <div className="truncate min-w-0 pr-1">
            <h2 className={`text-[11px] sm:text-xs font-black tracking-tight flex items-center gap-1.5 truncate ${isToday ? 'text-orange-400' : isHoliday ? 'text-rose-400' : isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <span className="truncate">{date}</span>
              {isToday && <span className="w-1 h-1 rounded-full shrink-0 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>}
            </h2>
          </div>
          <button className={`text-zinc-500 hover:text-white shrink-0 p-1 ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} rounded-md transition-colors`}>
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 mt-auto">
          <div className="flex gap-1 xl:gap-2 text-[8px] xl:text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
            <span className="flex items-center gap-0.5" title="Ansatte"><Users className="w-2.5 h-2.5 xl:w-3 xl:h-3" /> {staff}</span>
            <span className="flex items-center gap-0.5" title="Vakter"><Briefcase className="w-2.5 h-2.5 xl:w-3 xl:h-3" /> {shifts}</span>
          </div>

          {coverageAlert ? (
            <div className="flex items-center gap-1 bg-red-500/10 text-red-500 px-1 py-0.5 rounded w-fit border border-red-500/20 text-[8px] font-bold max-w-full">
              <AlertCircle className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{coverageAlert}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-zinc-500 px-1 py-0.5 rounded w-fit text-[8px] font-bold max-w-full">
              <CheckCircle2 className="w-2.5 h-2.5 text-green-500/50 shrink-0" /> <span className="truncate">Optimal dekning</span>
            </div>
          )}
        </div>
      </div>

      {/* Cells for this day */}
      {children}

    </div>
  )
}

function GridCell({ children, id }: { children?: React.ReactNode, id?: string }) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div ref={setNodeRef} className={`h-24 border-b border-white/5 ${isDark ? 'bg-[#050505]' : 'bg-zinc-50'}/40 transition-colors p-1 relative flex flex-col gap-1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] overflow-hidden ${isOver ? 'bg-orange-500/20 border-orange-500/50 z-10 scale-[1.02] border border-dashed rounded-lg' : 'hover:bg-white/[0.04]'}`}>
      {children}
    </div>
  )
}

function EmptyCell() {
  const { isDark } = useContext(DashboardContext);
  return (
    <button className={`absolute inset-x-1 inset-y-1 rounded-md border border-dashed ${isDark ? 'border-white/10' : 'border-zinc-300'} bg-white/[0.01] hover:bg-white/[0.03] hover:border-orange-500/30 flex items-center justify-center text-orange-500/0 hover:text-orange-500/50 transition-all opacity-0 hover:opacity-100 cursor-pointer`}>
      <Plus className="w-4 h-4" />
    </button>
  )
}

// Duplicate ShiftCard removed

function AbsenceCard({ type, reason }: { type: 'Sykdom' | 'Ferie' | 'Avspasering', reason?: string }) {

  const isSick = type === 'Sykdom';

  return (
    <div className={`relative w-full h-[38px] xl:h-[42px] shrink-0 rounded-md border flex items-center px-1.5 py-1 transition-all ${isSick
      ? 'bg-rose-500/10 border-rose-500/30 bg-[url("/diagonal-stripes-rose.svg")] bg-repeat'
      : 'bg-blue-500/10 border-blue-500/30 bg-[url("/diagonal-stripes-blue.svg")] bg-repeat'
      }`}>
      {isSick ? <AlertCircle className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-rose-400 mr-1.5 shrink-0" /> : <Ban className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-blue-400 mr-1.5 shrink-0" />}

      <div className="flex flex-col min-w-0 pr-1 truncate">
        <h4 className={`text-[10px] xl:text-[11px] font-black tracking-tight leading-none truncate ${isSick ? 'text-rose-400' : 'text-blue-400'}`}>
          {type}
        </h4>
        {reason && (
          <p className={`text-[7px] xl:text-[8px] font-bold uppercase tracking-widest mt-0.5 truncate leading-none ${isSick ? 'text-rose-500/80' : 'text-blue-500/80'}`}>
            {reason}
          </p>
        )}
      </div>

      {/* Absolute overlay blocker for interactions */}
      <div className="absolute inset-0 z-10 cursor-not-allowed hidden sm:block"></div>
    </div>
  )
}

// MONTHLY HEATMAP COMPONENT (Strategic View)
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function MonthlyGridContent({ isSidebarOpen, setIsSidebarOpen }: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isDark, scheduleView, setScheduleView } = useContext(DashboardContext);
  const columns = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className={`flex w-full min-w-[800px] flex-col h-full ${isDark ? 'bg-[#050505]' : 'bg-zinc-50'}`}>
      {/* Header Row for strategic metrics */}
      <div className={`h-16 shrink-0 border-b border-white/5 ${isDark ? 'bg-[#0a0a0c]/80' : 'bg-white/90'} flex items-center px-6 gap-6 sticky top-0 z-30`}>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 w-[200px]">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          Måned: Dekning & Kostnad
        </div>
        <div className="flex-1 flex gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Est. Lønnskostnad</span>
            <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>482,500 <span className="text-[10px] text-zinc-500 font-medium">NOK</span></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Lønn % av Salg</span>
            <span className="text-sm font-black text-green-400">28.4% <span className="text-[10px] text-zinc-500 font-medium">(Mål 30%)</span></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Underbemannede Vakter</span>
            <span className="text-sm font-black text-rose-400">12 <span className="text-[10px] text-zinc-500 font-medium">denne måneden</span></span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Sticky Label Column */}
        <div className={`w-[200px] xl:w-[250px] shrink-0 border-r border-white/5 ${isDark ? 'bg-[#0a0a0c]/60' : 'bg-white/80'} sticky left-0 z-20 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}>
          {/* Calendar Header alignment block */}
          <div className={`h-[60px] border-b ${isDark ? 'border-white/5' : 'border-zinc-200'} bg-transparent`} />

          {/* Team Aggregates */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <TeamCoverageRow title="Kjøkken" target={8} current={7} />
            <TeamCoverageRow title="Sal & Service" target={12} current={12} isPerfect />
            <TeamCoverageRow title="Bar" target={4} current={3} isWarning />
            <TeamCoverageRow title="Drift / Renhold" target={3} current={3} isPerfect />
          </div>
        </div>

        {/* Days Columns */}
        <div className="flex-1 flex overflow-x-auto min-w-0">
          {columns.map(col => {
            const isWeekend = col % 7 === 6 || col % 7 === 0;
            const isToday = col === 15;

            // Randomize some heatmap colors for demonstration
            const getHeatmapColor = (rowIdx: number) => {
              if (isWeekend && rowIdx === 2) return 'bg-rose-500/20 border-rose-500/50'; // Bar struggles on weekends
              if (rowIdx === 0 && col % 5 === 0) return 'bg-orange-500/20 border-orange-500/50'; // Kitchen warning
              return 'bg-emerald-500/10 border-emerald-500/20'; // Good coverage
            };

            return (
              <div key={col} className={`flex-1 min-w-[32px] sm:min-w-[40px] border-r ${isDark ? 'border-white/5' : 'border-zinc-200'} flex flex-col transition-colors ${isToday ? 'bg-orange-500/[0.04]' : isWeekend ? 'bg-indigo-500/[0.02]' : ''}`}>

                {/* Day Header */}
                <div className={`h-[60px] border-b border-white/5 p-1 sticky top-0 ${isDark ? 'bg-[#0a0a0c]/80' : 'bg-white/90'} backdrop-blur-xl z-10 flex flex-col justify-end items-center relative pb-2 group cursor-pointer hover:bg-white/5`}>
                  {isToday && <div className="absolute top-1 right-1/2 translate-x-1/2 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                  <h2 className={`text-[11px] xl:text-xs font-black tracking-tight ${isToday ? 'text-orange-400' : isWeekend ? 'text-indigo-400' : isDark ? 'text-white' : 'text-zinc-900'}`}>{col}</h2>
                  <span className={`text-[6px] font-bold uppercase tracking-widest mt-0.5 ${isWeekend ? 'text-indigo-500' : 'text-zinc-600'}`}>
                    {isWeekend ? 'Heg' : 'Hvd'}
                  </span>
                </div>

                {/* Heatmap Blocks */}
                <HeatmapCell colorClass={getHeatmapColor(0)} />
                <HeatmapCell colorClass={getHeatmapColor(1)} />
                <HeatmapCell colorClass={getHeatmapColor(2)} />
                <HeatmapCell colorClass={getHeatmapColor(3)} />

              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// LIST VIEW (PRINTABLE WEEKLY)
// ------------------------------------------------------------------------------------------------
function ListGridContent({ onDateClick }: { onDateClick: (d: string) => void }) {
  const { isDark } = useContext(DashboardContext);

  const printSchedule = () => {
    window.print();
  };

  return (
    <div className={`flex flex-col w-full h-full max-w-5xl mx-auto p-4 md:p-8 xl:p-12 print:bg-white print:text-black print:p-0 print:block print:h-auto`}>
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Uke 52, 2026</h2>
          <p className="text-sm font-medium text-zinc-500">Kompakt vaktlista for utskrift</p>
        </div>
        <button onClick={printSchedule} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isDark ? 'bg-white/5 text-white border-white/10 hover:bg-white/10' : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'} shadow-sm`}>
          <Printer className="w-4 h-4" /> Skriv ut
        </button>
      </div>

      <div className="print:block print:mb-8 hidden">
        <h2 className={`text-2xl font-black text-black`}>Bårdshaug Vegkro</h2>
        <p className="text-sm font-bold text-gray-500">Vaktliste • Uke 52, 2026</p>
      </div>

      <div className="space-y-8 print:space-y-4">
        {dummyDays.map(day => {
          const dayShifts = dailyShifts.filter(s => s.dateId === day.id)
            .sort((a, b) => (a.time || '').localeCompare(b.time || '')); // Sort by time

          if (dayShifts.length === 0) return null;

          return (
            <div key={day.id} className={`rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-zinc-200'} p-5 xl:p-6 print:bg-white print:border-gray-300 print:rounded-none overflow-hidden hover:border-orange-500/30 transition-colors`}>
              <div className="flex justify-between items-end border-b border-orange-500/20 pb-3 mb-4 print:border-gray-300">
                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => onDateClick(day.label)}>
                  <h3 className={`text-lg font-black ${day.isToday ? 'text-orange-400' : isDark ? 'text-white' : 'text-zinc-900'} group-hover:text-orange-400 transition-colors`}>{day.label}</h3>
                  {day.isToday && <span className="bg-orange-500/10 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-500/20 uppercase tracking-widest print:border-gray-300">I Dag</span>}
                </div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hidden sm:flex gap-3 print:hidden">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {day.staff} Ansatte</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {dayShifts.length} Vakter</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-2">
                {dayShifts.map(shift => {
                  const emp = dummyEmployees.find(e => e.id === shift.employeeId);
                  if (!emp) return null;
                  return (
                    <div key={shift.id} className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? 'bg-[#0a0a0c] border-white/5 hover:border-white/10' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'} transition-colors print:border-gray-200 print:bg-white`}>
                      <div className="w-10 h-10 shrink-0 rounded-full border border-white/10 bg-zinc-800 flex items-center justify-center relative print:border-black">
                        {emp.role === 'Leder' ? <Briefcase className="w-4 h-4 text-purple-400" /> : <Users className="w-4 h-4 text-zinc-400" />}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'} print:text-black`}>{emp.name}</span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className={`text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa] truncate print:text-gray-600`}>{shift.role}</span>
                          <span className={`text-[10px] font-black tracking-widest shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-600'} print:text-black flex items-center gap-1`}><Clock className="w-3 h-3 text-orange-500/50" /> {shift.time || shift.absenceType || 'Hele Dagen'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamCoverageRow({ title, target, current, isWarning, isPerfect }: { title: string, target: number, current: number, isWarning?: boolean, isPerfect?: boolean }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className={`h-16 border-b ${isDark ? 'border-white/5' : 'border-zinc-200'} px-4 py-2 flex flex-col justify-center hover:bg-white/[0.02] cursor-pointer`}>
      <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight leading-none mb-1.5`}>{title}</h3>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-black ${isPerfect ? 'text-emerald-400' : isWarning ? 'text-rose-400' : 'text-orange-400'}`}>
          {current} <span className="text-zinc-500 font-medium">/ {target} dekket</span>
        </span>
        {!isPerfect && (
          <AlertCircle className={`w-3.5 h-3.5 ${isWarning ? 'text-rose-400' : 'text-orange-400'}`} />
        )}
      </div>
    </div>
  )
}

function HeatmapCell({ colorClass }: { colorClass: string }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className={`h-16 border-b ${isDark ? 'border-white/5' : 'border-zinc-200'} py-1 px-0.5`}>
      <div className={`w-full h-full rounded-sm border ${colorClass} transition-opacity hover:opacity-100 opacity-80 cursor-pointer`} title="Klikk for detaljer" />
    </div>
  )
}

// DAILY BRIEFING PANEL COMPONENT
function DailyBriefingPanel({ date, onClose }: { date: string | null, onClose: () => void }) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<'oversikt' | 'meldinger' | 'bookings' | 'oppgaver'>('oversikt');

  if (!date) return null;

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Header */}
      <div className={`shrink-0 border-b ${isDark ? 'border-white/10' : 'border-zinc-300'} bg-gradient-to-r from-[#0a0a0c]/40 to-orange-500/[0.02]`}>
        <div className="p-5 pb-3">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-0.5">Kontrollsenter for dag</span>
              <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight`}>{date}</h2>
            </div>
            <button onClick={onClose} className={`p-2 text-zinc-400 hover:text-white ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} rounded-xl transition-all`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dynamic Tab Menu */}
          <div className="flex gap-2 lg:gap-4 overflow-x-auto no-scrollbar pb-1">
            <TabButton active={activeTab === 'oversikt'} onClick={() => setActiveTab('oversikt')} icon={<Info className="w-3.5 h-3.5" />} label="Oversikt" />
            <TabButton active={activeTab === 'meldinger'} onClick={() => setActiveTab('meldinger')} icon={<MessageSquare className="w-3.5 h-3.5" />} label="Dagsinfo" />
            <TabButton active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} icon={<CalendarCheck className="w-3.5 h-3.5" />} label="Selskap / Booking" />
            <TabButton active={activeTab === 'oppgaver'} onClick={() => setActiveTab('oppgaver')} icon={<ListTodo className="w-3.5 h-3.5" />} label="Oppgaver" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

        {activeTab === 'oversikt' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Vaktansvarlig</h3>
              </div>
              <div className={`p-4 ${isDark ? 'bg-white/5' : 'bg-zinc-100'} rounded-2xl border border-white/10 hover:border-white/20 transition-colors cursor-pointer flex items-center justify-between group`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-black text-xs flex items-center justify-center">IH</div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'} group-hover:text-purple-400 transition-colors`}>Ingrid Haugen</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Manager • 08:00 - 16:00</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-600 group-hover:${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
              </div>
            </section>

            {/* Quick Metrics */}
            <section>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'} mb-3`}>Dagens nøkkeltall</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Est. Kostnad</span>
                  <div className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'} mt-1`}>14,350 kr</div>
                </div>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Totale Timer</span>
                  <div className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'} mt-1`}>56t 30m</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'meldinger' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-zinc-200 shadow-sm'}`}>
              <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'} mb-2`}>Nytt oppslag</h4>
              <textarea placeholder="Skriv beskjed til ansatte her..." className={`w-full h-24 bg-transparent border ${isDark ? 'border-white/10' : 'border-zinc-300'} rounded-xl p-3 text-xs resize-none focus:outline-none focus:border-blue-500/50 block mb-3`} />

              <div className="flex flex-col gap-2 md:flex-row md:items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-white/20 p-1.5 rounded-lg">
                    <Eye className="w-3.5 h-3.5 text-zinc-400" />
                    <select className="bg-transparent text-[11px] font-bold text-zinc-300 outline-none cursor-pointer">
                      <option>Alle På Vakt</option>
                      <option>Kun Ledere</option>
                      <option>Servering (Team)</option>
                    </select>
                  </div>
                  <div className="w-px h-4 bg-white/10 hidden md:block" />
                  <div className="flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-white/20 p-1.5 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <select className="bg-transparent text-[11px] font-bold text-zinc-300 outline-none cursor-pointer">
                      <option>Hele dagen</option>
                      <option>Frem til 16:00</option>
                      <option>Permanent oppslag</option>
                    </select>
                  </div>
                </div>
                <button className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-500/30 text-[10px] border border-blue-500/30 transition-all">Publiser</button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className={`text-xs font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'} uppercase tracking-widest`}>Aktive Oppslag (2)</h4>
              <MessageCard title="Inngangsdøra trøbler" audience="Alle" author="Ingridhaugen" time="Hele dagen" content="Låsen på bakdøra henger litt. Dra den til deg før du vrir om for å unngå alarmen." alert />
              <MessageCard title="VIP Selskap kl 18:00" audience="Kun Ledere" author="System" time="18:00 - 22:00" content="Sørg for at velkomstdrinker er på plass. Jens fra styret er med og har med seg investornettverk." />
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center">
              <h4 className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-widest`}>Reservasjoner og Selskap (2)</h4>
              <button className="text-[10px] font-bold text-orange-400 flex items-center gap-1 hover:text-orange-300"><Plus className="w-3.5 h-3.5" /> Legg til manuelt</button>
            </div>

            <div className="space-y-3">
              <div className={`p-4 ${isDark ? 'bg-white/5 border border-white/10 hover:border-white/20' : 'bg-white border text-zinc-900 shadow-sm hover:border-zinc-300'} rounded-xl transition-colors`}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold flex gap-2 items-center text-sm"><Users className="w-4 h-4 text-orange-400" /> Julebord Entreprenør AS</span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">Bekreftet • VIP</span>
                </div>
                <p className="text-zinc-500 text-xs mb-3 font-medium">35 Personer • Julemeny 3-retter • Utvidet Drikkepakke (Se notat i booking)</p>
                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                  <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-zinc-500" /> 18:00 - 23:00</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-zinc-500" /> Chambre Séparée</span>
                  </div>
                  <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">Se detaljer</button>
                </div>
              </div>

              <div className={`p-4 ${isDark ? 'bg-white/5 border border-white/10 hover:border-white/20' : 'bg-white border text-zinc-900 shadow-sm hover:border-zinc-300'} rounded-xl transition-colors`}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold flex gap-2 items-center text-sm"><Users className="w-4 h-4 text-orange-400" /> Bursdagsfeiring: Thomas 30 år</span>
                  <span className="text-[10px] text-zinc-400 font-bold bg-white/10 border border-white/20 px-2 py-0.5 rounded-lg">Avventer depositum</span>
                </div>
                <p className="text-zinc-500 text-xs mb-3 font-medium">12 Personer • À la carte • Mulig kake (må bekrefte allergener)</p>
                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                  <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-zinc-500" /> 19:30 - 22:30</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-zinc-500" /> Hovedsal Bord 4-5</span>
                  </div>
                  <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">Se detaljer</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'oppgaver' && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xs font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'} uppercase tracking-widest`}>Gjøremål & Rutiner</h3>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">2 / 5 Utført</span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 mb-4">
                <input type="text" placeholder="Planlegg nytt gjøremål for dagen..." className={`flex-1 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-600' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'} text-xs p-3 rounded-xl border focus:outline-none focus:border-orange-500/50 shadow-inner`} />
                <button className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-3 md:px-4 rounded-xl hover:bg-emerald-500/30 transition-all font-bold text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Legg til</button>
              </div>
              {/* Filter tags for tasks */}
              <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar pb-1">
                <span className={`text-[9px] font-bold px-2 py-1.5 rounded-lg shrink-0 cursor-pointer ${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'} hover:bg-orange-500/20 hover:text-orange-400 transition-colors`}>Alle oppgaver</span>
                <span className={`text-[9px] font-bold px-2 py-1.5 rounded-lg shrink-0 cursor-pointer text-zinc-500 bg-transparent border ${isDark ? 'border-white/10' : 'border-zinc-300'} hover:border-orange-500/50 transition-colors`}>Faste Rutiner (3)</span>
                <span className={`text-[9px] font-bold px-2 py-1.5 rounded-lg shrink-0 cursor-pointer text-zinc-500 bg-transparent border ${isDark ? 'border-white/10' : 'border-zinc-300'} hover:border-orange-500/50 transition-colors`}>Delegert (1)</span>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${isDark ? 'bg-white/5 border-white/5 opacity-60' : 'bg-zinc-100 border-zinc-200 opacity-60'}`}>
                <button className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors bg-emerald-500 border-emerald-500 text-[#050505]`}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-zinc-500 line-through truncate">Varetelling - Drikkevarer</span>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${isDark ? 'bg-white/5 border-white/5 opacity-60' : 'bg-zinc-100 border-zinc-200 opacity-60'}`}>
                <button className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors bg-emerald-500 border-emerald-500 text-[#050505]`}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-zinc-500 line-through truncate">Sjekk temperatur i fryser (Rutine: Stengevakt)</span>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/5' : 'bg-white border-zinc-200'}`}>
                <button className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors border-zinc-600 hover:border-orange-500 text-transparent`}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-zinc-200 truncate">Motta bestilling Bama</span>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${isDark ? 'bg-orange-500/5 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
                <button className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors border-zinc-600 hover:border-orange-500 text-transparent`}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-zinc-200 truncate">Oppdater meny i kasse</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/5' : 'bg-white border-zinc-200'}`}>
                <button className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors border-zinc-600 hover:border-orange-500 text-transparent`}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-zinc-200 truncate">Kaste papp (Rutine: Kjøkken)</span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer Broadcast Action */}
      <div className={`p-5 border-t border-white/10 ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" /> Kringkast til alle på vakt</h3>
          <span className="text-[10px] text-zinc-600 font-medium">8 ansatte</span>
        </div>
        <div className="flex gap-2">
          <button className={`flex-1 flex items-center justify-center gap-2 bg-white/5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} text-white border border-white/10 hover:border-white/20 py-2.5 rounded-xl text-xs font-bold transition-all`}>
            <MessageCircle className="w-4 h-4 text-blue-400" /> Push Vakt
          </button>
          <button className={`flex-1 flex items-center justify-center gap-2 bg-white/5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'} text-white border border-white/10 hover:border-white/20 py-2.5 rounded-xl text-xs font-bold transition-all`}>
            <Mail className="w-4 h-4 text-orange-400" /> SMS
          </button>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 pb-2 text-[11px] font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${active ? (isDark ? 'border-orange-500 text-orange-400' : 'border-orange-500 text-orange-500') : 'border-transparent text-zinc-500 hover:text-zinc-400'} px-2`}>
      {icon} {label}
    </button>
  );
}

function MessageCard({ title, audience, author, time, content, alert }: { title: string, audience: string, author: string, time: string, content: string, alert?: boolean }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className={`p-4 rounded-xl border ${alert ? (isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200') : (isDark ? 'bg-white/5 border-white/10' : 'bg-white border-zinc-200')} transition-all`}>
      <div className="flex justify-between items-start mb-2">
        <h5 className={`text-xs font-black flex items-center gap-1.5 ${alert ? 'text-rose-400' : isDark ? 'text-white' : 'text-zinc-900'}`}>
          {alert && <AlertCircle className="w-3.5 h-3.5" />} {title}
        </h5>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${isDark ? 'bg-black/40 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>{time}</span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'} mb-3`}>{content}</p>
      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Synlig for: {audience}</span>
        <span className="italic">Av: {author}</span>
      </div>
    </div>
  )
}

function TemplateCard({ id, title, hours, routines }: { id: string, title: string, team: string, hours: string, routines: number }) {
  const { isDark } = useContext(DashboardContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { role: title, time: hours, status: 'draft', indicator: 'yellow', type: 'shift-template' }
  });

  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 50, position: 'relative' as React.CSSProperties['position'] } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-3 ${isDark ? 'bg-[#151518]' : 'bg-white'} border ${isDark ? 'border-zinc-700 border-dashed' : 'border-zinc-300 border-dashed'} hover:border-orange-500/50 rounded-xl cursor-grab active:cursor-grabbing hover:bg-orange-500/5 transition-all group shadow-sm ${isDragging ? 'opacity-30' : ''}`}>
      <div className="flex justify-between items-start mb-1.5">
        <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'} group-hover:text-orange-400 transition-colors`}>{title}</h4>
        <span className="bg-orange-500/10 text-orange-400 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest leading-none">Mal</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
        <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {hours}</div>
        <div className="flex items-center gap-1" title={`${routines} faste rutiner knyttet til vakt`}>
          <ListTodo className="w-3 h-3 text-emerald-500/70" /> {routines} rutiner
        </div>
      </div>
    </div>
  )
}