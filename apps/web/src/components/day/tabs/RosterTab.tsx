export function RosterTab({ departmentId, dateISO }: { departmentId: string; dateISO: string }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-6">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">Bemanning</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        Roster-tabell med planlagt/faktisk-kolonner aktiveres i{" "}
        <code className="text-foreground font-mono">PR 3</code> via ny{" "}
        <code className="text-foreground font-mono">useRoster</code>-selector som joiner{" "}
        <code className="text-foreground font-mono">schedule_shift</code> mot{" "}
        <code className="text-foreground font-mono">timesheet.time_entry</code>.
      </p>
      <p className="text-muted-foreground mt-4 font-mono text-[11px]">
        department={departmentId} · date={dateISO}
      </p>
    </div>
  );
}
