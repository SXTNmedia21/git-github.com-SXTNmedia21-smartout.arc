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
    { data: contracts },
    { data: pricingTerms },
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
    admin
      .from("contract")
      .select(
        `contract_id, title, status, contract_type, recipient_name, recipient_email,
         sent_at, signed_at, expires_at, created_at, signed_pdf_url,
         template:template_id (name, contract_type)`,
      )
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("pricing_terms")
      .select("*")
      .eq("workspace_id", id)
      .is("effective_until", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!workspace) redirect("/platform-admin/workspaces");

  const company = workspace.company as Record<string, unknown> | null;

  // Resolve workspace signatory (prokura) — null for legacy workspaces or
  // workspaces with no owner-role invite accepted yet. See migration
  // 20260520163330_workspace_signatory_profile.sql.
  let signatory: { profileId: string; displayName: string; email: string } | null = null;
  const signatoryProfileId = (workspace as { signatory_profile_id?: string | null })
    .signatory_profile_id;
  if (signatoryProfileId) {
    const { data: sig } = await admin
      .from("profile")
      .select("profile_id, display_name, user_identity:user_id(email)")
      .eq("profile_id", signatoryProfileId)
      .maybeSingle();
    if (sig) {
      const ui = sig.user_identity as unknown as { email?: string } | null;
      signatory = {
        profileId: sig.profile_id,
        displayName: sig.display_name ?? "—",
        email: ui?.email ?? "",
      };
    }
  }

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
        contractStatus: (workspace.contract_status as string) ?? "none",
        activeContractId: (workspace.active_contract_id as string) ?? null,
        trialStartedAt: (workspace.trial_started_at as string) ?? null,
        wsTrialEndsAt: (workspace.trial_ends_at as string) ?? null,
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
      contracts={(contracts ?? []).map((c: Record<string, unknown>) => ({
        contract_id: c.contract_id as string,
        title: c.title as string,
        status: (c.status as string) ?? "draft",
        contract_type: (c.contract_type as string) ?? "custom",
        recipient_name: (c.recipient_name as string) ?? "",
        recipient_email: (c.recipient_email as string) ?? "",
        sent_at: c.sent_at as string | null,
        viewed_at: null,
        signed_at: c.signed_at as string | null,
        expires_at: c.expires_at as string | null,
        created_at: c.created_at as string,
        signed_pdf_url: c.signed_pdf_url as string | null,
        company: null,
        template: c.template as { name: string; contract_type: string } | null,
        events: [],
      }))}
      signatory={signatory}
      pricingTerms={
        pricingTerms
          ? {
              pricingTermsId: pricingTerms.pricing_terms_id,
              companyId: pricingTerms.company_id,
              workspaceId: pricingTerms.workspace_id,
              monthlyCost: pricingTerms.monthly_cost,
              pricePerEmployee: pricingTerms.price_per_employee,
              freeUsers: pricingTerms.free_users ?? 10,
              overagePricePerUser: pricingTerms.overage_price_per_user ?? null,
              billingInterval: pricingTerms.billing_interval,
              currency: pricingTerms.currency,
              discountPercent: pricingTerms.discount_percent,
              discountLabel: pricingTerms.discount_label,
              onboardingPackage: pricingTerms.onboarding_package,
              onboardingCost: pricingTerms.onboarding_cost,
              trialDays: pricingTerms.trial_days,
              effectiveFrom: pricingTerms.effective_from,
              effectiveUntil: pricingTerms.effective_until,
              notes: pricingTerms.notes,
              contractId: pricingTerms.contract_id,
              paymentTermsDays: pricingTerms.payment_terms_days ?? 14,
              updatedAt: pricingTerms.updated_at,
            }
          : null
      }
    />
  );
}
