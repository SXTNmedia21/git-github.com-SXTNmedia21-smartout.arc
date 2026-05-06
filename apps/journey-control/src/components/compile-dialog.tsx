// apps/journey-control/src/components/compile-dialog.tsx
"use client";

import { useEffect, useState } from "react";

type Props = {
  draftSlug: string;
  onClose: () => void;
  onCompiled: (newSlug: string) => void;
};

function nextPSlug(compiledSlugs: string[]): string {
  const max = compiledSlugs
    .map((s) => /^P-(\d+)$/.exec(s)?.[1])
    .filter((m): m is string => Boolean(m))
    .map((n) => parseInt(n, 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `P-${String(max + 1).padStart(3, "0")}`;
}

export function CompileDialog({ draftSlug, onClose, onCompiled }: Props) {
  const [desiredSlug, setDesiredSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest next free P-NNN slug on mount.
  useEffect(() => {
    fetch("/api/journeys")
      .then((r) => r.json())
      .then((d: { compiled: Array<{ slug: string }> }) => {
        setDesiredSlug(nextPSlug(d.compiled.map((c) => c.slug)));
      })
      .catch(() => setDesiredSlug("P-002"));
  }, []);

  async function handleCompile() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/journeys/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_slug: draftSlug, desired_slug: desiredSlug || undefined }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) onCompiled(j.slug);
    else setError(j.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border-border w-full max-w-md rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-xl">Compile draft</h3>
        <p className="text-muted-foreground mt-1 font-mono text-xs">JOURNEY-{draftSlug}.md</p>

        <label className="mt-6 block">
          <span className="text-sm">Desired slug (e.g. P-002)</span>
          <input
            value={desiredSlug}
            onChange={(e) => setDesiredSlug(e.target.value)}
            pattern="[A-Za-z0-9-]+"
            className="border-border bg-background mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
        </label>

        {error && <p className="text-destructive mt-3 text-xs">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCompile}
            disabled={busy || !desiredSlug}
            className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Compiling…" : "Compile via Claude"}
          </button>
        </div>
      </div>
    </div>
  );
}
