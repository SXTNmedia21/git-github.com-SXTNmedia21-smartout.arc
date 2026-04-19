export function BroadcastTab() {
  return (
    <div className="bg-card border-border rounded-[14px] border p-6">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">Melding</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        BroadcastComposer + feed fra komm &ldquo;news&rdquo;-kanal aktiveres i{" "}
        <code className="text-foreground font-mono">PR 3</code> via ny{" "}
        <code className="text-foreground font-mono">sendBroadcastAction</code> Server Action med
        PII-guardrail per ADR-0077.
      </p>
    </div>
  );
}
