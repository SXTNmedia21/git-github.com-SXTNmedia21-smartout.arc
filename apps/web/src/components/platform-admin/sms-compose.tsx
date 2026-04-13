"use client";

import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 1600;
const SEGMENT_SIZE = 160;

type SmsComposeProps = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * SMS compose editor with character counting and segment indicator.
 * Each SMS segment is 160 characters — messages beyond that are split
 * into multiple segments, increasing cost.
 */
export function SmsCompose({ value, onChange }: SmsComposeProps) {
  const charCount = value.length;
  const segments = charCount === 0 ? 0 : Math.ceil(charCount / SEGMENT_SIZE);
  const isMultiSegment = segments > 1;
  const isNearLimit = charCount > MAX_CHARS - 100;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sms-body">Message</Label>
        <Textarea
          id="sms-body"
          placeholder="Write your SMS message..."
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) {
              onChange(e.target.value);
            }
          }}
          rows={5}
          className="resize-none font-mono text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            isOverLimit
              ? "text-destructive font-medium"
              : isNearLimit
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {charCount}/{MAX_CHARS}
          {segments > 0 && (
            <span className="ml-2">
              · {segments} {segments === 1 ? "segment" : "segments"}
            </span>
          )}
        </span>
      </div>

      {isMultiSegment && (
        <div className="bg-warning/10 text-warning-foreground flex items-start gap-2 rounded-md border border-amber-200 px-3 py-2 dark:border-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This message will be sent as {segments} SMS segments. Each segment is billed separately,
            increasing the cost per recipient.
          </p>
        </div>
      )}
    </div>
  );
}
