"use client";

export type SaveState = "saved" | "saving" | "dirty";

type Props = {
  state: SaveState;
};

/**
 * Pill indicator showing the current save state of the section editor.
 * Used in the SectionEditor top bar to give users clear feedback on unsaved changes.
 */
export default function SaveStatus({ state }: Props) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
      {state === "saved" && (
        <>
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Lagret</span>
        </>
      )}
      {state === "saving" && (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">Lagrer...</span>
        </>
      )}
      {state === "dirty" && (
        <>
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <span className="text-muted-foreground">Ulagrede endringer</span>
        </>
      )}
    </div>
  );
}
