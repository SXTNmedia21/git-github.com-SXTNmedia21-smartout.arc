// ============================================
// ws.ts
// WebSocket endpoint for bidirectional agent-UI communication.
// Frontend connects with JWT token as query param.
// Connected to: src/ws/connection-manager.ts
// Connected to: src/middleware/auth.ts (reuses validateJwt logic)
// ============================================

import { Hono } from "hono";
import type { createNodeWebSocket } from "@hono/node-ws";
import { addConnection, removeConnection } from "../ws/connection-manager.js";
import { getSession } from "../core/session-manager.js";
import { createUserClient, supabaseAdmin } from "../lib/supabase.js";
import { UserActionSchema } from "@smartout/types";

// Buffer of user actions per session, drained by agent on next turn
const userActionBuffer = new Map<string, Array<{ action: unknown; timestamp: number }>>();

export function getBufferedActions(
  sessionId: string,
): Array<{ action: unknown; timestamp: number }> {
  const actions = userActionBuffer.get(sessionId) ?? [];
  userActionBuffer.delete(sessionId);
  return actions;
}

export function createWsRoute(
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"],
) {
  const ws = new Hono();

  ws.get(
    "/ws/:sessionId",
    upgradeWebSocket((c) => {
      const sessionId = c.req.param("sessionId");

      return {
        async onOpen(_event, wsCtx) {
          // Validate auth — JWT in query param
          const token = c.req.query("token");
          if (!token) {
            wsCtx.close(4001, "Missing token");
            return;
          }

          // Validate JWT
          const client = createUserClient(token);
          const {
            data: { user },
            error,
          } = await client.auth.getUser();
          if (error || !user) {
            wsCtx.close(4001, "Invalid token");
            return;
          }

          // Validate session exists and belongs to user's workspace
          const session = await getSession(sessionId);
          if (!session) {
            wsCtx.close(4004, "Session not found");
            return;
          }

          // Check user has access to this workspace
          const { data: profile } = await supabaseAdmin
            .from("profile")
            .select("workspace_id")
            .eq("user_id", user.id)
            .eq("workspace_id", session.workspace_id)
            .eq("is_active", true)
            .limit(1)
            .single();

          if (!profile) {
            wsCtx.close(4003, "Forbidden");
            return;
          }

          addConnection(sessionId, wsCtx);
        },

        onMessage(event, _wsCtx) {
          try {
            const raw = typeof event.data === "string" ? event.data : String(event.data);
            const parsed = JSON.parse(raw);

            // Validate as UserAction
            const result = UserActionSchema.safeParse(parsed);
            if (result.success) {
              // Buffer for agent's next turn
              if (!userActionBuffer.has(sessionId)) {
                userActionBuffer.set(sessionId, []);
              }
              userActionBuffer.get(sessionId)!.push({
                action: result.data.action,
                timestamp: result.data.timestamp,
              });
            }
          } catch {
            // Ignore malformed messages
          }
        },

        onClose(_event, wsCtx) {
          removeConnection(sessionId, wsCtx);
        },
      };
    }),
  );

  return ws;
}
