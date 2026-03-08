import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: validate WATCHDOG_CRON_SECRET bearer token
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

    // 1. Query unfired delayed triggers that are due
    const { data: dueTriggers, error: queryErr } = await supabase
      .from("engine_delayed_trigger")
      .select("id, trigger_id, event_id, workspace_id")
      .eq("fired", false)
      .lte("fire_at", new Date().toISOString())
      .order("fire_at")
      .limit(50);

    if (queryErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "fire_delayed_triggers",
          category: "engine",
          error: queryErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueTriggers || dueTriggers.length === 0) {
      return new Response(JSON.stringify({ fired: 0, total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Mark found rows as fired=true
    const ids = dueTriggers.map((t) => t.id);
    const { error: updateErr } = await supabase
      .from("engine_delayed_trigger")
      .update({ fired: true })
      .in("id", ids);

    if (updateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "fire_delayed_triggers",
          category: "engine",
          error: updateErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Look up the trigger and event details, then dispatch each
    let firedCount = 0;

    for (const delayed of dueTriggers) {
      // Get the original trigger to find event_type
      const { data: trigger } = await supabase
        .from("engine_trigger")
        .select("event_type, process_id")
        .eq("id", delayed.trigger_id)
        .single();

      // Get the original event payload
      const { data: event } = await supabase
        .from("engine_event")
        .select("payload")
        .eq("id", delayed.event_id)
        .single();

      if (!trigger || !event) {
        console.log(
          JSON.stringify({
            level: "warn",
            action: "fire_delayed_triggers",
            category: "engine",
            message: "Missing trigger or event for delayed trigger",
            delayed_trigger_id: delayed.id,
          }),
        );
        continue;
      }

      // 4. Call engine-dispatch with the trigger's event_type and payload
      const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/engine-dispatch`;
      const res = await fetch(dispatchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          event_type: trigger.event_type,
          payload: event.payload,
          workspace_id: delayed.workspace_id,
        }),
      });

      if (res.ok) {
        firedCount++;
      } else {
        console.log(
          JSON.stringify({
            level: "error",
            action: "fire_delayed_triggers",
            category: "engine",
            message: "engine-dispatch call failed",
            delayed_trigger_id: delayed.id,
            status: res.status,
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        level: "info",
        action: "fire_delayed_triggers",
        category: "engine",
        fired: firedCount,
        total: dueTriggers.length,
      }),
    );

    return new Response(JSON.stringify({ fired: firedCount, total: dueTriggers.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
