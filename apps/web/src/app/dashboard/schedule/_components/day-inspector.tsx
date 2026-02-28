"use client";

import type { ReactNode } from "react";

type DayInspectorProps = {
  isDark: boolean;
  selectedDate: string | null;
  children: ReactNode;
};

export function DayInspector({ isDark, selectedDate, children }: DayInspectorProps) {
  return (
    <aside
      className={`absolute top-0 right-0 h-full border-l border-white/5 ${isDark ? "bg-[#0a0a0c]/95" : "bg-white/95"} z-40 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl transition-all duration-300 ease-in-out ${selectedDate ? "w-96 translate-x-0 xl:w-[500px]" : "pointer-events-none w-96 translate-x-full opacity-0 xl:w-[500px]"}`}
    >
      {children}
    </aside>
  );
}
