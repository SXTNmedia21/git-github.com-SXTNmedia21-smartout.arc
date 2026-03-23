import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import SetupWizard from "../_components/SetupWizard";

/**
 * Website setup page — server shell. Redirects to login if unauthenticated,
 * otherwise renders the 3-step SetupWizard client component.
 */
export default async function WebsiteSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight">Opprett nettside</h1>
        <p className="text-foreground/60 mt-2 text-sm">
          Velg en mal, tilpass utseende, og gå live.
        </p>
      </div>
      <SetupWizard />
    </div>
  );
}
