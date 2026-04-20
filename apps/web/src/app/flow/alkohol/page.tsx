"use client";

import { FlowPlayer, type FlowResult, type FlowEvent } from "@smartout/ui";
import { emit } from "@smartout/telemetry";
import { useFlowContext } from "../_hooks/use-flow-context";
import {
  Shield,
  Users,
  BookOpen,
  Sparkles,
  Clock,
  Heart,
  Wine,
  Coffee,
  Handshake,
  Lightbulb,
  Flame,
  Star,
  Target,
  MessageSquare,
} from "lucide-react";
import { alkoholFlow } from "./flow-config";

const FLOW_ID = "alkohol-servering-v1";

const ICON_MAP: Record<string, React.ReactNode> = {
  shield: <Shield className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  book: <BookOpen className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
  clock: <Clock className="h-5 w-5" />,
  heart: <Heart className="h-5 w-5" />,
  wine: <Wine className="h-5 w-5" />,
  coffee: <Coffee className="h-5 w-5" />,
  handshake: <Handshake className="h-5 w-5" />,
  lightbulb: <Lightbulb className="h-5 w-5" />,
  flame: <Flame className="h-5 w-5" />,
  star: <Star className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
  message: <MessageSquare className="h-5 w-5" />,
};

export default function AlkoholFlowPage() {
  const { workspaceId, actorId } = useFlowContext();

  function handleEvent(event: FlowEvent) {
    switch (event.type) {
      case "flow:started":
        void emit({
          event: "flow started",
          workspace_id: workspaceId,
          actor_id: actorId,
          properties: {
            data: {
              flow_id: FLOW_ID,
              total_slides: (event.data?.totalSlides as number) ?? 0,
            },
          },
        });
        break;

      case "flow:slide_viewed":
        void emit({
          event: "flow slide_viewed",
          workspace_id: workspaceId,
          actor_id: actorId,
          properties: {
            data: {
              flow_id: FLOW_ID,
              slide_index: event.slideIndex,
              slide_type: event.slideType,
              duration_ms: event.durationMs,
            },
          },
        });
        break;

      case "flow:answer_submitted":
        void emit({
          event: "flow answer_submitted",
          workspace_id: workspaceId,
          actor_id: actorId,
          properties: {
            data: {
              flow_id: FLOW_ID,
              slide_index: event.slideIndex,
              answer_key: (event.data?.answerKey as string) ?? "",
              answer_value: (event.data?.optionId as string) ?? "",
            },
          },
        });
        break;

      case "flow:skipped":
        void emit({
          event: "flow skipped",
          workspace_id: workspaceId,
          actor_id: actorId,
          properties: {
            data: {
              flow_id: FLOW_ID,
              slide_index: event.slideIndex,
              slide_type: event.slideType,
              duration_ms: event.durationMs,
            },
          },
        });
        break;

      case "flow:completed":
        void emit({
          event: "flow completed",
          workspace_id: workspaceId,
          actor_id: actorId,
          properties: {
            data: {
              flow_id: FLOW_ID,
              total_slides: alkoholFlow.length,
              duration_ms: (event.data?.totalDurationMs as number) ?? 0,
              action: (event.data?.action as string) ?? undefined,
              answers: (event.data?.answers as Record<string, string | string[]>) ?? {},
            },
          },
        });
        break;
    }
  }

  function handleComplete(result: FlowResult) {
    const correct: Record<string, string | string[]> = {
      ageLimitBeerWine: "18",
      spiritsClosingTime: "0300",
      whenToCheckId: "under25",
      intoxicatedGuest: "refuse",
      pointsUnderage: "8",
      validIdTypes: ["passport", "driverLicense", "bankId", "foreignPassport"],
    };

    let score = 0;
    let total = 0;

    for (const [key, expected] of Object.entries(correct)) {
      const answer = result.answers[key];
      total++;

      if (Array.isArray(expected)) {
        if (
          Array.isArray(answer) &&
          expected.length === answer.length &&
          expected.every((v) => answer.includes(v))
        ) {
          score++;
        }
      } else if (answer === expected) {
        score++;
      }
    }

    const timeSeconds = Math.round(result.durationMs / 1000);
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = timeSeconds % 60;

    alert(
      `Resultat: ${score}/${total} riktige svar\n` +
        `Tid: ${minutes}m ${seconds}s\n\n` +
        (score === total
          ? "Perfekt! Du kan alkoholreglene."
          : "Gå gjerne gjennom opplæringen en gang til."),
    );
  }

  return (
    <FlowPlayer
      slides={alkoholFlow}
      flowId={FLOW_ID}
      context={{
        companyName: "Brasserie Blå",
        employeeName: "Ansatt",
      }}
      onComplete={handleComplete}
      onEvent={handleEvent}
      defaultTransition="fade"
      renderIcon={(name) => ICON_MAP[name] ?? null}
    />
  );
}
