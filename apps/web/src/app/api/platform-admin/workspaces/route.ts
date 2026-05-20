import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const CreateWorkspaceSchema = z.object({
  // Company
  is_new_company: z.boolean(),
  company_id: z.string().uuid().optional().or(z.literal("")),
  company_name: z.string().min(1).optional(),
  company_org_number: z.string().min(1).optional(),
  company_email: z.string().email().optional().or(z.literal("")),
  company_industry: z.enum(["restaurant", "hotel", "cafe", "bar", "catering", "other"]).optional(),
  company_country: z.enum(["NO", "SE", "DK", "FI"]).optional(),

  // Workspace
  workspace_name: z.string().min(1),
  workspace_slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/)
    .optional()
    .or(z.literal("")),
  address_line_1: z.string().optional().or(z.literal("")),
  address_line_2: z.string().optional().or(z.literal("")),
  postal_code: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  country: z.enum(["NO", "SE", "DK", "FI"]).default("NO"),
  language: z.enum(["no", "sv", "en", "da", "fi"]).default("no"),
  currency: z.enum(["NOK", "SEK", "DKK", "EUR"]).default("NOK"),
  timezone: z.string().default("Europe/Oslo"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),

  // Pricing — ADR-0121 model: monthly_cost + free_users + overage_price_per_user.
  // price_per_employee accepted for backward compat and synced = overage in insert.
  price_per_employee: z.number().min(0).optional(),
  free_users: z.number().int().nonnegative().optional(),
  overage_price_per_user: z.number().nonnegative().optional(),
  monthly_cost: z.number().min(0).optional(),
  billing_interval: z.enum(["month", "year"]).default("month"),
  onboarding_package: z.enum(["small", "medium", "large", "enterprise", "custom"]).optional(),
  onboarding_cost: z.number().min(0).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  discount_amount: z.number().min(0).optional(),
  discount_duration: z.enum(["once", "repeating", "forever"]).optional(),
  discount_duration_months: z.number().int().min(1).optional(),
  discount_label: z.string().optional().or(z.literal("")),
  trial_days: z.number().int().min(0).optional(),
  pricing_currency: z.enum(["NOK", "SEK", "DKK", "EUR"]).optional(),
  effective_from: z.string().optional().or(z.literal("")),
  effective_until: z.string().optional().or(z.literal("")),
  pricing_notes: z.string().optional().or(z.literal("")),

  // Contract template
  template_id: z.string().uuid().optional().or(z.literal("")),

  // Subscription
  subscription_plan: z.enum(["trial", "starter", "professional", "enterprise"]).optional(),
  subscription_status: z.enum(["trial", "active"]).optional(),
});

