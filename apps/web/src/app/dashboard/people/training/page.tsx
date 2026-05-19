import { Construction } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TrainingPage() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Trening
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Workforce readiness per ansatt</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="bg-card border-border flex h-full flex-col items-center justify-center rounded-2xl border p-12 shadow-sm">
          <Construction className="text-muted-foreground mb-4 h-12 w-12" aria-hidden />
          <h2 className="text-foreground text-lg font-semibold">Kommer snart</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
            Trenings-matrise viser hvem som har gjennomført hvilke protokoller, hvem som er forfalt,
            og workforce readiness per avdeling. Samme data som /hms/training men fra
            ansatt-perspektiv. Bygges i SM-2-followup-training.
          </p>
        </div>
      </div>
    </div>
  );
}
