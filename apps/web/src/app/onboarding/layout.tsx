import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { BotssonProvider } from "@/app/Botsson/_components/BotssonProvider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kom i gang | Smartout",
  description: "Sett opp arbeidsplassen din på under fem minutter.",
};

/**
 * Server-side guard: if the user has no workspace still in onboarding,
 * redirect to /dashboard. Prevents completed users from re-entering.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profiles } = await supabase
      .from("profile")
      .select("workspace:workspace_id(onboarding_completed)")
      .eq("user_id", user.id)
      .limit(10);

    const hasOnboardingWorkspace = profiles?.some((p) => {
      const ws = p.workspace as unknown as { onboarding_completed: boolean } | null;
      return ws?.onboarding_completed === false;
    });

    // User has workspaces but none in onboarding → they're done, redirect out
    if (profiles && profiles.length > 0 && !hasOnboardingWorkspace) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-[oklch(0.08_0.015_50)]">
      <BotssonProvider>{children}</BotssonProvider>
    </div>
  );
}
