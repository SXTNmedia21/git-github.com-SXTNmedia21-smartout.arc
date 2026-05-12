"use client";

/**
 * LocalSignForm — dev-only signing stub.
 *
 * What: Renders contract HTML and two role-buttons that POST to
 *       /api/contracts/[id]/local-sign to flip DB state without DocuSeal.
 *
 * Why: DocuSeal webhooks cannot reach localhost, so the sign flow gets
 *      stuck on "venter på din signatur" in local dev. This form lets
 *      developers test the full employer + employee signing cycle locally.
 *
 * Security: Only rendered when CONTRACT_LOCAL_SIGN_MODE="true" (gated in
 *           page.tsx). The API route has its own env gate (403 if disabled).
 *           NEVER shown in production.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  contractId: string;
  contractTitle: string;
  signingToken: string;
  recipientEmail: string;
  recipientName: string;
  resolvedHtml: string;
};

type SignRole = "employer" | "employee";

export function LocalSignForm({
  contractId,
  contractTitle,
  signingToken,
  recipientEmail,
  recipientName,
  resolvedHtml,
}: Props) {
  const [loading, setLoading] = useState<SignRole | null>(null);

  async function handleSign(role: SignRole) {
    setLoading(role);
    try {
      const res = await fetch(`/api/contracts/${contractId}/local-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, token: signingToken }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        all_signed?: boolean;
        error?: string;
      };

      if (!res.ok) {
        toast.error(json.error ?? "Noe gikk galt");
        return;
      }

      if (json.all_signed) {
        toast.success("Begge parter har signert — avtalen er fullfort.");
        window.location.href = `/sign/success?token=${signingToken}`;
      } else {
        toast.success(
          role === "employer"
            ? "Arbeidsgiver signert. Arbeidstaker kan na signere."
            : "Signering registrert.",
        );
      }
    } catch {
      toast.error("Nettverksfeil — prøv igjen");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-background min-h-screen py-10">
      {/* Dev-mode warning banner */}
      <div className="mx-auto mb-6 max-w-3xl rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Lokal-test-modus — ekte DocuSeal-signering bypassed. Kun synlig i utviklingsmiljo.
      </div>

      <Card className="mx-auto mb-8 max-w-3xl">
        <CardHeader>
          <CardTitle className="font-heading text-foreground text-xl">{contractTitle}</CardTitle>
          {recipientName && (
            <p className="text-muted-foreground text-sm">
              {recipientName} &lt;{recipientEmail}&gt;
            </p>
          )}
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant="outline"
            disabled={loading !== null}
            onClick={() => void handleSign("employer")}
          >
            {loading === "employer" ? "Signerer..." : "Signer som arbeidsgiver"}
          </Button>
          <Button disabled={loading !== null} onClick={() => void handleSign("employee")}>
            {loading === "employee" ? "Signerer..." : "Signer som arbeidstaker"}
          </Button>
        </CardContent>
      </Card>

      {/* Contract HTML preview — A4-canvas styling matching ContractPreviewEditor */}
      <div className="mx-auto max-w-3xl bg-white px-12 py-10">
        {resolvedHtml ? (
          <div
            className="text-foreground text-sm leading-relaxed"
            // Contract HTML is server-resolved template content, not user input.
            dangerouslySetInnerHTML={{ __html: resolvedHtml }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">Ingen forhåndsvisning tilgjengelig.</p>
        )}
      </div>
    </div>
  );
}
