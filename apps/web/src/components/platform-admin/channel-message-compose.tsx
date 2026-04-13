"use client";

import { Megaphone, Bell, MessageSquare, Monitor } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_CONTENT = 5000;

type MessageType = "announcement" | "reminder" | "text";

type ChannelMessageComposeProps = {
  content: string;
  messageType: MessageType;
  pin: boolean;
  onContentChange: (v: string) => void;
  onMessageTypeChange: (v: MessageType) => void;
  onPinChange: (v: boolean) => void;
};

const MESSAGE_TYPE_CONFIG: Record<
  MessageType,
  { label: string; icon: typeof Megaphone; variant: "default" | "secondary" | "outline" }
> = {
  announcement: { label: "Announcement", icon: Megaphone, variant: "default" },
  reminder: { label: "Reminder", icon: Bell, variant: "secondary" },
  text: { label: "Text", icon: MessageSquare, variant: "outline" },
};

/**
 * Compose editor for channel messages with message type selection,
 * pin toggle, character counter, and a live preview card.
 */
export function ChannelMessageCompose({
  content,
  messageType,
  pin,
  onContentChange,
  onMessageTypeChange,
  onPinChange,
}: ChannelMessageComposeProps) {
  const nearLimit = content.length > MAX_CONTENT - 200;
  const config = MESSAGE_TYPE_CONFIG[messageType];
  const PreviewIcon = config.icon;

  return (
    <div className="space-y-4">
      {/* Message type */}
      <div className="space-y-1.5">
        <Label htmlFor="message-type">Message Type</Label>
        <Select value={messageType} onValueChange={(v) => onMessageTypeChange(v as MessageType)}>
          <SelectTrigger id="message-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="announcement">
              <span className="flex items-center gap-2">
                <Megaphone className="size-4" />
                Announcement
              </span>
            </SelectItem>
            <SelectItem value="reminder">
              <span className="flex items-center gap-2">
                <Bell className="size-4" />
                Reminder
              </span>
            </SelectItem>
            <SelectItem value="text">
              <span className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                Text
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="channel-content">Content</Label>
          <span className={`text-xs ${nearLimit ? "text-destructive" : "text-muted-foreground"}`}>
            {content.length}/{MAX_CONTENT}
          </span>
        </div>
        <Textarea
          id="channel-content"
          placeholder="Write your message..."
          value={content}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CONTENT) {
              onContentChange(e.target.value);
            }
          }}
          rows={5}
          className="resize-none"
        />
      </div>

      {/* Pin toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="pin-message" className="text-sm font-medium">
            Pin this message
          </Label>
          <p className="text-muted-foreground text-xs">
            Pinned messages stay visible at the top of the channel.
          </p>
        </div>
        <Switch id="pin-message" checked={pin} onCheckedChange={onPinChange} />
      </div>

      {/* Preview */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs tracking-wide uppercase">Preview</Label>
        <Card className="bg-muted/50 overflow-hidden p-0">
          <div className="flex items-start gap-3 p-4">
            {/* System origin icon */}
            <div className="bg-primary flex size-9 shrink-0 items-center justify-center rounded-full">
              <Monitor className="text-primary-foreground size-4" />
            </div>

            {/* Message content */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Platform Admin</span>
                <Badge variant={config.variant} className="px-1.5 py-0 text-[10px]">
                  {config.label}
                </Badge>
                {pin && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    Pinned
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {content || "Your message will appear here..."}
              </p>
              <div className="flex items-center gap-1.5">
                <PreviewIcon className="text-muted-foreground size-3" />
                <span className="text-muted-foreground text-xs">System &middot; just now</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
