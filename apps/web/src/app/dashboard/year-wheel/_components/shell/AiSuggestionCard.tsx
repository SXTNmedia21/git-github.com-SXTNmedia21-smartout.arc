import { Sparkles } from "lucide-react";

// Empty-state scaffold per L-0046 theatre rule. When a real AI suggestion
// engine lands, a separate ADR introduces the event, the buttons, and
// the handler together. Until then: no buttons, no emit, no registered event.
export function AiSuggestionCard() {
  return (
    <div
      className="border-muted/50 bg-muted/20 flex items-start gap-3 rounded-xl border border-dashed px-4 py-3.5"
      aria-label="AI-forslag kommer snart"
    >
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <Sparkles className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-muted-foreground text-sm font-medium">Ingen AI-forslag ennå</div>
        <div className="text-muted-foreground/80 text-xs">
          Kommer når forslagsmotoren er koblet på.
        </div>
      </div>
    </div>
  );
}
