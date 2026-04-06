"use client";

export default function DocsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold">Kunne ikke laste dokumentet</h2>
      <p className="text-muted-foreground max-w-md">
        Noe gikk galt ved lasting av denne siden. Prøv å laste på nytt.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-semibold"
      >
        Prøv igjen
      </button>
    </div>
  );
}
