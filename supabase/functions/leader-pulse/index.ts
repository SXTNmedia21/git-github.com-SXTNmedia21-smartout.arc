import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Leader Pulse — Cron Edge Function (every 3 days)
 *
 * For each workspace, finds leaders (manager/admin/owner),
 * gathers context (readiness, signals, season), generates
 * one contextual question via Claude Haiku, and inserts it
 * into leader_pulse.
 */

type LeaderProfile = {
  profile_id: string;
  display_name: string | null;
  role: string;
  workspace_id: string;
};

type LeaderContext = {
  leader_name: string;
  role: string;
  readiness_percent: number;
  total_assignments: number;
  completed_assignments: number;
  active_signals: number;
  critical_signals: number;
  season_name: string | null;
  season_intensity: number | null;
};

Deno.serve(async (req) => {
  // ── Auth: cron secret ──────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterKey) {
    console.error("OPENROUTER_API_KEY not set");
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── 1. Get all active workspaces ───────────────────────
  const { data: workspaces, error: wsError } = await supabase
    .from("workspace")
    .select("workspace_id, name")
    .eq("is_active", true);

  if (wsError) {
    console.error("Failed to fetch workspaces", wsError);
    return new Response(JSON.stringify({ error: wsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let questionsGenerated = 0;
  let leadersSkipped = 0;
  const errors: string[] = [];

  for (const ws of workspaces ?? []) {
    try {
      // ── 2. Get leader profiles ─────────────────────────
      const { data: leaders, error: leadersError } = await supabase
        .from("profile")
        .select("profile_id, display_name, role, workspace_id")
        .eq("workspace_id", ws.workspace_id)
        .eq("is_active", true)
        .in("role", ["manager", "admin", "owner"]);

      if (leadersError) {
        errors.push(`ws=${ws.workspace_id}: ${leadersError.message}`);
        continue;
      }

      if (!leaders || leaders.length === 0) continue;

      // ── 3. Check which leaders already have pending/delivered ─
      const leaderIds = leaders.map((l: LeaderProfile) => l.profile_id);
      const { data: existingPulses } = await supabase
        .from("leader_pulse")
        .select("profile_id")
        .in("profile_id", leaderIds)
        .in("status", ["pending", "delivered"]);

      const hasExisting = new Set(
        (existingPulses ?? []).map((p: { profile_id: string }) => p.profile_id),
      );

      // ── 4. Gather workspace-level context ──────────────
      const [readinessResult, signalsResult, seasonResult] = await Promise.all([
        // Training readiness
        supabase
          .from("protocol_assignment")
          .select("status, profile!inner(workspace_id)")
          .eq("profile.workspace_id", ws.workspace_id),
        // Recent signals (last 7 days)
        supabase
          .from("guardian_signal")
          .select("severity, title")
          .eq("workspace_id", ws.workspace_id)
          .in("status", ["active", "acknowledged"])
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(20),
        // Active season
        supabase
          .from("season")
          .select("season_id, name")
          .eq("workspace_id", ws.workspace_id)
          .eq("status", "active")
          .lte("start_date", new Date().toISOString().split("T")[0]!)
          .gte("end_date", new Date().toISOString().split("T")[0]!)
          .limit(1)
          .maybeSingle(),
      ]);

      // Compute readiness
      const assignments = readinessResult.data ?? [];
      const totalAssignments = assignments.length;
      const completedAssignments = assignments.filter(
        (a: { status: string }) => a.status === "completed",
      ).length;
      const readinessPercent =
        totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 100;

      // Signal counts
      const signals = signalsResult.data ?? [];
      const activeSignals = signals.length;
      const criticalSignals = signals.filter(
        (s: { severity: string }) => s.severity === "critical",
      ).length;

      // Season info
      let seasonName: string | null = null;
      let seasonIntensity: number | null = null;
      if (seasonResult.data) {
        seasonName = seasonResult.data.name;
        // Get season budget for intensity
        const { data: budgetData } = await supabase
          .from("season_budget")
          .select("season_price_factor")
          .eq("season_id", seasonResult.data.season_id)
          .eq("workspace_id", ws.workspace_id)
          .limit(1)
          .maybeSingle();
        if (budgetData) {
          seasonIntensity = Number(budgetData.season_price_factor) || 1.0;
        }
      }

      // ── 5. Generate question per leader ────────────────
      for (const leader of leaders) {
        if (hasExisting.has(leader.profile_id)) {
          leadersSkipped++;
          continue;
        }

        const leaderName = leader.display_name || "Leader";

        const context: LeaderContext = {
          leader_name: leaderName,
          role: leader.role,
          readiness_percent: readinessPercent,
          total_assignments: totalAssignments,
          completed_assignments: completedAssignments,
          active_signals: activeSignals,
          critical_signals: criticalSignals,
          season_name: seasonName,
          season_intensity: seasonIntensity,
        };

        const question = await generateQuestion(openRouterKey, context);
        if (!question) {
          errors.push(
            `ws=${ws.workspace_id} profile=${leader.profile_id}: question generation failed`,
          );
          continue;
        }

        const { error: insertError } = await supabase.from("leader_pulse").insert({
          workspace_id: ws.workspace_id,
          profile_id: leader.profile_id,
          question,
          context,
          status: "pending",
        });

        if (insertError) {
          errors.push(`ws=${ws.workspace_id} profile=${leader.profile_id}: ${insertError.message}`);
        } else {
          questionsGenerated++;
        }
      }
    } catch (err) {
      errors.push(`ws=${ws.workspace_id}: ${String(err)}`);
    }
  }

  const result = {
    status: errors.length > 0 ? "partial" : "ok",
    questions_generated: questionsGenerated,
    leaders_skipped: leadersSkipped,
    workspaces_processed: workspaces?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify({ level: "info", action: "leader_pulse_run", ...result }));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ── Question generation via OpenRouter ────────────────────

async function generateQuestion(apiKey: string, context: LeaderContext): Promise<string | null> {
  const systemPrompt = `You are a workplace coach for Norwegian shift-based businesses. Generate ONE short, specific question (max 2 sentences) that would help this leader reflect on their team's performance and engagement. The question should be actionable — something they can think about or act on today. Write in Norwegian (bokmål). Never use generic questions — make it specific to the data provided.`;

  const contextSummary = [
    `Leader: ${context.leader_name} (${context.role})`,
    `Team readiness: ${context.readiness_percent}% (${context.completed_assignments}/${context.total_assignments} assignments completed)`,
    context.active_signals > 0
      ? `Active alerts: ${context.active_signals} (${context.critical_signals} critical)`
      : "No active alerts",
    context.season_name
      ? `Active season: "${context.season_name}" (intensity: ${context.season_intensity})`
      : "No active season",
  ].join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "Smartout Leader Pulse",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Given this leader's context, generate ONE reflective question:\n\n${contextSummary}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("OpenRouter API error", res.status, errBody);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("Failed to call OpenRouter API", err);
    return null;
  }
}
