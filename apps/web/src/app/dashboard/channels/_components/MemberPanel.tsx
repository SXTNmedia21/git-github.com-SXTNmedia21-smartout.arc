"use client";

import { useChannelMembers } from "../_hooks/use-channel-members";
import { Button } from "@/components/ui/button";
import { X, Bot, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  profileId: string;
  onClose: () => void;
};

export function MemberPanel({ channelId, profileId, onClose }: Props) {
  const { data: members, isLoading } = useChannelMembers(channelId);

  return (
    <div className="flex w-64 flex-shrink-0 flex-col border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h3 className="text-sm font-semibold">Medlemmer</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
                <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {(members ?? []).map((member) => {
              const profile = member.profile;
              const isAi = member.is_ai;
              const isAdmin = member.role === "admin";
              const isSelf = member.profile_id === profileId;

              return (
                <div
                  key={member.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5",
                    isSelf && "bg-accent/50",
                  )}
                >
                  <div className="relative">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        (profile.display_name ?? "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    {isAi && (
                      <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-500 p-0.5">
                        <Bot className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {profile.display_name ?? "Ukjent"}
                      {isSelf && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (deg)
                        </span>
                      )}
                    </p>
                  </div>
                  {isAdmin && (
                    <Shield className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
