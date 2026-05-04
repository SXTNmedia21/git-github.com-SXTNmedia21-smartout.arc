/**
 * POST /api/contract-templates/[id]/publish — Flip template draft → live.
 * DELETE /api/contract-templates/[id]/publish — Unpublish (back to draft).
 *
 * Sets/clears `published_at`. Live templates can be bulk-sent and selected
 * in ContractDispatchDrawer; drafts are hidden from the dispatch flow.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return setPublishedState(params, true);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return setPublishedState(params, false);
}

async function setPublishedState(paramsPromise: Promise<{ id: string }>, publish: boolean) {
  try {
    const { id } = await paramsPromise;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: tpl, error: loadError } = await supabase
      .from("contract_template")
      .select("template_id, name, workspace_id, deprecated_at")
      .eq("template_id", id)
      .single();

    if (loadError || !tpl || !tpl.workspace_id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (tpl.deprecated_at) {
      return NextResponse.json({ error: "Cannot publish deprecated template" }, { status: 400 });
    }

    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", tpl.workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newPublishedAt = publish ? new Date().toISOString() : null;

    const { error: updateError } = await supabase
      .from("contract_template")
      .update({ published_at: newPublishedAt })
      .eq("template_id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (publish) {
      await emit({
        event: "contract_template published",
        workspace_id: nonEmpty(tpl.workspace_id, "workspace_id"),
        actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
        properties: {
          entity: {
            entity_type: "contract_template",
            entity_id: id,
            entity_label: tpl.name,
          },
          data: {
            name: tpl.name,
            published_at: newPublishedAt as string,
            is_reactivation: false,
          },
        },
      });
    } else {
      await emit({
        event: "contract_template unpublished",
        workspace_id: nonEmpty(tpl.workspace_id, "workspace_id"),
        actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
        properties: {
          entity: {
            entity_type: "contract_template",
            entity_id: id,
            entity_label: tpl.name,
          },
          data: { published_at: null },
        },
      });
    }

    return NextResponse.json({ template_id: id, published_at: newPublishedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
