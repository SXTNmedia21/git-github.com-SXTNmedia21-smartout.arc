"use client";

import { Sparkles } from "lucide-react";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useWelcomeTools } from "./tools/welcome-tools";

const VALUE_PROPS = [
  {
    icon: "\ud83d\udccb",
    title: "Retningslinjer",
    text: "Reglene dine, automatisk til opplæring",
  },
  {
    icon: "\ud83d\udcc5",
    title: "Vaktplan",
    text: "Riktig person, riktig tid, riktig rolle",
  },
  {
    icon: "\ud83d\udd04",
    title: "Drift",
    text: "Dagen styrer seg selv, fra \u00e5pning til stenging",
  },
];

export function WelcomeStep() {
  const tools = useWelcomeTools();
  useRegisterTools("wizard-setup-welcome", tools);

  return (
    <div className="space-y-10">
      {/* Intro */}
      <div className="border-border bg-card flex items-start gap-4 rounded-2xl border p-6">
        <Sparkles className="text-brand-orange mt-1 h-6 w-6 shrink-0" />
        <p className="text-muted-foreground text-base leading-relaxed">
          Smartout er din digitale kollega. Vi s\u00f8rger for at alle ansatte er klare &mdash;
          trent, compliant, og informert.
        </p>
      </div>

      {/* Value props */}
      <div className="grid gap-4">
        {VALUE_PROPS.map((item) => (
          <div
            key={item.title}
            className="border-border bg-card/50 flex items-start gap-4 rounded-xl border px-5 py-4"
          >
            <span className="mt-0.5 text-xl">{item.icon}</span>
            <div>
              <p className="text-foreground text-sm font-semibold">{item.title}</p>
              <p className="text-muted-foreground text-sm">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
