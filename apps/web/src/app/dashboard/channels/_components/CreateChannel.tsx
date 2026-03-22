"use client";

import { useState } from "react";
import { useCreateChannel } from "../_hooks/use-create-channel";
import type { ChannelType } from "../_hooks/channel-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Hash, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  profileId: string;
  onClose: () => void;
  onCreated: (channelId: string) => void;
};

export function CreateChannel({ profileId, onClose, onCreated }: Props) {
  const [channelType, setChannelType] = useState<ChannelType>("custom");
  const [name, setName] = useState("");
  const createChannel = useCreateChannel(profileId);

  const handleCreate = () => {
    if (channelType === "custom" && !name.trim()) return;

    createChannel.mutate(
      {
        channelType,
        name: channelType === "custom" ? name.trim() : undefined,
      },
      {
        onSuccess: (result) => {
          onCreated(result.channel_id);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card w-full max-w-md rounded-lg border shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Opprett kanal</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setChannelType("custom")}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md border p-3 transition-colors",
                  channelType === "custom"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <Hash className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">Kanal</p>
                  <p className="text-muted-foreground text-xs">
                    Gruppesamtale for teamet
                  </p>
                </div>
              </button>
              <button
                onClick={() => setChannelType("direct")}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md border p-3 transition-colors",
                  channelType === "direct"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <MessageCircle className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">Direkte</p>
                  <p className="text-muted-foreground text-xs">
                    1-til-1 melding
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Name (custom only) */}
          {channelType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-xs">
                Navn
              </Label>
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="f.eks. #kjokkenet"
                className="h-9"
                autoFocus
              />
            </div>
          )}

          {/* Direct: member selection placeholder */}
          {channelType === "direct" && (
            <div className="rounded-md border border-dashed p-4 text-center">
              <p className="text-muted-foreground text-xs">
                Velg en person fra medarbeiderlisten for a starte en
                direktemelding.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={
              createChannel.isPending ||
              (channelType === "custom" && !name.trim()) ||
              channelType === "direct" // Disabled until member selection is built
            }
          >
            Opprett
          </Button>
        </div>
      </div>
    </div>
  );
}
