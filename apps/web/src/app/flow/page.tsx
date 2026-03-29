"use client";

import { FlowPlayer, type SlideConfig, type FlowResult, type FlowEvent } from "@smartout/ui";
import { emit } from "@smartout/telemetry";
import {
  Shield,
  Users,
  BookOpen,
  Sparkles,
  Clock,
  Heart,
  Utensils,
  Wine,
  Coffee,
  Megaphone,
  Handshake,
  Lightbulb,
  Flame,
  Star,
  Target,
  MessageSquare,
} from "lucide-react";

const FLOW_ID = "onboarding-info-v1";

const ICON_MAP: Record<string, React.ReactNode> = {
  shield: <Shield className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  book: <BookOpen className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
  clock: <Clock className="h-5 w-5" />,
  heart: <Heart className="h-5 w-5" />,
  utensils: <Utensils className="h-5 w-5" />,
  wine: <Wine className="h-5 w-5" />,
  coffee: <Coffee className="h-5 w-5" />,
  megaphone: <Megaphone className="h-5 w-5" />,
  handshake: <Handshake className="h-5 w-5" />,
  lightbulb: <Lightbulb className="h-5 w-5" />,
  flame: <Flame className="h-5 w-5" />,
  star: <Star className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
  message: <MessageSquare className="h-5 w-5" />,
};

const demoSlides: SlideConfig[] = [
  {
    type: "hero",
    title: "Velkommen til {{companyName}}",
    subtitle: "La oss bygge noe spesielt sammen — en håndbok som faktisk passer din bedrift.",
    transition: "morph",
  },
  {
    type: "give",
    title: "Hva er Smartout?",
    body: "Smartout gjør ansatte trygge og selvstendige fra dag \u00e9n. Vi bygger en personlig håndbok for bedriften din — med retningslinjer, rutiner og opplæring tilpasset akkurat det dere trenger.",
    layout: "center",
    transition: "fade",
  },
  {
    type: "give",
    title: "Skreddersydd for din bransje",
    body: "Basert på det vi allerede vet om {{companyName}}, har vi forberedt et utgangspunkt for håndboken din. Nå trenger vi din input for å gjøre den perfekt.",
    layout: "center",
    transition: "reveal",
  },
  {
    type: "take",
    question: "Hvem er gjestene dine?",
    answerKey: "targetAudience",
    multi: true,
    options: [
      { id: "families", label: "Familier", icon: "heart" },
      { id: "business", label: "Forretningsfolk", icon: "handshake" },
      { id: "tourists", label: "Turister", icon: "sparkles" },
      { id: "locals", label: "Lokale stamgjester", icon: "coffee" },
      { id: "foodies", label: "Matentusiaster", icon: "utensils" },
      { id: "nightlife", label: "Uteliv", icon: "wine" },
    ],
    transition: "push",
  },
  {
    type: "give",
    title: "Retningslinjer som faktisk brukes",
    body: "Vi lager ikke bare dokumenter som samler støv. Hver retningslinje blir til interaktiv opplæring med kunnskapstester — så du vet at teamet ditt faktisk forstår og følger dem.",
    layout: "center",
    transition: "scale",
  },
  {
    type: "take",
    question: "Hvilke retningslinjer er viktigst for deg?",
    answerKey: "policyPriorities",
    multi: true,
    options: [
      { id: "service", label: "Servicekvalitet", icon: "star" },
      { id: "hygiene", label: "Hygiene & HACCP", icon: "shield" },
      { id: "sales", label: "Mersalg", icon: "megaphone" },
      { id: "onboarding", label: "Onboarding", icon: "book" },
      { id: "culture", label: "Bedriftskultur", icon: "heart" },
      { id: "safety", label: "HMS & sikkerhet", icon: "lightbulb" },
    ],
    transition: "push",
  },
  {
    type: "take",
    question: "Hvilken tone skal håndboken ha?",
    answerKey: "toneOfVoice",
    multi: false,
    options: [
      {
        id: "professional",
        label: "Profesjonell",
        description: "Formell og tydelig",
        icon: "handshake",
      },
      {
        id: "friendly",
        label: "Vennlig",
        description: "Uformell og varm",
        icon: "heart",
      },
      {
        id: "energetic",
        label: "Energisk",
        description: "Motiverende og direkte",
        icon: "flame",
      },
      {
        id: "calm",
        label: "Rolig",
        description: "Avslappet og trygg",
        icon: "coffee",
      },
    ],
    transition: "push",
  },
  {
    type: "summary",
    title: "Flott — vi er klare!",
    body: "Basert på svarene dine bygger vi nå en tilpasset håndbok for {{companyName}}. Dette tar bare noen minutter.",
    actions: [
      { label: "Bygg håndboken", key: "build", variant: "primary" },
      { label: "Gå tilbake", key: "back", variant: "secondary" },
    ],
    transition: "morph",
  },
];

// TODO: Replace with real workspace/profile context
const WORKSPACE_ID = null;
const ACTOR_ID = "anonymous";

function emitFlowEvent(event: FlowEvent) {
  switch (event.type) {
    case "flow:started":
      void emit({
        event: "flow started",
        workspace_id: WORKSPACE_ID,
        actor_id: ACTOR_ID,
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
        workspace_id: WORKSPACE_ID,
        actor_id: ACTOR_ID,
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
        workspace_id: WORKSPACE_ID,
        actor_id: ACTOR_ID,
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
        workspace_id: WORKSPACE_ID,
        actor_id: ACTOR_ID,
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
        workspace_id: WORKSPACE_ID,
        actor_id: ACTOR_ID,
        properties: {
          data: {
            flow_id: FLOW_ID,
            total_slides: demoSlides.length,
            duration_ms: (event.data?.totalDurationMs as number) ?? 0,
            action: (event.data?.action as string) ?? undefined,
            answers: (event.data?.answers as Record<string, string | string[]>) ?? {},
          },
        },
      });
      break;
  }
}

export default function FlowPage() {
  function handleComplete(result: FlowResult) {
    const timeSeconds = Math.round(result.durationMs / 1000);
    alert(
      `Flow ferdig! (${timeSeconds}s)\n\nAction: ${result.action}\nSvar: ${JSON.stringify(result.answers, null, 2)}`,
    );
  }

  function handleSkip() {
    // Flow was skipped by the user
  }

  return (
    <FlowPlayer
      slides={demoSlides}
      flowId={FLOW_ID}
      context={{ companyName: "Brasserie Blå" }}
      onComplete={handleComplete}
      onSkip={handleSkip}
      onEvent={emitFlowEvent}
      defaultTransition="fade"
      renderIcon={(name) => ICON_MAP[name] ?? null}
    />
  );
}
