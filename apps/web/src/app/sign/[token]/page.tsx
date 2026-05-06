import { notFound } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { env } from "@/env";
import { SigningForm } from "./signing-form";
import { LocalSignForm } from "./local-sign-form";

type Props = { params: Promise<{ token: string }> };

export default async function SignPage({ params }: Props) {
  const { token } = await params;

  // Use admin client: signers may not be authenticated Smartout users.
  // The signing_url token acts as a capability URL (bearer token in URL).
  const admin = createAdminClient();

  // Look up contract by signing URL token
  const { data: contract } = await admin
    .from("contract")
    .select(
      "contract_id, title, signing_url, docuseal_embed_url, recipient_email, recipient_name, resolved_html, status, sender_name",
    )
    .eq("signing_url", token)
    .single();

  if (!contract || !contract.signing_url) notFound();
  // In local-sign-mode, docuseal_embed_url is intentionally absent — skip that check.
  if (env.CONTRACT_LOCAL_SIGN_MODE !== "true" && !contract.docuseal_embed_url) notFound();

  // Already signed or expired
  if (["signed", "expired", "cancelled", "declined"].includes(contract.status)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-foreground text-2xl font-bold">
            {contract.status === "signed"
              ? "Avtalen er signert"
              : "Avtalen er ikke lenger tilgjengelig"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {contract.status === "signed"
              ? "Du har allerede signert denne avtalen. Sjekk e-posten din for en kopi."
              : "Kontakt oss hvis du har sporsmal."}
          </p>
        </div>
      </div>
    );
  }

  if (env.CONTRACT_LOCAL_SIGN_MODE === "true") {
    return (
      <LocalSignForm
        contractId={contract.contract_id}
        contractTitle={contract.title ?? "Avtale"}
        signingToken={token}
        recipientEmail={contract.recipient_email ?? ""}
        recipientName={contract.recipient_name ?? ""}
        resolvedHtml={contract.resolved_html ?? ""}
      />
    );
  }

  return (
    <SigningForm
      docusealEmbedUrl={contract.docuseal_embed_url ?? ""}
      recipientEmail={contract.recipient_email ?? ""}
      contractTitle={contract.title ?? "Avtale"}
      signingToken={token}
    />
  );
}
