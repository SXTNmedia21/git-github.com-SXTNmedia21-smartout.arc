/**
 * /dashboard/my-salary/[lonnsgrunnlagId] — PDF viewer for a single lønnsgrunnlag.
 *
 * Server Component. Resolves the current employee's profile_id server-side
 * from the authenticated session, then passes it to LonnsgrunnlagViewer so
 * the client can fetch the signed URL (ADR-0151 — identity never comes from
 * client URL params or query strings).
 *
 * Redirects to /dashboard/my-salary if the user is not authenticated or if
 * the export_event does not belong to this profile (RLS handles the latter
 * inside useLonnsgrunnlagUrl — BFF returns 404).
 *
 * ADR-0133: web-only reader surface. Mobile = Wave D.
 * ADR-0151: profile_id server-derived, never from URL params.
 * ADR-0078: Høy-PII — chat only, no voice.
 * Nordic Split: CSS variables only.
 */
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { LonnsgrunnlagViewer } from "./_components/LonnsgrunnlagViewer";

type PageProps = {
  params: Promise<{ lonnsgrunnlagId: string }>;
};

export default async function LonnsgrunnlagDetailPage({ params }: PageProps) {
  const { lonnsgrunnlagId } = await params;

  // Resolve authenticated user server-side (ADR-0151)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard/my-salary");
  }

  // Resolve profile_id from the authenticated session — never from URL params
  const { data: profile, error: profileErr } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile?.profile_id) {
    redirect("/dashboard/my-salary");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Page header */}
      <div>
        <p className="text-muted-foreground font-mono text-[10.5px] font-medium tracking-widest uppercase">
          Min lønn
        </p>
        <h1 className="font-heading text-foreground mt-1 text-2xl tracking-tight">Lønnsgrunnlag</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Dokument-ID: <span className="font-mono text-xs">{lonnsgrunnlagId}</span>
        </p>
      </div>

      {/* PDF viewer — client component with signed URL auto-refresh */}
      <Suspense
        fallback={
          <div className="bg-muted flex h-[560px] animate-pulse items-center justify-center rounded-lg">
            <span className="text-muted-foreground text-sm">Laster lønnsgrunnlag…</span>
          </div>
        }
      >
        <LonnsgrunnlagViewer eventId={lonnsgrunnlagId} profileId={profile.profile_id} />
      </Suspense>
    </div>
  );
}
