"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  id: string;
  children: ReactNode;
};

export default function SortableSectionItem({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1">
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab p-1 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Dra for å sortere"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}
