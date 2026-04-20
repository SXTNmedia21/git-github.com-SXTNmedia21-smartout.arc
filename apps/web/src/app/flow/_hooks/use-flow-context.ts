/**
 * Resolves workspace and actor context from the current auth session.
 * Flow pages are public — if no session exists, falls back to null/"anonymous".
 */

import { useEffect, useState } from "react";
import { createClient } from "@smartout/supabase/client";

type FlowContext = {
  workspaceId: string | null;
  actorId: string;
};

const DEFAULT_CONTEXT: FlowContext = {
  workspaceId: null,
  actorId: "anonymous",
};

export function useFlowContext(): FlowContext {
  const [context, setContext] = useState<FlowContext>(DEFAULT_CONTEXT);

  useEffect(() => {
    async function resolve() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profile } = await supabase
          .from("profile")
          .select("profile_id, workspace_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (profile) {
          setContext({
            workspaceId: profile.workspace_id,
            actorId: profile.profile_id,
          });
        } else {
          // User exists but no profile — use auth id as actor
          setContext({ workspaceId: null, actorId: user.id });
        }
      } catch {
        // Auth unavailable — keep defaults
      }
    }

    void resolve();
  }, []);

  return context;
}
