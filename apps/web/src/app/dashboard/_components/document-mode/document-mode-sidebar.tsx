"use client";

import { CHAPTERS } from "./chapters";
import { useDocumentMode } from "./document-mode-context";

export function DocumentModeSidebar({ isDark }: { isDark: boolean }) {
  const { activeChapterKey, setActiveChapterKey, isDirty } = useDocumentMode();

  const handleClick = (key: typeof activeChapterKey) => {
    if (isDirty) {
      const ok = window.confirm("Du har ulagrede endringer. Vil du fortsette uten å lagre?");
      if (!ok) return;
    }
    setActiveChapterKey(key);
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      <div
        className={`mb-3 px-2 text-[10px] font-bold tracking-widest uppercase ${
          isDark ? "text-muted-foreground" : "text-[var(--text-dim)]"
        }`}
      >
        Handbok
      </div>
      {CHAPTERS.map((ch) => {
        const isActive = ch.key === activeChapterKey;
        const Icon = ch.icon;
        return (
          <button
            key={ch.key}
            onClick={() => handleClick(ch.key)}
            className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
              isActive
                ? isDark
                  ? "bg-orange-500/10 text-orange-300"
                  : "bg-orange-50 text-orange-700"
                : isDark
                  ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  : "text-[var(--text-dim)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                isActive
                  ? isDark
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-orange-100 text-orange-600"
                  : isDark
                    ? "bg-muted text-muted-foreground"
                    : "bg-[var(--surface-overlay)] text-[var(--text-dim)]"
              }`}
            >
              {ch.number}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Icon
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    isActive
                      ? isDark
                        ? "text-orange-400"
                        : "text-orange-500"
                      : isDark
                        ? "text-muted-foreground"
                        : "text-[var(--text-dim)]"
                  }`}
                />
                <span className="truncate font-medium">{ch.title}</span>
              </div>
              <p
                className={`mt-0.5 truncate text-[11px] ${
                  isActive
                    ? isDark
                      ? "text-orange-400/60"
                      : "text-orange-600/60"
                    : isDark
                      ? "text-muted-foreground/60"
                      : "text-[var(--text-dim)]"
                }`}
              >
                {ch.description}
              </p>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
