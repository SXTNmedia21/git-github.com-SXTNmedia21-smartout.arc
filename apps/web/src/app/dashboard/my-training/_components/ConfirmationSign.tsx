"use client";

/**
 * Confirmation signature collection component.
 * Displays confirmation text and collects digital signatures.
 * Connected to: use-step-completion.ts (useSignConfirmation), ProtocolList
 *
 * UI Events:
 * - action: signConfirmation (submits signature)
 * - color-regime: emerald (signed), zinc (pending)
 */

import { useState } from "react";
import { CheckCircle2, PenTool, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { AssignedConfirmation } from "../_hooks/use-assigned-protocols";
import { useSignConfirmation } from "../_hooks/use-step-completion";

type ConfirmationSignProps = {
  confirmations: AssignedConfirmation[];
  assignmentId: string;
  isDark: boolean;
};

export function ConfirmationSign({ confirmations, assignmentId, isDark }: ConfirmationSignProps) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const signConfirmation = useSignConfirmation();

  if (confirmations.length === 0) {
    return (
      <p className={`py-4 text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Ingen bekreftelser i denne protokollen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {confirmations.map((conf) => {
        const isAcknowledged = acknowledged.has(conf.confirmationId);

        return (
          <div
            key={conf.confirmationId}
            className={`rounded-lg border p-4 ${
              conf.isSigned
                ? isDark
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-emerald-200 bg-emerald-50"
                : isDark
                  ? "border-zinc-800 bg-zinc-900/30"
                  : "border-zinc-100 bg-zinc-50"
            }`}
          >
            {/* Header */}
            <div className="mb-3 flex items-center gap-2">
              {conf.isSigned ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <PenTool className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              )}
              <h4
                className={`text-sm font-bold ${
                  conf.isSigned ? "text-emerald-500" : isDark ? "text-zinc-200" : "text-zinc-800"
                }`}
              >
                {conf.name}
              </h4>
              {conf.isSigned && conf.signedAt && (
                <span
                  className={`ml-auto text-[10px] font-medium ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  Signert {new Date(conf.signedAt).toLocaleDateString("nb-NO")}
                </span>
              )}
            </div>

            {/* Confirmation text */}
            <div
              className={`mb-4 rounded-lg border p-3 text-sm leading-relaxed ${
                isDark
                  ? "border-zinc-800 bg-zinc-950 text-zinc-300"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {conf.confirmationText}
            </div>

            {/* Signature area */}
            {!conf.isSigned && (
              <div className="space-y-3">
                {/* Acknowledge checkbox */}
                <label className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    checked={isAcknowledged}
                    onCheckedChange={(checked) => {
                      const next = new Set(acknowledged);
                      if (checked) {
                        next.add(conf.confirmationId);
                      } else {
                        next.delete(conf.confirmationId);
                      }
                      setAcknowledged(next);
                    }}
                    className="mt-0.5"
                  />
                  <span
                    className={`text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                  >
                    Jeg bekrefter at jeg har lest og forstatt innholdet ovenfor.
                  </span>
                </label>

                {/* Sign button */}
                <button
                  onClick={() =>
                    signConfirmation.mutate({
                      confirmationId: conf.confirmationId,
                      protocolAssignmentId: assignmentId,
                      signatureData: {
                        type: "checkbox_acknowledgment",
                        timestamp: new Date().toISOString(),
                      },
                    })
                  }
                  disabled={!isAcknowledged || signConfirmation.isPending}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                    isDark
                      ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                      : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                  }`}
                >
                  {signConfirmation.isPending ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Signer bekreftelse"
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
