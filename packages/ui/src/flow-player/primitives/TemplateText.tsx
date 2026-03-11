import { cn } from "../../lib/utils";

interface TemplateTextProps {
  template: string;
  context: Record<string, string>;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  style?: React.CSSProperties;
}

function resolveTemplate(
  template: string,
  context: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => context[key] ?? "",
  );
}

export function TemplateText({
  template,
  context,
  as: Tag = "span",
  className,
  style,
}: TemplateTextProps) {
  return (
    <Tag className={cn(className)} style={style}>
      {resolveTemplate(template, context)}
    </Tag>
  );
}
