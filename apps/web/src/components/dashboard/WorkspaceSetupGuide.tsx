"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Rocket } from "lucide-react";
import { useWorkspaceSetup } from "@/app/dashboard/_hooks/use-workspace-setup";
import type { SetupModule } from "@/app/dashboard/_hooks/use-workspace-setup";

function ModuleRow({
  module,
  isDark,
  onClick,
  stepNumber,
}: {
  module: SetupModule;
  isDark: boolean;
  onClick: () => void;
  stepNumber: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={module.isComplete}
      className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
        module.isComplete
          ? isDark
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-emerald-200 bg-emerald-50/50"
          : isDark
            ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          module.isComplete
            ? "bg-emerald-500/10 text-emerald-500"
            : isDark
              ? "bg-orange-500/10 text-orange-500"
              : "bg-orange-50 text-orange-500"
        }`}
      >
        {module.isComplete ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <span className="text-sm font-black">{stepNumber}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={`text-sm font-bold ${
            module.isComplete
              ? isDark
                ? "text-emerald-400"
                : "text-emerald-700"
              : isDark
                ? "text-zinc-100"
                : "text-zinc-900"
          }`}
        >
          {module.label}
        </h3>
        <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
          {module.description}
        </p>
      </div>

      {!module.isComplete && (
        <ChevronRight
          className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${
            isDark ? "text-zinc-600" : "text-zinc-400"
          }`}
        />
      )}
    </button>
  );
}

export function WorkspaceSetupGuide({ isDark }: { isDark: boolean }) {
  const router = useRouter();
  const { data } = useWorkspaceSetup();

  if (!data) return null;

  const completedCount = data.modules.filter((m) => m.isComplete).length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
              isDark ? "bg-orange-500/10" : "bg-orange-50"
            }`}
          >
            <Rocket className="h-7 w-7 text-orange-500" />
          </div>
          <h1
            className={`text-2xl font-black tracking-tight ${
              isDark ? "text-white" : "text-zinc-900"
            }`}
          >
            Sett opp arbeidsrommet
          </h1>
          <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Fullfør disse stegene for å ta i bruk SmartOut.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div
            className={`h-1.5 flex-1 overflow-hidden rounded-full ${
              isDark ? "bg-zinc-800" : "bg-zinc-200"
            }`}
          >
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500"
              style={{
                width: `${data.modules.length > 0 ? (completedCount / data.modules.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {completedCount}/{data.modules.length}
          </span>
        </div>

        {/* Module list */}
        <div className="space-y-3">
          {data.modules.map((module, index) => (
            <ModuleRow
              key={module.id}
              module={module}
              isDark={isDark}
              onClick={() => router.push(module.href)}
              stepNumber={index + 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
