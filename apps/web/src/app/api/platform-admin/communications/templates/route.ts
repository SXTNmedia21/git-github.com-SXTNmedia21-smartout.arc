import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

const VALID_CHANNELS = ["email", "sms", "push", "in_app"] as const;

const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  channel: z.enum(VALID_CHANNELS).default("email"),
  category: z.string().default("custom"),
  subject: z.string().optional(),
  sections: z.array(z.unknown()).optional(),
  placeholders: z.array(z.unknown()).optional(),
  status: z.string().default("draft"),
  // SMS
  sms_body: z.string().optional(),
  // Push
  push_title: z.string().optional(),
  push_body: z.string().optional(),
  push_action_url: z.string().optional(),
  // In-app
  in_app_title: z.string().optional(),
  in_app_body: z.string().optional(),
  in_app_action_url: z.string().optional(),
  in_app_mode: z.string().default("work"),
  in_app_priority: z.number().int().min(0).max(2).default(0),
  in_app_icon_type: z.string().default("info"),
});

const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  template_id: z.string().uuid("Invalid template_id"),
});

/**
 * GET /api/platform-admin/communications/templates
 * List templates with optional channel, category, and name search filters.
 */
export async function GET(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;

  const { admin } = result;
  const { searchParams } = request.nextUrl;

  const channel = searchParams.get("channel");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  let query = admin
    .from("platform_email_template")
    .select(
      "template_id, name, channel, category, subject, status, is_active, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (channel && VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
    query = query.eq("channel", channel);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST /api/platform-admin/communications/templates
 * Create a new template.
 */
export async function POST(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;

  const { admin, adminId } = result;

  const body = await request.json();
  const parsed = CreateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: insertData, error } = await admin
    .from("platform_email_template" as never)
    .insert({
      ...parsed.data,
      created_by: adminId,
    } as never)
    .select("template_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const templateId = (insertData as { template_id: string }).template_id;

  await logPlatformAction(adminId, "create_template", "platform_email_template", templateId, {
    channel: parsed.data.channel,
    name: parsed.data.name,
  });

  return NextResponse.json({ data: { template_id: templateId } }, { status: 201 });
}

/**
 * PUT /api/platform-admin/communications/templates
 * Update an existing template.
 */
export async function PUT(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;

  const { admin, adminId } = result;

  const body = await request.json();
  const parsed = UpdateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { template_id, ...updateFields } = parsed.data;

  const { error } = await admin
    .from("platform_email_template" as never)
    .update({ ...updateFields, updated_at: new Date().toISOString() } as never)
    .eq("template_id", template_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logPlatformAction(adminId, "update_template", "platform_email_template", template_id, {
    channel: updateFields.channel,
    name: updateFields.name,
  });

  return NextResponse.json({ data: { template_id } });
}
