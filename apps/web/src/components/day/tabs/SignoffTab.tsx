import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";

export function SignoffTab({ session, phase }: { session: DepartmentSessionRow; phase: UiPhase }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-6">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">Oppgjør</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        SignoffPanel + ReconSummary aktiveres i{" "}
        <code className="text-foreground font-mono">PR 3</code>. Signoff skrives via{" "}
        <code className="text-foreground font-mono">signoffSessionAction</code> Server Action
        (fikser step-1 emit-gap i eksisterende <code className="font-mono">useSignoffSession</code>
        ).
      </p>
      <p className="text-muted-foreground mt-4 font-mono text-[11px]">
        session={session.sessionId} · phase={phase}
      </p>
    </div>
  );
}
