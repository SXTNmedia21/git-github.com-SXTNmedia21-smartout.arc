"use client";

import { MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type NewsCardMenuProps = {
  isPinned: boolean;
  onTogglePin: () => void;
  onDelete?: () => void;
  disabled?: boolean;
};

export function NewsCardMenu({ isPinned, onTogglePin, onDelete, disabled }: NewsCardMenuProps) {
  const { t } = useTranslation("komm");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground absolute top-3 right-3 h-8 w-8 rounded-md p-0"
          aria-label={t("nyheter.card_menu_label")}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem onSelect={onTogglePin} disabled={disabled}>
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              {t("nyheter.unpin")}
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              {t("nyheter.pin")}
            </>
          )}
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("nyheter.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
