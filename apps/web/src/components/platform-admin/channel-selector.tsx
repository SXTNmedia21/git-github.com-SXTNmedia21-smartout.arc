"use client";

import { Bell, BellRing, Hash, Mail, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Communication channel types available for platform admin messaging.
 */
export type CommunicationChannel = "email" | "sms" | "push" | "in_app" | "channel_message";

type ChannelSelectorProps = {
  value: CommunicationChannel[];
  onChange: (channels: CommunicationChannel[]) => void;
  disabled?: boolean;
};

const CHANNELS: {
  id: CommunicationChannel;
  label: string;
  icon: typeof Mail;
}[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "push", label: "Push", icon: Bell },
  { id: "in_app", label: "In-App", icon: BellRing },
  { id: "channel_message", label: "Channel", icon: Hash },
];

export function ChannelSelector({ value, onChange, disabled = false }: ChannelSelectorProps) {
  function toggle(channel: CommunicationChannel) {
    if (value.includes(channel)) {
      onChange(value.filter((c) => c !== channel));
    } else {
      onChange([...value, channel]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {CHANNELS.map(({ id, label, icon: Icon }) => {
          const selected = value.includes(id);
          return (
            <Button
              key={id}
              type="button"
              variant={selected ? "default" : "outline"}
              disabled={disabled}
              onClick={() => toggle(id)}
              className="flex h-auto flex-col items-center gap-1 px-2 py-3"
            >
              <Icon className="size-5" />
              <span className="text-xs">{label}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {value.length === 0
          ? "No channels selected"
          : `${value.length} channel${value.length === 1 ? "" : "s"} selected`}
      </p>
    </div>
  );
}
