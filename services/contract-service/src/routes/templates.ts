import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuery,
} from "../schemas/templates.js";

export async function templateRoutes(app: FastifyInstance) {
  // List templates
  app.get("/templates", async (request, reply) => {
    const query = listTemplatesQuery.parse(request.query);
    let q = supabase.from("contract_template").select("*");

    if (query.workspace_id) q = q.eq("workspace_id", query.workspace_id);
    if (query.contract_type) q = q.eq("contract_type", query.contract_type);
    if (query.language) q = q.eq("language", query.language);
    if (query.is_system !== undefined) q = q.eq("is_system", query.is_system);
    if (query.is_active !== undefined) q = q.eq("is_active", query.is_active);

    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Get template by ID
  app.get("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", id)
      .single();

    if (error) return reply.status(404).send({ error: "Template not found" });
    return data;
  });

  // Create template
  app.post("/templates", async (request, reply) => {
    const body = createTemplateSchema.parse(request.body);
    const workspaceId = request.headers["x-workspace-id"] as string | undefined;

    const { data, error } = await supabase
      .from("contract_template")
      .insert({
        ...body,
        workspace_id: body.workspace_id ?? workspaceId ?? null,
      })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(data);
  });

  // Update template
  app.put("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTemplateSchema.parse(request.body);

    const { data, error } = await supabase
      .from("contract_template")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("template_id", id)
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return data;
  });

  // Archive template (soft delete)
  app.delete("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { error } = await supabase
      .from("contract_template")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("template_id", id);

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(204).send();
  });
}
