"use client";

import { useState } from "react";
import { Settings, Trash2, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import type { ServiceEntry } from "./service-registry";
import { CreateSecretDialog } from "./create-secret-dialog";

type SecretStatus = {
  configured: boolean;
  environment: string;
};

type KeySettingsPopoverProps = {
  service: ServiceEntry;
  status: SecretStatus;
  onUpdated: () => void;
};

export function KeySettingsPopover({ service, status, onUpdated }: KeySettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [environment, setEnvironment] = useState(status.environment || "live");
  const [deleting, setDeleting] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete ${service.label}? This will remove the secret from Vault.`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/platform-admin/secrets/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          keys: [service.key],
        }),
      });

      if (!res.ok) {
        toast.error("Failed to delete secret");
        return;
      }

      toast.success(`${service.label} deleted`);
      onUpdated();
      setOpen(false);
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings for {service.label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="space-y-3">
            <div className="text-sm font-medium">{service.label}</div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs">Environment</label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => {
                  setOpen(false);
                  setSecretDialogOpen(true);
                }}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {status.configured ? "Rotate Secret" : "Set Secret"}
              </Button>

              {status.configured && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive justify-start gap-2 text-xs"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete Secret
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <CreateSecretDialog
        open={secretDialogOpen}
        onOpenChange={setSecretDialogOpen}
        onCreated={onUpdated}
        preselectedService={service}
      />
    </>
  );
}
