// emma-task-trigger
// Cron function: runs every 10 minutes.
// Finds due emma_task rows, marks them triggered, and could notify
// (webhook, push, etc). For now: marks triggered + logs.
// The client checks for triggered tasks on page load via API route.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: WATCHDOG_CRON_SECRET bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find pending tasks that are due
    const now = new Date().toISOString();
    const { data: dueTasks, error: queryErr } = await supabase
      .from("emma_task")
      .select("id, workspace_id, profile_id, title, description, context, mission")
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lte("due_at", now)
      .order("due_at")
      .limit(50);

    if (queryErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "emma_task_trigger",
          category: "emma",
          error: queryErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueTasks || dueTasks.length === 0) {
      return new Response(JSON.stringify({ triggered: 0, total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as triggered
    const ids = dueTasks.map((t) => t.id);
    const { error: updateErr } = await supabase
      .from("emma_task")
      .update({ status: "triggered", triggered_at: now })
      .in("id", ids);

    if (updateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "emma_task_trigger",
          category: "emma",
          error: updateErr.message,
        }),
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        action: "emma_task_trigger",
        category: "emma",
        triggered: dueTasks.length,
        tasks: dueTasks.map((t) => ({ id: t.id, title: t.title })),
      }),
    );

    return new Response(
      JSON.stringify({
        triggered: dueTasks.length,
        total: dueTasks.length,
        tasks: dueTasks.map((t) => ({
          id: t.id,
          title: t.title,
          profile_id: t.profile_id,
          workspace_id: t.workspace_id,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
