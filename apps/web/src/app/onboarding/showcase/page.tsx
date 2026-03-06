"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Brain,
  Clock,
  Eye,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Shield,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OnboardingProvider, useOnboarding } from "./WizardContext";
import { ParallaxBackground } from "./components/ParallaxBackground";
import { AmbientBackground } from "./components/AmbientBackground";
import { BotssonAvatar } from "./components/BotssonAvatar";
import { VoiceSessionOverlay } from "./components/VoiceSessionOverlay";
import { KeyFactsPanel } from "./components/KeyFactsPanel";
import { NavigationController } from "./components/NavigationController";
import { AgentControlPanel } from "./components/AgentControlPanel";
import { AlertOrchestra } from "./_components/AlertOrchestra";
import { HeroSection } from "./sections/HeroSection";
import { BusinessSection } from "./sections/BusinessSection";
import { SeasonSection } from "./sections/SeasonSection";
import { DepartmentsSection } from "./sections/DepartmentsSection";
import { LocationsSection } from "./sections/LocationsSection";
import { ProceduresSection } from "./sections/ProceduresSection";
import { ContractSection } from "./sections/ContractSection";
import { WelcomeSection } from "./sections/WelcomeSection";
import type { OnboardingSection } from "./types";
import { ONBOARDING_SECTIONS } from "./types";
import {
  computeJourneyProgress,
  computeUnderstandingScore,
  inferUserProfile,
  formatDuration,
} from "./lib/showcase-journey";
import { canSpeak, getCapabilityState, getPolicySummary } from "./lib/showcase-policy";
import { normalizeScrapeData } from "./lib/showcase-scrape";

// ─── Section map ───
const SECTION_COMPONENTS: Record<OnboardingSection, React.ComponentType> = {
  hero: HeroSection,
  business: BusinessSection,
  departments: DepartmentsSection,
  locations: LocationsSection,
  procedures: ProceduresSection,
  season: SeasonSection,
  contract: ContractSection,
  welcome: WelcomeSection,
};

const SECTION_COLORS: Record<OnboardingSection, string> = {
  hero: "oklch(0.75 0.18 55)",
  business: "oklch(0.65 0.15 250)",
  departments: "oklch(0.70 0.16 160)",
  locations: "oklch(0.68 0.14 320)",
  procedures: "oklch(0.72 0.12 30)",
  season: "oklch(0.60 0.18 280)",
  contract: "oklch(0.65 0.10 200)",
  welcome: "oklch(0.75 0.18 55)",
};

// ─── Types ───
type TimelineEvent = {
  id: string;
  timestamp: number;
  type: "tool" | "section" | "scrape" | "voice" | "interaction";
  label: string;
  detail?: string;
};

// ─── System Room Progress Bar ───
function SystemRoomProgressBar({
  progress,
  understanding,
}: {
  progress: number;
  understanding: number;
}) {
  return (
    <div className="fixed top-0 right-0 left-0 z-50 flex h-[3px] gap-px bg-white/5">
      <motion.div
        className="h-full bg-white/40"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        style={{ boxShadow: "0 0 16px rgba(255,255,255,0.15)" }}
      />
      <motion.div
        className="h-full"
        animate={{ width: `${Math.max(0, understanding - progress)}%` }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "oklch(0.75 0.18 55 / 0.5)",
          boxShadow: "0 0 12px oklch(0.75 0.18 55 / 0.3)",
        }}
      />
    </div>
  );
}

