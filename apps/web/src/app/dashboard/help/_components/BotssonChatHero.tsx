"use client";

import { Suspense } from "react";
import { BotssonChat } from "@/app/Botsson/_components/BotssonChat";
import { BotssonProvider } from "@/app/Botsson/_components/BotssonProvider";

type Props = { firstName: string; workspaceId: string };

export function BotssonChatHero({ firstName, workspaceId }: Props) {
  return (
    <section
      aria-label="Spør Botsson om hjelp"
      className="bg-card border-border max-h-[480px] overflow-hidden rounded-2xl border p-6 shadow-sm"
    >
      <h1 className="font-heading text-foreground text-3xl">
        Hei {firstName} — hva trenger du hjelp med?
      </h1>
      <p className="text-muted-foreground mt-2 text-base">
        Skriv et spørsmål, eller bruk{" "}
        <kbd className="bg-muted text-foreground border-border rounded border px-1.5 py-0.5 text-xs">
          ⌘K
        </kbd>{" "}
        for å søke i håndboken.
      </p>

      {/* BotssonChat consumes useBotsson() for sessionId state. Dashboard chrome's
          EmmaOverlay provider is a sibling subtree, not an ancestor, so the chat
          surface needs its own provider scoped to the hero. */}
      <Suspense>
        <BotssonProvider workspaceId={workspaceId}>
          <div className="mt-4 max-h-[360px] overflow-auto">
            <BotssonChat workspaceId={workspaceId} />
          </div>
        </BotssonProvider>
      </Suspense>
    </section>
  );
}
