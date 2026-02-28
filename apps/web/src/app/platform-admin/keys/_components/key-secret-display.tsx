"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type KeySecretDisplayProps = {
  secretKey: string;
  label?: string;
};

export function KeySecretDisplay({ secretKey, label = "API Key" }: KeySecretDisplayProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(secretKey);
    setCopied(true);
    toast.success("Key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span>Store this {label} securely — it will not be shown again</span>
      </div>
      <div className="bg-muted flex items-center gap-2 rounded-lg border p-3">
        <code className="flex-1 font-mono text-sm break-all">
          {revealed ? secretKey : "\u2022".repeat(Math.min(secretKey.length, 48))}
        </code>
        <Button variant="ghost" size="sm" onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
