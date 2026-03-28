"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  _error,
  reset,
}: {
  _error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="no">
      <body className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">Noe gikk galt</h2>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Prøv igjen
          </button>
        </div>
      </body>
    </html>
  );
}
