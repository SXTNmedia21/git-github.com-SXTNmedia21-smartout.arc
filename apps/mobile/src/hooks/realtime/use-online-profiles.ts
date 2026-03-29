/**
 * useOnlineProfiles — Tracks which workspace colleagues are currently online.
 *
 * Subscribes to a Supabase Realtime presence channel scoped to the workspace.
 * Each client announces { profileId, displayName, avatarUrl } on mount.
 * Returns a deduplicated list of online profiles (excluding the current user).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

export type OnlineProfile = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
};

export function useOnlineProfiles() {
  const { data: myProfile } = useMyProfile();
  const [onlineProfiles, setOnlineProfiles] = useState<OnlineProfile[]>([]);

  useEffect(() => {
    if (!myProfile?.workspace_id || !myProfile?.profile_id) return;

    const channelName = `online:${myProfile.workspace_id}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: myProfile.profile_id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineProfile>();
        const profiles: OnlineProfile[] = [];
        const seen = new Set<string>();

        for (const [key, presences] of Object.entries(state)) {
          if (key === myProfile.profile_id) continue;
          for (const p of presences) {
            if (!seen.has(p.profileId)) {
              seen.add(p.profileId);
              profiles.push({
                profileId: p.profileId,
                displayName: p.displayName,
                avatarUrl: p.avatarUrl,
              });
            }
          }
        }

        setOnlineProfiles(profiles);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            profileId: myProfile.profile_id,
            displayName: myProfile.display_name ?? "",
            avatarUrl: myProfile.avatar_url ?? null,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    myProfile?.workspace_id,
    myProfile?.profile_id,
    myProfile?.display_name,
    myProfile?.avatar_url,
  ]);

  return onlineProfiles;
}
