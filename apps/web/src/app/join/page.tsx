import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { SignupWizard } from "./_components/SignupWizard";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const isPreview = params.preview === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in, load existing progress and prefill from metadata
  const metadata = user?.user_metadata || {};
  let initialState: Record<string, unknown> | undefined;

  if (user) {
    // Load existing progress for resume
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: progress } = await (supabase as any)
      .from("signup_progress")
      .select("current_step, step_data")
      .eq("auth_id", user.id)
      .single();

    initialState = progress?.step_data
      ? {
          ...(progress.step_data as Record<string, unknown>),
          currentStep: progress.current_step,
          step2: {
            ...(progress.step_data as Record<string, Record<string, unknown>>).step2,
            firstName:
              (progress.step_data as Record<string, Record<string, unknown>>).step2?.firstName ||
              metadata.given_name ||
              metadata.first_name ||
              "",
            lastName:
              (progress.step_data as Record<string, Record<string, unknown>>).step2?.lastName ||
              metadata.family_name ||
              metadata.last_name ||
              "",
          },
        }
      : {
          step2: {
            firstName: metadata.given_name || metadata.first_name || "",
            lastName: metadata.family_name || metadata.last_name || "",
          },
        };
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <SignupWizard userEmail={user?.email || ""} initialState={initialState} />
    </Suspense>
  );
}
