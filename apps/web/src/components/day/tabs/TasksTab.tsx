import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";

export function TasksTab({ session }: { session: DepartmentSessionRow }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-6">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">Oppgaver</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        HookTile-liste gruppert per session_hook aktiveres i{" "}
        <code className="text-foreground font-mono">PR 3</code>. Task-toggle via{" "}
        <code className="text-foreground font-mono">toggleSessionTaskAction</code> (Server Action
        per ADR-0114 / ADR-0157).
      </p>
      <p className="text-muted-foreground mt-4 font-mono text-[11px]">
        session={session.sessionId} · tasks={session.tasksCompleted}/{session.tasksTotal}
      </p>
    </div>
  );
}
