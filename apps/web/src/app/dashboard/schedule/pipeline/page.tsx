import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { PipelineListClient } from "./_components/pipeline-list-client";
import PipelineLoading from "./loading";

export const metadata = {
  title: "Pipeline — Admin Override",
};

/**
 * /dashboard/schedule/pipeline — Server Component shell.
 *
 * Admin override dashboard for stuck pipeline_instances. Web-only per ADR-0133.
 * Role gate enforced by BFF (`/api/admin/pipeline`); client redirects on 403.
 *
 * Override actions dispatch via Botsson chat (`botsson:open-with-prompt` custom
 * event) — never direct mutation API (ADR-0240).
 */
export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-foreground text-3xl">Pipeline-oversikt</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administrer og overstyr stoppede engine-prosesser
        </p>
      </div>
      <Suspense fallback={<PipelineLoading />}>
        <PipelineListClient />
      </Suspense>
    </div>
  );
}
