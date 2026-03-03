import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import { hashApiKey } from "../lib/crypto.js";
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

/**
 * Attaches the Guardian WebSocket server to the HTTP server.
 * Handles auth on upgrade, then routes commands from clients.
 */
export function attachGuardianWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade manually for auth
  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (url.pathname !== "/guardian/ws") return;

    // Authenticate (check headers + query param token)
    const workspaceId = await authenticateUpgrade(req.headers, url);
    if (!workspaceId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, workspaceId);
    });
  });

  wss.on("connection", (ws: WebSocket, workspaceId: string) => {
    const client = addClient(ws, workspaceId);
    console.log(`[guardian-ws] Client connected for workspace ${workspaceId}`);

    // Send current active sessions on connect
    sendSessionList(client);

    ws.on("message", async (raw) => {
      try {
        const cmd = JSON.parse(raw.toString()) as GuardianCommand;
        await handleCommand(cmd, workspaceId, client);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        ws.send(JSON.stringify({ type: "error", message: msg }));
      }
    });

    ws.on("close", () => {
      removeClient(client);
      console.log(`[guardian-ws] Client disconnected`);
    });
  });
}

/** Auth for WebSocket upgrade — checks x-api-key, Authorization header, or ?token query param */
async function authenticateUpgrade(
  headers: Record<string, string | string[] | undefined>,
  url: URL,
): Promise<string | null> {
  const apiKey = headers["x-api-key"] as string | undefined;
  const authHeader = headers["authorization"] as string | undefined;
  const queryToken = url.searchParams.get("token");

  if (apiKey) {
    const hash = hashApiKey(apiKey);
    const { data } = await supabaseAdmin
      .from("platform_api_key")
      .select("workspace_id")
      .eq("key_hash", hash)
      .eq("version", "current")
      .single();
    return data?.workspace_id ?? null;
  }

  // JWT auth — from Authorization header or ?token query param
  const jwtToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : queryToken;

  if (jwtToken) {
    const client = createUserClient(jwtToken);
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!profile || !["admin", "owner"].includes(profile.role)) return null;
    return profile.workspace_id;
  }

  return null;
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
