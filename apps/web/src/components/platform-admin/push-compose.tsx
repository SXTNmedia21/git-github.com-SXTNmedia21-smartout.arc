"use client";

import { Bell, Link } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

const MAX_TITLE = 50;
const MAX_BODY = 200;

type PushComposeProps = {
  title: string;
  body: string;
  actionUrl: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onActionUrlChange: (v: string) => void;
};

/**
 * Push notification compose editor with a mock iOS notification preview.
 * Title is limited to 50 chars, body to 200 chars.
 */
export function PushCompose({
  title,
  body,
  actionUrl,
  onTitleChange,
  onBodyChange,
  onActionUrlChange,
}: PushComposeProps) {
  const titleNearLimit = title.length > MAX_TITLE - 10;
  const bodyNearLimit = body.length > MAX_BODY - 30;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="push-title">Title</Label>
          <span
            className={`text-xs ${titleNearLimit ? "text-destructive" : "text-muted-foreground"}`}
          >
            {title.length}/{MAX_TITLE}
          </span>
        </div>
        <Input
          id="push-title"
          placeholder="Notification title"
          value={title}
          onChange={(e) => {
            if (e.target.value.length <= MAX_TITLE) {
              onTitleChange(e.target.value);
            }
          }}
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="push-body">Body</Label>
          <span
            className={`text-xs ${bodyNearLimit ? "text-destructive" : "text-muted-foreground"}`}
          >
            {body.length}/{MAX_BODY}
          </span>
        </div>
        <Textarea
          id="push-body"
          placeholder="Notification body text..."
          value={body}
          onChange={(e) => {
            if (e.target.value.length <= MAX_BODY) {
              onBodyChange(e.target.value);
            }
          }}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Action URL */}
      <div className="space-y-1.5">
        <Label htmlFor="push-action-url" className="flex items-center gap-1.5">
          <Link className="h-3.5 w-3.5" />
          Action URL
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Input
          id="push-action-url"
          placeholder="https://app.smartout.ai/..."
          value={actionUrl}
          onChange={(e) => onActionUrlChange(e.target.value)}
        />
      </div>

      {/* iOS-style notification preview */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs tracking-wide uppercase">Preview</Label>
        <Card className="bg-muted/50 mx-auto max-w-sm overflow-hidden p-0">
          <div className="flex items-start gap-3 p-3">
            {/* App icon */}
            <div className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Bell className="text-primary-foreground h-5 w-5" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide uppercase">Smartout</span>
                <span className="text-muted-foreground text-xs">now</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold">
                {title || "Notification title"}
              </p>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                {body || "Notification body text will appear here..."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
