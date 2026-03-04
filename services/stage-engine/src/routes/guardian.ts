// ============================================
// guardian.ts
// Guardian WebSocket route using Hono's built-in WebSocket support.
// Dashboard connects to monitor and control active agent sessions.
// Auth via JWT query param (?token=...), checked in onOpen.
// Connected to: src/core/guardian-bus.ts (client management, event broadcasting)
// Connected to: src/core/session-manager.ts (session loading)
// Connected to: src/core/stage-manager.ts (stage advancement)
// ============================================

import { Hono } from "hono";
import type { createNodeWebSocket } from "@hono/node-ws";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import {
  addClient,
  removeClient,
  subscribeSession,
  unsubscribeSession,
  sendSessionList,
  emitGuardianEvent,
} from "../core/guardian-bus.js";
import { loadAuthorizedSession } from "../core/session-manager.js";
import { advanceStage } from "../core/stage-manager.js";
import type { GuardianCommand } from "../types/guardian.js";

export function createGuardianRoute(
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"],
) {
  const guardian = new Hono();

  guardian.get(
    "/guardian/ws",
    upgradeWebSocket((c) => {
      let workspaceId: string | null = null;
      let client: ReturnType<typeof addClient> | null = null;

      return {
        async onOpen(_event, wsCtx) {
          // Validate auth — JWT in query param
          const token = c.req.query("token");
          if (!token) {
            wsCtx.close(4001, "Missing token");
            return;
          }

          // Validate JWT
          const userClient = createUserClient(token);
          const {
            data: { user },
            error,
          } = await userClient.auth.getUser();
          if (error || !user) {
            wsCtx.close(4001, "Invalid token");
            return;
          }

          // Get user's workspace + verify admin/owner role
          const { data: profile } = await supabaseAdmin
            .from("profile")
            .select("workspace_id, role")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .limit(1)
            .single();

          if (!profile || !["admin", "owner"].includes(profile.role)) {
            wsCtx.close(4003, "Forbidden — admin or owner role required");
            return;
          }

          workspaceId = profile.workspace_id;
          client = addClient(wsCtx, workspaceId as string);
          console.log(`[guardian-ws] Client connected for workspace ${workspaceId}`);

          // Send current active sessions on connect
          sendSessionList(client);
        },

        async onMessage(event, wsCtx) {
          if (!workspaceId || !client) return;

          try {
            const raw = typeof event.data === "string" ? event.data : String(event.data);
            const cmd = JSON.parse(raw) as GuardianCommand;
            await handleCommand(cmd, workspaceId, client);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            wsCtx.send(JSON.stringify({ type: "error", message: msg }));
          }
        },

        onClose() {
          if (client) {
            removeClient(client);
            console.log(`[guardian-ws] Client disconnected`);
          }
        },
      };
    }),
  );

  return guardian;
}

/** Handle incoming commands from dashboard */
async function handleCommand(
  cmd: GuardianCommand,
  workspaceId: string,
  client: ReturnType<typeof addClient>,
): Promise<void> {
  switch (cmd.type) {
    case "subscribe":
      subscribeSession(client, cmd.session_id);
      break;

    case "unsubscribe":
      unsubscribeSession(client, cmd.session_id);
      break;

    case "change_stage": {
      // Load session and force-advance to target stage
      const result = await loadAuthorizedSession(cmd.session_id, {
        method: "jwt",
        workspaceId,
      });
      if (!result.ok) break;

      const advanceResult = await advanceStage(result.session, {
        next_stage_id: cmd.target_stage_id,
      });

      if (advanceResult) {
        emitGuardianEvent({
          session_id: cmd.session_id,
          workspace_id: workspaceId,
          event_type: "admin.stage_change",
          actor: "admin",
          summary: `Admin forced stage change to "${cmd.target_stage_id}"`,
          data: { target_stage_id: cmd.target_stage_id },
        });
      }
      break;
    }

    case "whisper": {
      // Store whisper in session collected_data._whispers[]
      const { data: session } = await supabaseAdmin
        .from("engine_sessions")
        .select("collected_data")
        .eq("id", cmd.session_id)
        .eq("workspace_id", workspaceId)
        .single();

      if (!session) break;

      const collected = (session.collected_data ?? {}) as Record<string, unknown>;
      const whispers = (collected._whispers as string[] | undefined) ?? [];
      whispers.push(cmd.message);

      await supabaseAdmin
        .from("engine_sessions")
        .update({
          collected_data: { ...collected, _whispers: whispers },
          updated_at: new Date().toISOString(),
        })
        .eq("id", cmd.session_id);

      emitGuardianEvent({
        session_id: cmd.session_id,
        workspace_id: workspaceId,
        event_type: "admin.whisper",
        actor: "admin",
        summary: "Admin whispered to agent",
        data: { message: cmd.message },
      });
      break;
    }
  }
}
