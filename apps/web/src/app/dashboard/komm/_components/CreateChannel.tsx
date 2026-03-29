"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCreateChannel } from "../_hooks/use-create-channel";
import type { ChannelType } from "../_hooks/channel-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Hash, MessageCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";

type Props = {
  profileId: string;
  onClose: () => void;
  onCreated: (channelId: string) => void;
};

type WorkspaceMember = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
};

function useWorkspaceMembers(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, role")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .neq("profile_id", profileId)
        .neq("role", "system")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as WorkspaceMember[];
    },
  });
}

export function CreateChannel({ profileId, onClose, onCreated }: Props) {
  const { t } = useTranslation("komm");
  const [channelType, setChannelType] = useState<ChannelType>("custom");
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const createChannel = useCreateChannel(profileId);
  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(profileId);

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!filter) return members;
    const lower = filter.toLowerCase();
    return members.filter((m) => m.display_name?.toLowerCase().includes(lower));
  }, [members, filter]);

  const handleCreate = () => {
    if (channelType === "custom" && !name.trim()) return;
    if (channelType === "direct" && !selectedMemberId) return;

    createChannel.mutate(
      {
        channelType,
        name: channelType === "custom" ? name.trim() : undefined,
        memberProfileIds:
          channelType === "direct" && selectedMemberId ? [profileId, selectedMemberId] : undefined,
      },
      {
        onSuccess: (result) => {
          onCreated(result.channel_id);
        },
      },
    );
  };

  const canCreate =
    !createChannel.isPending &&
    ((channelType === "custom" && name.trim().length > 0) ||
      (channelType === "direct" && selectedMemberId !== null));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label className="text-xs">{t("create.type_label")}</Label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setChannelType("custom");
                  setSelectedMemberId(null);
                }}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md border p-3 transition-colors",
                  channelType === "custom"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <Hash className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">{t("create.channel_option")}</p>
                  <p className="text-muted-foreground text-xs">{t("create.channel_sublabel")}</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setChannelType("direct");
                  setName("");
                }}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md border p-3 transition-colors",
                  channelType === "direct"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <MessageCircle className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">{t("create.direct_option")}</p>
                  <p className="text-muted-foreground text-xs">{t("create.direct_sublabel")}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Custom: name input */}
          {channelType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-xs">
                {t("create.name_label")}
              </Label>
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("create.name_placeholder")}
                className="h-9"
                autoFocus
              />
            </div>
          )}

          {/* Direct: people list */}
          {channelType === "direct" && (
            <div className="space-y-2">
              <Label className="text-xs">{t("create.select_person")}</Label>
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("create.filter_placeholder")}
                className="h-9"
                autoFocus
              />
              <ScrollArea className="h-48 rounded-md border">
                {membersLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-muted-foreground text-xs">{t("create.loading")}</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-muted-foreground text-xs">{t("create.no_members_found")}</p>
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredMembers.map((member) => {
                      const isSelected = member.profile_id === selectedMemberId;
                      return (
                        <button
                          key={member.profile_id}
                          onClick={() => setSelectedMemberId(isSelected ? null : member.profile_id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                            isSelected
                              ? "bg-primary/10 border-primary/30 border"
                              : "hover:bg-accent/50",
                          )}
                        >
                          <Avatar className="h-8 w-8">
                            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                            <AvatarFallback className="text-xs">
                              {(member.display_name ?? "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {member.display_name ?? t("create.unknown")}
                            </p>
                            <p className="text-muted-foreground text-xs capitalize">
                              {member.role}
                            </p>
                          </div>
                          {isSelected && <Check className="text-primary h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!canCreate}>
            {createChannel.isPending ? t("create.creating") : t("create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