// ─── Context Panel ───
function ContextPanel({
  sessionAge,
  profile,
  activeSection,
  interactionCount,
  accentColor,
}: {
  sessionAge: number;
  profile: string;
  activeSection: OnboardingSection;
  interactionCount: number;
  accentColor: string;
}) {
  return (
    <motion.div
      className="fixed top-3 left-3 z-40 w-56 rounded-xl border border-white/[0.08] bg-black/60 p-3 backdrop-blur-xl"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
        System Room
      </p>

      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-white/40" />
          <span className="text-xs text-white/60">{formatDuration(sessionAge)}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-white/40" />
          <span className="text-xs text-white/60">{profile}</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-white/40" />
          <span className="text-xs text-white/60">{interactionCount} interaksjoner</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-3 w-3" style={{ color: accentColor }} />
          <span className="text-xs font-medium" style={{ color: accentColor }}>
            {activeSection}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Capability Panel ───
function CapabilityPanel({
  hasScrapeUrl,
  manualSpeech,
  voiceEnabled,
  hasManualTrigger,
}: {
  hasScrapeUrl: boolean;
  manualSpeech: boolean;
  voiceEnabled: boolean;
  hasManualTrigger: boolean;
}) {
  const capabilities = getCapabilityState({ hasScrapeUrl, manualSpeech });
  const speechAllowed = canSpeak({ voiceEnabled, hasManualTrigger });
  const policySummary = getPolicySummary({ manualSpeech });

  const capEntries = Object.entries(capabilities) as [string, string][];

  const stateColors: Record<string, string> = {
    enabled: "text-emerald-400",
    manual: "text-amber-400",
    disabled: "text-white/25",
    idle: "text-white/35",
  };

  const stateIcons: Record<string, typeof Zap> = {
    enabled: Zap,
    manual: Shield,
    disabled: MicOff,
    idle: Globe,
  };

  return (
    <motion.div
      className="fixed right-3 bottom-28 z-40 w-52 rounded-xl border border-white/[0.08] bg-black/60 p-3 backdrop-blur-xl"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
        Capabilities
      </p>

      <div className="mt-2 space-y-1.5">
        {capEntries.map(([name, state]) => {
          const Icon = stateIcons[state] ?? Zap;
          return (
            <div key={name} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3 w-3 ${stateColors[state] ?? "text-white/40"}`} />
                <span className="text-xs text-white/60">{name}</span>
              </div>
              <span className={`text-[10px] font-medium ${stateColors[state] ?? "text-white/40"}`}>
                {state}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 border-t border-white/[0.06] pt-2">
        <div className="flex items-center gap-1.5">
          {speechAllowed ? (
            <Mic className="h-3 w-3 text-emerald-400" />
          ) : (
            <MicOff className="h-3 w-3 text-white/25" />
          )}
          <span className="text-[10px] text-white/40">{policySummary}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Event Timeline ───
function EventTimeline({ events }: { events: TimelineEvent[] }) {
  const typeIcons: Record<TimelineEvent["type"], typeof Zap> = {
    tool: Zap,
    section: Eye,
    scrape: Globe,
    voice: Mic,
    interaction: MessageSquare,
  };

  const typeColors: Record<TimelineEvent["type"], string> = {
    tool: "text-amber-400",
    section: "text-sky-400",
    scrape: "text-emerald-400",
    voice: "text-purple-400",
    interaction: "text-white/50",
  };

  return (
    <motion.div
      className="fixed bottom-3 left-3 z-40 w-64 rounded-xl border border-white/[0.08] bg-black/60 p-3 backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
        Event Timeline
      </p>

      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {events.slice(0, 8).map((event) => {
            const Icon = typeIcons[event.type];
            return (
              <motion.div
                key={event.id}
                className="flex items-start gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${typeColors[event.type]}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs text-white/70">{event.label}</p>
                  {event.detail && (
                    <p className="truncate text-[10px] text-white/30">{event.detail}</p>
                  )}
                </div>
                <span className="ml-auto shrink-0 text-[10px] text-white/20">
                  {formatDuration(Date.now() - event.timestamp)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {events.length === 0 && (
          <p className="text-xs text-white/25 italic">Ingen hendelser ennå...</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Telemetry Score ───
function TelemetryScore({
  progress,
  understanding,
  profile,
}: {
  progress: number;
  understanding: number;
  profile: string;
}) {
  return (
    <motion.div
      className="fixed top-3 right-3 z-40 w-48 rounded-xl border border-white/[0.08] bg-black/60 p-3 backdrop-blur-xl"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
        Telemetry
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] text-white/40">
            <span>Fremgang</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-white/50"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-white/40">
            <span>Forståelse</span>
            <span>{understanding}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "oklch(0.75 0.18 55)" }}
              animate={{ width: `${understanding}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
          <Brain className="h-3 w-3 text-white/30" />
          <span className="text-[10px] text-white/50">{profile}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main System Room ───
function SystemRoom() {
  const { containerRef, botsson, activeSection, sectionIndex, business, scrapeStatus } =
    useOnboarding();
  const [cardOpen, setCardOpen] = useState(false);
  const [systemRoomOpen, setSystemRoomOpen] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [interactionCount, setInteractionCount] = useState(0);
  const [scrapeSuccesses, setScrapeSuccesses] = useState(0);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const [sessionAge, setSessionAge] = useState(0);
  const prevSectionRef = useRef(activeSection);
  const prevScrapeRef = useRef(scrapeStatus);

  const showVoiceOverlay = botsson.status !== "idle" && activeSection === "hero";

  // Session age ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionAge(Date.now() - sessionStartRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track section changes
  useEffect(() => {
    if (activeSection !== prevSectionRef.current) {
      prevSectionRef.current = activeSection;
      setInteractionCount((c) => c + 1);
      setEvents((prev) =>
        [
          {
            id: `section-${Date.now()}`,
            timestamp: Date.now(),
            type: "section" as const,
            label: `Navigerte til ${activeSection}`,
          },
          ...prev,
        ].slice(0, 50),
      );
    }
  }, [activeSection]);

  // Track scrape changes
  useEffect(() => {
    if (scrapeStatus !== prevScrapeRef.current) {
      prevScrapeRef.current = scrapeStatus;
      if (scrapeStatus === "scraping") {
        setEvents((prev) =>
          [
            {
              id: `scrape-${Date.now()}`,
              timestamp: Date.now(),
              type: "scrape" as const,
              label: "Skanning startet",
              detail: business.website || business.name || undefined,
            },
            ...prev,
          ].slice(0, 50),
        );
      } else if (scrapeStatus === "done") {
        setScrapeSuccesses((c) => c + 1);
        const normalized = normalizeScrapeData({
          summary: business.description,
          email: business.email,
          phone: business.phone,
          locations: [],
        });
        setEvents((prev) =>
          [
            {
              id: `scrape-done-${Date.now()}`,
              timestamp: Date.now(),
              type: "scrape" as const,
              label: "Skanning fullført",
              detail: normalized.summary
                ? normalized.summary.slice(0, 60)
                : business.name || undefined,
            },
            ...prev,
          ].slice(0, 50),
        );
      }
    }
  }, [scrapeStatus, business]);

  // Track voice events
  useEffect(() => {
    if (botsson.isConnected) {
      setEvents((prev) =>
        [
          {
            id: `voice-${Date.now()}`,
            timestamp: Date.now(),
            type: "voice" as const,
            label: botsson.isSpeaking ? "Agent snakker" : "Voice tilkoblet",
          },
          ...prev,
        ].slice(0, 50),
      );
    }
  }, [botsson.isConnected, botsson.isSpeaking]);

  // Compute telemetry
  const progress = useMemo(
    () =>
      computeJourneyProgress({
        stepIndex: sectionIndex,
        totalSteps: ONBOARDING_SECTIONS.length,
        scrapeSuccesses,
        hasQuizAnswer: questionsAsked > 0,
      }),
    [sectionIndex, scrapeSuccesses, questionsAsked],
  );

  const understanding = useMemo(
    () =>
      computeUnderstandingScore({
        quizCorrect: Math.min(questionsAsked, 2),
        questionsAsked,
        scrapeSuccesses,
        interactionCount,
      }),
    [questionsAsked, scrapeSuccesses, interactionCount],
  );

  const profile = useMemo(
    () =>
      inferUserProfile({
        scrapeAttempts: scrapeSuccesses,
        questionsAsked,
        interactionCount,
      }),
    [scrapeSuccesses, questionsAsked, interactionCount],
  );

  const accentColor = SECTION_COLORS[activeSection];

  return (
    <>
      <AmbientBackground />
      <SystemRoomProgressBar progress={progress} understanding={understanding} />
      <NavigationController />
      <KeyFactsPanel />

      {/* System Room toggle */}
      <button
        type="button"
        onClick={() => setSystemRoomOpen((o) => !o)}
        className="fixed top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/[0.08] bg-black/60 px-4 py-1.5 backdrop-blur-xl transition-colors hover:bg-white/10"
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: accentColor }} />
        <span className="text-xs font-medium text-white/60">System Room</span>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: systemRoomOpen ? accentColor : "rgba(255,255,255,0.2)" }}
        />
      </button>

      {/* System Room panels */}
      <AnimatePresence>
        {systemRoomOpen && (
          <>
            <ContextPanel
              sessionAge={sessionAge}
              profile={profile}
              activeSection={activeSection}
              interactionCount={interactionCount}
              accentColor={accentColor}
            />
            <TelemetryScore progress={progress} understanding={understanding} profile={profile} />
            <CapabilityPanel
              hasScrapeUrl={!!business.website}
              manualSpeech={true}
              voiceEnabled={botsson.isConnected}
              hasManualTrigger={botsson.status !== "idle"}
            />
            <EventTimeline events={events} />
          </>
        )}
      </AnimatePresence>

      {/* Onboarding sections */}
      <main
        ref={containerRef as React.RefObject<HTMLElement>}
        className="h-dvh overflow-hidden"
        style={{ scrollBehavior: "smooth", touchAction: "none" }}
      >
        {ONBOARDING_SECTIONS.map((section) => {
          const SectionComponent = SECTION_COMPONENTS[section];
          return (
            <section key={section} data-section={section} className="relative min-h-dvh">
              <ParallaxBackground section={section} containerRef={containerRef} />
              <motion.div
                className="relative z-10 min-h-dvh"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
              >
                <SectionComponent />
              </motion.div>
            </section>
          );
        })}

        {/* Alert Orchestra — after all sections */}
        <section className="relative min-h-dvh px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <AlertOrchestra />
          </div>
        </section>
      </main>

      {showVoiceOverlay && <VoiceSessionOverlay />}
      {!showVoiceOverlay && <AgentControlPanel />}
      {!showVoiceOverlay && (
        <BotssonAvatar
          status={botsson.status}
          isConnected={botsson.isConnected}
          isSpeaking={botsson.isSpeaking}
          isMuted={botsson.isMuted}
          currentText={botsson.currentText}
          onToggleMic={botsson.toggleMic}
          onStart={botsson.startSession}
          onEnd={botsson.endSession}
          onShowCard={() => setCardOpen(true)}
        />
      )}
    </>
  );
}

export default function ShowcasePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center bg-[oklch(0.10_0.01_250)]">
          <Loader2 className="animate-spin text-white/40" size={32} />
        </div>
      }
    >
      <OnboardingProvider>
        <SystemRoom />
      </OnboardingProvider>
    </Suspense>
  );
}
