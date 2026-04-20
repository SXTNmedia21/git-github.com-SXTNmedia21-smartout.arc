"use client";

import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ClipboardList,
  Info,
  Link,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_TITLE = 200;
const MAX_BODY = 1000;

const ICON_OPTIONS = [
  { value: "shift", label: "Shift", icon: Calendar },
  { value: "task", label: "Task", icon: ClipboardList },
  { value: "training", label: "Training", icon: BookOpen },
  { value: "chat", label: "Chat", icon: MessageSquare },
  { value: "deviation", label: "Deviation", icon: AlertTriangle },
  { value: "approval", label: "Approval", icon: CheckCircle },
  { value: "info", label: "Info", icon: Info },
] as const;

const MODE_OPTIONS = [
  { value: "training", label: "Training" },
  { value: "work", label: "Work" },
  { value: "community", label: "Community" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "0", label: "Normal" },
  { value: "1", label: "High" },
  { value: "2", label: "Critical" },
] as const;

export type InAppComposeProps = {
  title: string;
  body: string;
  actionUrl: string;
  mode: "training" | "work" | "community";
  priority: "0" | "1" | "2";
  iconType: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onActionUrlChange: (v: string) => void;
  onModeChange: (v: "training" | "work" | "community") => void;
  onPriorityChange: (v: "0" | "1" | "2") => void;
  onIconTypeChange: (v: string) => void;
};

/** Resolve the Lucide icon component for a given icon type string. */
function getIconComponent(iconType: string) {
  const match = ICON_OPTIONS.find((opt) => opt.value === iconType);
  return match?.icon ?? Bell;
}

/**
 * In-app notification compose editor with mode, priority, and icon selectors.
 * Includes a mock notification bell item preview.
 */
export function InAppCompose({
  title,
  body,
  actionUrl,
  mode,
  priority,
  iconType,
  onTitleChange,
  onBodyChange,
  onActionUrlChange,
  onModeChange,
  onPriorityChange,
  onIconTypeChange,
}: InAppComposeProps) {
  const titleNearLimit = title.length > MAX_TITLE - 30;
  const bodyNearLimit = body.length > MAX_BODY - 100;

  const Icon = ICON_OPTIONS.find((opt) => opt.value === iconType)?.icon ?? Bell;

  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? "Normal";

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="inapp-title">Title</Label>
          <span
            className={`text-xs ${titleNearLimit ? "text-destructive" : "text-muted-foreground"}`}
          >
            {title.length}/{MAX_TITLE}
          </span>
        </div>
        <Input
          id="inapp-title"
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
          <Label htmlFor="inapp-body">Body</Label>
          <span
            className={`text-xs ${bodyNearLimit ? "text-destructive" : "text-muted-foreground"}`}
          >
            {body.length}/{MAX_BODY}
          </span>
        </div>
        <Textarea
          id="inapp-body"
          placeholder="Notification body..."
          value={body}
          onChange={(e) => {
            if (e.target.value.length <= MAX_BODY) {
              onBodyChange(e.target.value);
            }
          }}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Action URL */}
      <div className="space-y-1.5">
        <Label htmlFor="inapp-action-url" className="flex items-center gap-1.5">
          <Link className="h-3.5 w-3.5" />
          Action URL
        </Label>
        <Input
          id="inapp-action-url"
          placeholder="https://app.smartout.ai/..."
          value={actionUrl}
          onChange={(e) => onActionUrlChange(e.target.value)}
        />
      </div>

      {/* Selectors row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Mode */}
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={onModeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={onPriorityChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Icon type */}
        <div className="space-y-1.5">
          <Label>Icon</Label>
          <Select value={iconType} onValueChange={onIconTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICON_OPTIONS.map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <OptIcon className="h-3.5 w-3.5" />
                      {opt.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notification bell item preview */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs tracking-wide uppercase">Preview</Label>
        <Card className="bg-muted/50 p-0">
          <div className="flex items-start gap-3 p-3">
            {/* Icon circle */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                priority === "2"
                  ? "bg-destructive/10 text-destructive"
                  : priority === "1"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium">{title || "Notification title"}</p>
                <span className="text-muted-foreground ml-2 shrink-0 text-xs">Just now</span>
              </div>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                {body || "Notification body text will appear here..."}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                  {mode}
                </span>
                {priority !== "0" && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      priority === "2"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {priorityLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
