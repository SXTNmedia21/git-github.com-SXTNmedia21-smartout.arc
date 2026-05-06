"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  CreditCard,
  Mail,
  MessageSquare,
  FileSignature,
  BarChart3,
  Bug,
  Database,
  Brain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ExternalService = {
  name: string;
  configured: boolean;
  envVar: string;
};

type ExternalServicesCardProps = {
  services: ExternalService[];
};

const iconMap: Record<string, LucideIcon> = {
  Stripe: CreditCard,
  SendGrid: Mail,
  Twilio: MessageSquare,
  DocuSeal: FileSignature,
  PostHog: BarChart3,
  Sentry: Bug,
  "Upstash Redis": Database,
  OpenRouter: Brain,
};

export function ExternalServicesCard({ services }: ExternalServicesCardProps) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-medium">External Services</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {services.map((s) => {
          const Icon = iconMap[s.name] ?? Database;
          return (
            <div
              key={s.name}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2",
                s.configured ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-muted",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  s.configured ? "text-emerald-500" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{s.name}</p>
                <p
                  className={cn(
                    "text-[10px]",
                    s.configured ? "text-emerald-500" : "text-muted-foreground",
                  )}
                >
                  {s.configured ? "Configured" : "Not configured"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
