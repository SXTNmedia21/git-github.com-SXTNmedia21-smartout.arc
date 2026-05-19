"use client";

import { useTranslation } from "@smartout/i18n";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useWelcomeTools } from "./tools/welcome-tools";

const VALUE_PROPS = [
  { key: "governance", icon: "📋" },
  { key: "schedule", icon: "📅" },
  { key: "operations", icon: "🔄" },
] as const;

export function WelcomeStep() {
  const tools = useWelcomeTools();
  useRegisterTools("wizard-setup-welcome", tools);
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-10">
      {/* Value props */}
      <div className="grid gap-4">
        {VALUE_PROPS.map((item) => (
          <div
            key={item.key}
            className="border-border bg-card/50 flex items-start gap-4 rounded-xl border px-5 py-4"
          >
            <span className="mt-0.5 text-xl">{item.icon}</span>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {t(`setup.value_props.${item.key}.title`)}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(`setup.value_props.${item.key}.text`)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
