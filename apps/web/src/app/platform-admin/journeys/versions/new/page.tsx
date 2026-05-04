// ============================================
// page.tsx — New Journey Version (M4)
//
// Server component wrapper. Loads the journey table rows for the parent-
// journey selector (FK target) and hands to the form.
// ============================================

import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import {
  NewJourneyVersionForm,
  type ParentJourneyOption,
} from "./_components/NewJourneyVersionForm";

export default async function NewJourneyVersionPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("journey")
    .select("journey_id, slug, title, module")
    .order("title", { ascending: true });

  const options: ParentJourneyOption[] = (data ?? []).map((j) => ({
    journeyId: j.journey_id,
    slug: j.slug,
    title: j.title ?? j.slug,
    module: j.module ?? "",
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-foreground text-2xl">New Journey Version</h1>
        <p className="text-muted-foreground text-sm">
          Creates a new <code>journey_version</code> row in <code>draft</code>. Once saved, open the
          version and edit its IR.
        </p>
      </div>
      <NewJourneyVersionForm parentJourneys={options} />
    </div>
  );
}