// ---------------------------------------------------------------------------
// GET — Dropdown data
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const type = request.nextUrl.searchParams.get("type");

  if (type === "companies") {
    const { data, error } = await admin
      .from("company")
      .select("company_id, name, org_number, email, industry, country")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "templates") {
    const { data, error } = await admin
      .from("contract_template")
      .select("template_id, name, contract_type, description, default_pricing")
      .eq("is_active", true)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Default: list workspaces (used by key management UI and other dropdowns)
  {
    const { data, error } = await admin
      .from("workspace")
      .select("workspace_id, name, slug, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }
}

// ---------------------------------------------------------------------------
// POST — Create workspace (+ optional company, pricing_terms, contract)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = CreateWorkspaceSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = body.data;
  const admin = createAdminClient();

  // 1. Resolve or create company
  let companyId = d.company_id || undefined;

  if (d.is_new_company) {
    if (!d.company_name || !d.company_org_number) {
      return NextResponse.json(
        { error: "company_name and company_org_number required for new company" },
        { status: 400 },
      );
    }

    const { data: newCompany, error: companyErr } = await admin
      .from("company")
      .insert({
        name: d.company_name,
        org_number: d.company_org_number,
        email: d.company_email || null,
        industry: d.company_industry ?? "restaurant",
        country: d.company_country ?? "NO",
      })
      .select("company_id")
      .single();

    if (companyErr || !newCompany) {
      return NextResponse.json(
        { error: companyErr?.message || "Failed to create company" },
        { status: 500 },
      );
    }

    companyId = newCompany.company_id;
  }

  if (!companyId) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  // 2. Create workspace (slug trigger handles auto-generation)
  try {
    const { data: workspace, error: wsErr } = await admin
      .from("workspace")
      .insert({
        company_id: companyId,
        name: d.workspace_name,
        slug: d.workspace_slug || "",
        address_line_1: d.address_line_1 || null,
        address_line_2: d.address_line_2 || null,
        postal_code: d.postal_code || null,
        city: d.city || null,
        country: d.country,
        language: d.language,
        currency: d.currency,
        timezone: d.timezone,
        email: d.email || null,
        phone: d.phone || null,
        is_active: d.is_active,
      })
      .select("workspace_id, slug")
      .single();

    if (wsErr || !workspace) {
      // Check for reserved slug error
      if (wsErr?.code === "P0001") {
        return NextResponse.json({ error: wsErr.message || "Slug is reserved" }, { status: 409 });
      }
      // Check for unique constraint violation
      if (wsErr?.code === "23505") {
        return NextResponse.json(
          { error: "En arbeidssted med denne slug-en finnes allerede" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: wsErr?.message || "Failed to create workspace" },
        { status: 500 },
      );
    }

    // 2b. Auto-grant the godmode creator an `admin` profile + company_member
    // membership so they can access the freshly created workspace at
    // {slug}.smartout.ai/dashboard without needing a separate invite step.
    // The `owner` role is reserved for the real customer who is invited
    // separately. Failure is logged but does not roll back workspace creation;
    // operator can manually grant later if this insert fails.
    {
      const { data: identity } = await admin
        .from("user_identity")
        .select("first_name, last_name, email")
        .eq("user_id", adminId)
        .maybeSingle();

      const displayName = identity
        ? `${identity.first_name ?? ""} ${identity.last_name ?? ""}`.trim() ||
          identity.email ||
          "Super Admin"
        : "Super Admin";

      // profile_code is a 6-char random tag (NOT NULL on the table). Matches
      // the pattern used by activate_workspace RPCs (substring(md5(random()) 1,6)).
      const profileCode = Math.random().toString(36).slice(2, 8);

      const { error: profileErr } = await admin.from("profile").insert({
        workspace_id: workspace.workspace_id,
        user_id: adminId,
        company_id: companyId,
        profile_code: profileCode,
        role: "admin",
        status: "active",
        display_name: displayName,
      });

      if (profileErr) {
        console.error("[platform-admin/workspaces] auto-grant profile failed:", profileErr.message);
      }

      // company_member may already exist if godmode previously administered
      // another workspace under the same company. Upsert keeps it idempotent.
      const { error: memberErr } = await admin
        .from("company_member")
        .upsert(
          { company_id: companyId, user_id: adminId, role: "admin" },
          { onConflict: "user_id,company_id", ignoreDuplicates: true },
        );

      if (memberErr) {
        console.error(
          "[platform-admin/workspaces] auto-grant company_member failed:",
          memberErr.message,
        );
      }
    }

    // 3. Update company subscription if provided
    if (d.subscription_plan || d.subscription_status) {
      const updates: Record<string, unknown> = {};
      if (d.subscription_plan) updates.subscription_plan = d.subscription_plan;
      if (d.subscription_status) updates.subscription_status = d.subscription_status;
      // Calculate trial_ends_at from trial_days
      if (d.trial_days && d.trial_days > 0) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + d.trial_days);
        updates.trial_ends_at = trialEnd.toISOString();
      }

      await admin.from("company").update(updates).eq("company_id", companyId);
    }

    // 4. Insert pricing_terms (ADR-0121 fields)
    // Map Stripe billing interval to existing DB values
    const billingIntervalMap = { month: "monthly", year: "yearly" } as const;
    // Sync legacy price_per_employee = overage_price_per_user when only the
    // new field is provided. Both fields are still written to keep the NOT NULL
    // legacy column populated during the transition.
    const overage = d.overage_price_per_user ?? d.price_per_employee ?? 0;
    await admin.from("pricing_terms").insert({
      company_id: companyId,
      workspace_id: workspace.workspace_id,
      price_per_employee: d.price_per_employee ?? overage,
      free_users: d.free_users ?? 10,
      overage_price_per_user: overage,
      monthly_cost: d.monthly_cost ?? null,
      currency: (d.pricing_currency ?? d.currency) as "NOK" | "SEK" | "DKK" | "EUR",
      billing_interval:
        billingIntervalMap[d.billing_interval as keyof typeof billingIntervalMap] ?? "monthly",
      onboarding_package: d.onboarding_package ?? null,
      onboarding_cost: d.onboarding_cost ?? null,
      discount_percent: d.discount_percent ?? null,
      discount_label: d.discount_label || null,
      trial_days: d.trial_days ?? null,
      effective_from: d.effective_from || new Date().toISOString().split("T")[0]!,
      effective_until: d.effective_until || null,
      notes: d.pricing_notes || null,
      created_by: adminId,
    });

    // 5. Create draft contract if template selected
    let contractId: string | null = null;
    if (d.template_id) {
      const { data: template } = await admin
        .from("contract_template")
        .select("template_id, name, contract_type, content_html, placeholders")
        .eq("template_id", d.template_id)
        .single();

      if (template) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: contract } = await admin
          .from("contract")
          .insert({
            template_id: template.template_id,
            company_id: companyId,
            workspace_id: workspace.workspace_id,
            title: `${template.name} - ${d.workspace_name}`,
            contract_type: template.contract_type,
            status: "draft",
            sender_name: "Smartout AS",
            sender_email: "pontus@smartout.no",
            recipient_name: d.company_name || "",
            recipient_email: d.company_email || d.email || "",
            resolved_html: template.content_html,
            expires_at: expiresAt,
            metadata: {} as unknown as Json,
            created_by: adminId,
          })
          .select("contract_id")
          .single();

        contractId = contract?.contract_id ?? null;

        // Link pricing_terms to contract
        if (contractId) {
          await admin
            .from("pricing_terms")
            .update({ contract_id: contractId })
            .eq("workspace_id", workspace.workspace_id)
            .eq("company_id", companyId)
            .is("contract_id", null);
        }
      }
    }

    // 6. Audit log
    await logPlatformAction(adminId, "create_workspace", "workspace", workspace.workspace_id, {
      company_id: companyId,
      is_new_company: d.is_new_company,
      slug: workspace.slug,
      template_id: d.template_id || null,
      contract_id: contractId,
    });

    return NextResponse.json(
      {
        data: {
          workspace_id: workspace.workspace_id,
          company_id: companyId,
          slug: workspace.slug,
          contract_id: contractId,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
