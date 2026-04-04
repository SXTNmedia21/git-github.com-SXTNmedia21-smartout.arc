import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WorkspaceDetailClient } from "./_components/workspace-detail-client";

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { id } = await params;
  const admin = createAdminClient();

  const [
    { data: workspace },
    { count: totalProfiles },
    { count: activeProfiles },
    { count: traineeProfiles },
    { count: departmentCount },
    { data: profiles },
    { data: notes },
    { data: commHistory },
    { data: docChunks },
    { data: memories },
  ] = await Promise.all([
    admin.from("workspace").select("*, company:company_id (*)").eq("workspace_id", id).single(),
    admin.from("profile").select("*", { count: "exact", head: true }).eq("workspace_id", id),
    admin
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("status", "active"),
    admin
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", id)
      .eq("status", "trainee"),
    admin.from("department").select("*", { count: "exact", head: true }).eq("workspace_id", id),
    admin
      .from("profile")
      .select(
        "profile_id, user_id, display_name, role, status, created_at, user_identity!inner(email, last_login_at)",
      )
      .eq("workspace_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("workspace_note")
      .select("note_id, content, created_at, updated_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("platform_communication_log")
      .select("*")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("workspace_doc_chunk")
      .select("chunk_id, source_type, source_path, title, token_count, created_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("engine_memory")
      .select("id, memory_type, content, created_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!workspace) redirect("/platform-admin/workspaces");

  const company = workspace.company as Record<string, unknown> | null;

  // Fetch storage files for workspace
  const { data: storageFiles } = await admin.storage
    .from("workspace-documents")
    .list(id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

  const profileRows = (profiles ?? []).map((p) => {
    const ui = p.user_identity as unknown as { email: string; last_login_at: string | null }; // SAFETY: Supabase join returns union type; runtime shape matches the cast
    return {
      profileId: p.profile_id,
      userId: p.user_id,
      name: p.display_name || "\u2014",
      email: ui.email,
      role: p.role as string,
      status: p.status as string,
      lastLogin: ui.last_login_at,
    };
  });

  return (
    <WorkspaceDetailClient
      workspace={{
        workspaceId: workspace.workspace_id,
        name: workspace.name,
        slug: workspace.slug ?? "",
        createdAt: workspace.created_at,
        description: workspace.description ?? "",
        timezone: workspace.timezone,
        currency: workspace.currency,
        language: workspace.language,
        country: workspace.country,
        addressLine1: workspace.address_line_1 ?? "",
        addressLine2: workspace.address_line_2 ?? "",
        postalCode: workspace.postal_code ?? "",
        city: workspace.city ?? "",
        phone: workspace.phone ?? "",
        email: workspace.email ?? "",
        logoUrl: workspace.logo_url ?? "",
        coverPhotoUrl: workspace.cover_photo_url ?? "",
        slogan: workspace.slogan ?? "",
        shortDescription: workspace.short_description ?? "",
        extendedDescription: workspace.extended_description ?? "",
        brandColor: workspace.brand_color ?? "",
        communicationTone: workspace.communication_tone ?? "",
        isActive: workspace.is_active,
        maxProfiles: workspace.max_profiles,
        onboardingCompleted: workspace.onboarding_completed,
        intelligenceData: (workspace.intelligence_data as Record<string, unknown>) ?? {},
        googleRating: workspace.google_rating,
        googleRatingCount: workspace.google_rating_count,
        googleMapsUrl: workspace.google_maps_url ?? "",
        googlePriceLevel: workspace.google_price_level ?? "",
        latitude: workspace.latitude,
        longitude: workspace.longitude,
      }}
      company={
        company
          ? {
              companyId: company.company_id as string,
              name: (company.name as string) ?? "\u2014",
              legalName: (company.legal_name as string) ?? "",
              orgNumber: (company.org_number as string) ?? "\u2014",
              city: (company.city as string) ?? "\u2014",
              industry: (company.industry as string) ?? "\u2014",
              email: (company.email as string) ?? "\u2014",
              phone: (company.phone as string) ?? "\u2014",
              website: (company.website as string) ?? "",
              billingEmail: (company.billing_email as string) ?? "",
              addressLine1: (company.address_line_1 as string) ?? "",
              postalCode: (company.postal_code as string) ?? "",
              subscriptionPlan: (company.subscription_plan as string) ?? "\u2014",
              subscriptionStatus: (company.subscription_status as string) ?? "unknown",
              trialEndsAt: (company.trial_ends_at as string) ?? null,
              naceCode: (company.nace_code as string) ?? "",
              naceDescription: (company.nace_description as string) ?? "",
              dagligLeder: (company.daglig_leder as string) ?? "",
            }
          : null
      }
      stats={{
        totalProfiles: totalProfiles ?? 0,
        activeProfiles: activeProfiles ?? 0,
        traineeProfiles: traineeProfiles ?? 0,
        departmentCount: departmentCount ?? 0,
      }}
      profiles={profileRows}
      notes={(notes ?? []).map((n) => ({
        id: n.note_id,
        text: n.content,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }))}
      commHistory={commHistory ?? []}
      intelligence={{
        docChunks: (docChunks ?? []).map((d) => ({
          id: d.chunk_id,
          sourceType: d.source_type,
          sourcePath: d.source_path,
          title: d.title ?? "",
          tokenCount: d.token_count,
          createdAt: d.created_at,
        })),
        memories: (memories ?? []).map((m) => ({
          id: m.id,
          memoryType: m.memory_type,
          content: m.content,
          createdAt: m.created_at,
        })),
        files: (storageFiles ?? []).map((f) => ({
          name: f.name,
          size: f.metadata?.size as number | undefined,
          mimeType: f.metadata?.mimetype as string | undefined,
          createdAt: f.created_at,
        })),
      }}
    />
  );
}
