"use client";

import { useState } from "react";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLeaderPulse } from "@/app/dashboard/_hooks/useLeaderPulse";

/**
 * Shows pending leader pulse questions on the dashboard.
 * Leaders can answer inline or dismiss.
 * Connected to: useLeaderPulse hook, AdminDashboard/TacticalView
 */
export function LeaderPulseCard() {
  const { pulses, isLoading, answer, dismiss, isAnswering, isDismissing } = useLeaderPulse();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  if (isLoading || pulses.length === 0) return null;

  const activePulse = pulses[0]!;
  const isExpanded = activeId === activePulse.id;

  function handleSubmit() {
    if (!answerText.trim()) return;
    answer(
      { pulseId: activePulse.id, answer: answerText.trim() },
      {
        onSuccess: () => {
          setAnswerText("");
          setActiveId(null);
        },
      },
    );
  }

  function handleDismiss() {
    dismiss({ pulseId: activePulse.id });
    setActiveId(null);
    setAnswerText("");
  }

  return (
    <Card className="border-primary/20 bg-primary/5 relative overflow-hidden">
      <div className="bg-primary/10 absolute -top-6 -right-6 h-20 w-20 rounded-full blur-2xl" />
      <CardContent className="relative z-10 p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary rounded-lg p-1.5">
              <MessageCircleQuestion className="h-4 w-4" />
            </div>
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Pulse
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-6 w-6"
            onClick={handleDismiss}
            disabled={isDismissing}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <p className="text-foreground mb-3 text-sm leading-relaxed font-medium">
          {activePulse.question}
        </p>

        {isExpanded ? (
          <div className="space-y-2">
            <Textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Skriv ditt svar..."
              className="min-h-[60px] resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!answerText.trim() || isAnswering}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isAnswering ? "Sender..." : "Svar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActiveId(null);
                  setAnswerText("");
                }}
              >
                Avbryt
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveId(activePulse.id)}
            className="text-xs"
          >
            Svar
          </Button>
        )}

        {pulses.length > 1 && (
          <p className="text-muted-foreground mt-2 text-xs">+{pulses.length - 1} til</p>
        )}
      </CardContent>
    </Card>
  );
}
