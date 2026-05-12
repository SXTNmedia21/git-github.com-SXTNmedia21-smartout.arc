"use client";

import { Pin, PinOff } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import type { MessageWithSender } from "../_hooks/channel-types";

type PinnedStripProps = {
  messages: MessageWithSender[];
  canManage: boolean;
  onUnpin: (messageId: string) => void;
  onJumpTo: (messageId: string) => void;
};

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

export function PinnedStrip({ messages, canManage, onUnpin, onJumpTo }: PinnedStripProps) {
  const { t } = useTranslation("komm");
  const reduce = useReducedMotion();

  if (messages.length === 0) return null;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="pinned-strip"
        initial={reduce ? false : { opacity: 0, y: -10, maxHeight: 0 }}
        animate={{ opacity: 1, y: 0, maxHeight: 200 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, maxHeight: 0 }}
        transition={reduce ? { duration: 0 } : { ...SPRING, maxHeight: { duration: 0.4 } }}
        className="bg-card/85 border-border sticky top-0 z-30 -mx-8 mb-6 border-b px-8 pt-3.5 pb-4 backdrop-blur-xl"
      >
        <div className="mb-2.5 flex items-baseline gap-2.5">
          <Pin className="h-4 w-4" style={{ color: "var(--color-pin)" }} aria-hidden="true" />
          <h2 className="font-heading text-xl tracking-tight">
            {t("nyheter.pinned_strip_header")}
          </h2>
          <span className="text-muted-foreground font-mono text-xs">{messages.length}</span>
        </div>
        <div
          className="flex gap-2.5 overflow-x-auto pb-1"
          style={{ scrollSnapType: "x proximity" }}
        >
          {messages.map((msg) => {
            const title = msg.content.split("\n")[0] ?? "";
            return (
              <motion.div
                key={msg.message_id}
                whileHover={reduce ? undefined : { y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="border-border bg-card relative flex h-[84px] w-[200px] shrink-0 flex-col gap-1 overflow-hidden rounded-xl border border-l-2 p-2.5 text-left hover:shadow-md"
                style={{
                  scrollSnapAlign: "start",
                  borderLeftColor: "var(--color-pin)",
                  transitionProperty: "box-shadow",
                  transitionDuration: "200ms",
                }}
              >
                <button
                  type="button"
                  onClick={() => onJumpTo(msg.message_id)}
                  className="flex flex-1 flex-col gap-1 text-left"
                  aria-label={`${t("nyheter.pinned_label")}: ${title}`}
                >
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    {msg.sender_name}
                  </span>
                  <span className="line-clamp-2 text-sm leading-snug font-semibold text-ellipsis">
                    {title}
                  </span>
                </button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground absolute right-1.5 bottom-1.5 h-6 px-1.5 text-[11px]"
                    onClick={() => onUnpin(msg.message_id)}
                  >
                    <PinOff className="mr-1 h-3 w-3" aria-hidden="true" />
                    {t("nyheter.unpin")}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
