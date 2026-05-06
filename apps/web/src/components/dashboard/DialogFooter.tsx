import type { ReactNode } from "react";

interface DialogFooterProps {
  leftContent?: ReactNode;
  rightContent?: ReactNode;
}

export function DialogFooter({ leftContent, rightContent }: DialogFooterProps) {
  return (
    <div className="flex items-center justify-between px-7 pt-3 pb-6">
      <div>{leftContent}</div>
      <div className="flex gap-3">{rightContent}</div>
    </div>
  );
}
