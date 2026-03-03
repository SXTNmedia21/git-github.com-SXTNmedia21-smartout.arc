"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { OnboardingProvider, useOnboarding } from "./WizardContext";
import { ParallaxBackground } from "./components/ParallaxBackground";
import { BotssonAvatar } from "./components/BotssonAvatar";
import { AgentCard } from "@/components/agent-card";
import { getMission } from "@smartout/ai/missions";
import { HeroSection } from "./sections/HeroSection";
import { BusinessSection } from "./sections/BusinessSection";
import { SeasonSection } from "./sections/SeasonSection";
import { DepartmentsSection } from "./sections/DepartmentsSection";
import { ContractSection } from "./sections/ContractSection";
import { DoneSection } from "./sections/DoneSection";
import type { OnboardingSection } from "./types";
import { ONBOARDING_SECTIONS } from "./types";

const SECTION_COMPONENTS: Record<OnboardingSection, React.ComponentType> = {
  hero: HeroSection,
  business: BusinessSection,
  season: SeasonSection,
  departments: DepartmentsSection,
  contract: ContractSection,
  done: DoneSection,
};

function ProgressBar() {
  const { totalProgress } = useOnboarding();

  return (
    <div className="fixed top-0 right-0 left-0 z-50 h-[3px] bg-white/5">
      <motion.div
        className="h-full bg-white/40"
        animate={{ width: `${totalProgress * 100}%` }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        style={{ boxShadow: "0 0 16px rgba(255,255,255,0.15)" }}
      />
    </div>
  );
}

const mission = getMission("onboarding-interview");

function ScrollContainer() {
  const { containerRef, botsson, reset } = useOnboarding();
  const startedRef = useRef(false);
  const [cardOpen, setCardOpen] = useState(false);

  // Start Lise on first user interaction (browser requires gesture for audio)
  const handleFirstInteraction = useCallback(() => {
    if (startedRef.current || botsson.status !== "idle") return;
    startedRef.current = true;
    void botsson.startSession();
  }, [botsson.status, botsson.startSession]);

  return (
    <>
      <ProgressBar />

      <main
        ref={containerRef as React.RefObject<HTMLElement>}
        className="h-dvh overflow-hidden"
        style={{ scrollBehavior: "smooth", touchAction: "none" }}
        onClick={handleFirstInteraction}
      >
        {ONBOARDING_SECTIONS.map((section) => {
          const SectionComponent = SECTION_COMPONENTS[section];
          return (
            <section key={section} data-section={section} className="relative min-h-dvh">
              <ParallaxBackground section={section} containerRef={containerRef} />
              <motion.div
                className="relative z-10 flex min-h-dvh items-center justify-center px-6"
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="w-full max-w-2xl">
                  <SectionComponent />
                </div>
              </motion.div>
            </section>
          );
        })}
      </main>

      <button
        type="button"
        onClick={() => void reset()}
        className="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.05] text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
        title="Reset onboarding"
      >
        <RotateCcw className="h-4 w-4" />
      </button>

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

      {mission && (
        <AgentCard
          open={cardOpen}
          onOpenChange={setCardOpen}
          name={mission.agentDisplayName}
          description={mission.description}
          greeting={mission.greeting}
          temperature={mission.temperature}
          voice={mission.voice}
          language={mission.language}
          maxDuration={mission.maxDurationSeconds}
          firstSpeaker={mission.firstSpeaker}
          status={String(botsson.status)}
          isConnected={botsson.isConnected}
          contextLog={botsson.contextLog}
          transcript={botsson.transcript}
          instruction={mission.systemPrompt}
        />
      )}
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center bg-[oklch(0.10_0.01_250)]">
          <Loader2 className="animate-spin text-white/40" size={32} />
        </div>
      }
    >
      <OnboardingProvider>
        <ScrollContainer />
      </OnboardingProvider>
    </Suspense>
  );
}
