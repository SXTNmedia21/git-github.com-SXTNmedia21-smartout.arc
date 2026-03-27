"use client";

// Template selector bar for mal modus — shows available templates as chips,
// active template stats (slots, hours, cost per day), and a "Ny mal" action.

type Template = {
  id: string;
  name: string;
};

type MalTemplateBarProps = {
  templates: Template[];
  activeTemplateId: string | null;
  onTemplateChange: (id: string) => void;
  onCreateTemplate?: () => void;
  stats: {
    slotsPerDay: number;
    hoursPerDay: number;
    costPerDay: number;
  };
};

export function MalTemplateBar({
  templates,
  activeTemplateId,
  onTemplateChange,
  onCreateTemplate,
  stats,
}: MalTemplateBarProps) {
  return (
    <div className="border-border bg-card relative z-[1] flex items-center gap-2.5 border-b px-4 py-[5px] text-xs">
      {/* Left side: label + template chips + create button */}
      <span className="text-muted-foreground text-[11px] font-medium whitespace-nowrap">
        Aktiv mal:
      </span>

      {templates.map((template) => {
        const isActive = template.id === activeTemplateId;
        return (
          <button
            key={template.id}
            onClick={() => onTemplateChange(template.id)}
            className={
              isActive
                ? "cursor-pointer rounded-lg border border-[oklch(0.65_0.22_40/0.25)] bg-[oklch(0.65_0.22_40/0.1)] px-3 py-1 text-[11px] font-bold text-orange-500 transition-all"
                : "border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border px-3 py-1 text-[11px] font-bold transition-all"
            }
          >
            {template.name}
          </button>
        );
      })}

      {/* Create new template */}
      <button
        onClick={onCreateTemplate}
        className="border-border text-muted-foreground/60 cursor-pointer rounded-lg border border-dashed px-3 py-1 text-[11px] font-bold transition-all hover:border-orange-500 hover:text-orange-500"
      >
        + Ny mal
      </button>

      {/* Right side: stats summary */}
      <div className="text-muted-foreground ml-auto flex gap-3 text-[11px]">
        <span>
          Plasser/dag:{" "}
          <strong className="text-foreground font-mono font-bold">{stats.slotsPerDay}</strong>
        </span>
        <span>
          Timer/dag:{" "}
          <strong className="text-foreground font-mono font-bold">{stats.hoursPerDay}t</strong>
        </span>
        <span>
          Kostnad/dag:{" "}
          <strong className="text-foreground font-mono font-bold">
            kr {stats.costPerDay.toLocaleString("nb-NO")}
          </strong>
        </span>
      </div>
    </div>
  );
}
