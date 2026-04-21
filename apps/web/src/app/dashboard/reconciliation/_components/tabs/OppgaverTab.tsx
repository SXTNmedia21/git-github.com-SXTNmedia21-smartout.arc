"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Camera, Loader2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";

type Props = {
  departmentSessionId: string | null;
};

type SessionTaskRow = {
  session_task_id: string;
  title: string;
  completed_at: string | null;
  requires_evidence: boolean;
  evidence_count: number | null;
  hook: {
    hook_type: string;
    scheduled_at: string | null;
  } | null;
};

const HOOK_LABELS: Record<string, string> = {
  pre_open: "Pre-open",
  open: "Åpning",
  scheduled: "Rutine",
  pre_close: "Pre-close",
  close: "Stenging",
};

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function OppgaverTab({ departmentSessionId }: Props) {
  const supabase = createClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reconciliation-session-tasks", departmentSessionId],
    enabled: !!departmentSessionId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<SessionTaskRow[]> => {
      if (!departmentSessionId) return [];
      const { data, error } = await supabase
        .from("session_task")
        .select(
          "session_task_id, title, completed_at, requires_evidence, hook:session_hook_id(hook_type, scheduled_at)",
        )
        .eq("department_session_id", departmentSessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as SessionTaskRow[]).map((t) => ({
        ...t,
        evidence_count: null,
      }));
    },
  });

  if (!departmentSessionId) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Ingen session tilknyttet oppgjøret.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">Kunne ikke laste oppgaver.</p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Ingen oppgaver registrert for denne dagen.
      </p>
    );
  }

  const completed = data.filter((t) => t.completed_at !== null).length;
  const total = data.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Progress summary */}
      <section className="border-border bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
              Progresjon
            </p>
            <p className="text-foreground font-mono text-2xl font-black tabular-nums">
              {completed} / {total}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
              Fullført
            </p>
            <p className="font-mono text-2xl font-black text-[color:var(--success)] tabular-nums">
              {pct}%
            </p>
          </div>
        </div>
        <div className="bg-muted mt-3 h-1 overflow-hidden rounded-full">
          <div
            className="h-full bg-[color:var(--success)] transition-all duration-500"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </section>

      {/* Task list */}
      <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
        {data.map((t) => {
          const isDone = t.completed_at !== null;
          const hookLabel =
            t.hook?.hook_type && HOOK_LABELS[t.hook.hook_type]
              ? HOOK_LABELS[t.hook.hook_type]
              : "Oppgave";

          return (
            <li key={t.session_task_id} className="flex items-start gap-3 px-5 py-3">
              {isDone ? (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--success)]"
                  aria-hidden
                />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={
                    isDone
                      ? "text-muted-foreground text-sm line-through"
                      : "text-foreground text-sm font-medium"
                  }
                >
                  {t.title}
                </p>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  <span className="font-semibold tracking-[0.08em] uppercase">{hookLabel}</span>
                  {t.hook?.scheduled_at && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-mono tabular-nums">
                        {formatClock(t.hook.scheduled_at)}
                      </span>
                    </>
                  )}
                  {t.requires_evidence && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Camera className="h-3 w-3" aria-hidden />
                        Bevis påkrevd
                      </span>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
