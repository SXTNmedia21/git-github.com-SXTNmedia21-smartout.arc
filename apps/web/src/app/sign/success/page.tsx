import { CheckCircle } from "lucide-react";
import { createAdminClient } from "@smartout/supabase/admin";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function SignSuccessPage({ searchParams }: Props) {
  const { token } = await searchParams;
  let contract: {
    title: string | null;
    sender_name: string | null;
    recipient_name: string | null;
    contract_type: string | null;
  } | null = null;

  if (token) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("contract")
      .select("title, sender_name, recipient_name, contract_type")
      .eq("signing_url", token)
      .single();
    contract = data;
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        {/* eslint-disable-next-line -- suppress no-img-element: static logo on external signing page; next/image optimization not needed for a simple local asset */}
        <img src="/logo.png" alt="Smartout" className="mx-auto mb-6 h-8" />
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-6 text-2xl font-bold">Avtalen er signert!</h1>
        {contract?.title && (
          <p className="text-foreground mt-2 text-lg font-medium">{contract.title}</p>
        )}
        <p className="text-muted-foreground mt-2">
          Takk for at du signerte avtalen.
          {contract?.sender_name && (
            <>
              {" "}
              En bekreftelse er sendt fra <strong>{contract.sender_name}</strong>.
            </>
          )}
        </p>
        <p className="text-muted-foreground mt-4 text-sm">
          En kopi er sendt til e-posten din. Du kan lukke dette vinduet.
        </p>
      </div>
    </div>
  );
}
