"use client";

import { useCallback, useRef } from "react";
import { FlowProvider, useFlow } from "./FlowContext";
import { SlideTransition } from "./primitives/SlideTransition";
import { ProgressDots } from "./primitives/ProgressDots";
import { HeroSlide } from "./slides/HeroSlide";
import { GiveSlide } from "./slides/GiveSlide";
import { TakeSlide } from "./slides/TakeSlide";
import { SummarySlide } from "./slides/SummarySlide";
import type { FlowPlayerProps, SlideConfig, TransitionType, FlowEvent } from "./types";

interface FlowRendererProps {
  slides: SlideConfig[];
  context: Record<string, string>;
  defaultTransition: TransitionType;
  onSkip?: () => void;
  onEvent?: (event: FlowEvent) => void;
  renderIcon?: (iconName: string) => React.ReactNode;
}

function FlowRenderer({
  slides,
  context,
  defaultTransition,
  onSkip,
  onEvent,
  renderIcon,
}: FlowRendererProps) {
  const {
    currentSlide,
    direction,
    answers,
    totalSlides,
    next,
    toggleAnswer,
    complete,
  } = useFlow();
  const config = slides[currentSlide];
  const skipStartRef = useRef(Date.now());

  if (!config) return null;

  const transition = config.transition ?? defaultTransition;

  const getSelected = useCallback(
    (key: string): string[] => {
      const val = answers[key];
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    },
    [answers],
  );

  const handleSkip = useCallback(() => {
    if (onEvent) {
      onEvent({
        type: "flow:skipped",
        slideIndex: currentSlide,
        slideType: config.type,
        durationMs: Date.now() - skipStartRef.current,
      });
    }
    onSkip?.();
  }, [onSkip, onEvent, currentSlide, config.type]);

  return (
    <div className="relative flex h-dvh flex-col bg-[var(--background)]">
      {/* Skip button */}
      {onSkip && (
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-6 right-6 z-20 text-sm text-[var(--muted-foreground)]/50 transition-colors hover:text-[var(--muted-foreground)]"
        >
          Hopp over
        </button>
      )}

      {/* Slide content */}
      <div className="flex-1">
        <SlideTransition
          slideKey={currentSlide}
          transition={transition}
          direction={direction}
        >
          {config.type === "hero" && (
            <HeroSlide config={config} context={context} onContinue={next} />
          )}
          {config.type === "give" && (
            <GiveSlide config={config} context={context} onContinue={next} />
          )}
          {config.type === "take" && (
            <TakeSlide
              config={config}
              context={context}
              selected={getSelected(config.answerKey)}
              onToggle={(optionId) =>
                toggleAnswer(config.answerKey, optionId, config.multi ?? false)
              }
              onContinue={next}
              renderIcon={renderIcon}
            />
          )}
          {config.type === "summary" && (
            <SummarySlide
              config={config}
              context={context}
              answers={answers}
              onAction={(key) => complete(key)}
            />
          )}
        </SlideTransition>
      </div>

      {/* Progress dots */}
      <div className="pb-8">
        <ProgressDots total={totalSlides} current={currentSlide} />
      </div>
    </div>
  );
}

export function FlowPlayer({
  slides,
  context,
  onComplete,
  onSkip,
  onEvent,
  defaultTransition = "fade",
  renderIcon,
}: FlowPlayerProps) {
  return (
    <FlowProvider slides={slides} onComplete={onComplete} onEvent={onEvent}>
      <FlowRenderer
        slides={slides}
        context={context}
        defaultTransition={defaultTransition}
        onSkip={onSkip}
        onEvent={onEvent}
        renderIcon={renderIcon}
      />
    </FlowProvider>
  );
}
