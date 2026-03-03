"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { OnboardingProvider, useOnboarding } from "./WizardContext";
import { ParallaxBackground } from "./components/ParallaxBackground";
import { BotssonAvatar } from "./components/BotssonAvatar";
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
    <div className="fixed top-0 right-0 left-0 z-50 h-0.5 bg-white/5">
      <motion.div
        className="h-full bg-white/40"
        style={{ width: `${totalProgress * 100}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

function ScrollContainer() {
  const { containerRef, botsson } = useOnboarding();

  return (
    <>
      <ProgressBar />

      <main
        ref={containerRef as React.RefObject<HTMLElement>}
        className="h-dvh snap-y snap-mandatory overflow-y-auto"
        style={{ scrollBehavior: "smooth" }}
        onClick={() => {
          if (!botsson.isUnlocked) botsson.unlock();
        }}
      >
        {ONBOARDING_SECTIONS.map((section) => {
          const SectionComponent = SECTION_COMPONENTS[section];
          return (
            <section key={section} data-section={section} className="relative min-h-dvh snap-start">
              <ParallaxBackground section={section} containerRef={containerRef} />
              <div className="relative z-10 flex min-h-dvh items-center justify-center px-6">
                <div className="w-full max-w-2xl">
                  <SectionComponent />
                </div>
              </div>
            </section>
          );
        })}
      </main>

      <BotssonAvatar
        isSpeaking={botsson.isSpeaking}
        isEnabled={botsson.isEnabled}
        isUnlocked={botsson.isUnlocked}
        currentText={botsson.currentText}
        onToggle={botsson.toggleVoice}
        onUnlock={botsson.unlock}
      />
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
