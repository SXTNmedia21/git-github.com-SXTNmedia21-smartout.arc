"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  SERVICE_REGISTRY,
  type ServiceEntry,
  type ServiceTab,
  TAB_LABELS,
} from "./service-registry";

type CreateSecretDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /** Pre-select a service (e.g. when clicking "Set Secret" from the table) */
  preselectedService?: ServiceEntry;
};

export function CreateSecretDialog({
  open,
  onOpenChange,
  onCreated,
  preselectedService,
}: CreateSecretDialogProps) {
  const [serviceKey, setServiceKey] = useState(preselectedService?.key ?? "");
  const [secretValue, setSecretValue] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [description, setDescription] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedService = SERVICE_REGISTRY.find((s) => s.key === serviceKey);

  function resetForm() {
    setServiceKey(preselectedService?.key ?? "");
    setSecretValue("");
    setEnvironment("live");
    setDescription("");
    setShowSecret(false);
    setSuccess(false);
  }

  function handleClose(newOpen: boolean) {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  }

  async function handleSubmit() {
    if (!serviceKey) {
      toast.error("Select a service");
      return;
    }
    if (!secretValue.trim()) {
      toast.error("Secret value is required");
      return;
    }

    const service = SERVICE_REGISTRY.find((s) => s.key === serviceKey);
    if (!service) {
      toast.error("Invalid service");
      return;
    }

    // Validate prefix if the service has one
    if (service.prefix && !secretValue.startsWith(service.prefix)) {
      toast.error(
        `${service.label} values typically start with "${service.prefix}". Check the value and try again.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/platform-admin/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: service.provider,
          vault_secret_name: service.key,
          secret_value: secretValue.trim(),
          environment,
          description: description.trim() || `${service.label} (${service.envVar})`,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to save secret");
        return;
      }

      setSuccess(true);
      onCreated();
      toast.success(`${service.label} saved`);
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // Group services by tab for the dropdown
  const servicesByTab = SERVICE_REGISTRY.reduce(
    (acc, s) => {
      if (!acc[s.tab]) acc[s.tab] = [];
      acc[s.tab].push(s);
      return acc;
    },
    {} as Record<ServiceTab, ServiceEntry[]>,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{success ? "Secret Saved" : "Add External Secret"}</DialogTitle>
          <DialogDescription>
            {success
              ? "The secret has been encrypted and stored in Vault."
              : "Store an external API key or secret in the encrypted vault."}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-muted-foreground text-sm">
              {selectedService?.label} has been securely stored.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* Service selector */}
            <div className="grid gap-2">
              <Label>Service</Label>
              <Select
                value={serviceKey}
                onValueChange={setServiceKey}
                disabled={!!preselectedService}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(servicesByTab) as [ServiceTab, ServiceEntry[]][]).map(
                    ([tab, services]) => (
                      <div key={tab}>
                        <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                          {TAB_LABELS[tab]}
                        </div>
                        {services.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{s.envVar}</span>
                          </SelectItem>
                        ))}
                      </div>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Secret value */}
            <div className="grid gap-2">
              <Label htmlFor="secret-value">
                Secret Value
                {selectedService?.prefix && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (starts with {selectedService.prefix})
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="secret-value"
                  type={showSecret ? "text" : "password"}
                  placeholder={
                    selectedService?.prefix
                      ? `${selectedService.prefix}...`
                      : "Paste your secret here..."
                  }
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">{showSecret ? "Hide" : "Show"} secret</span>
                </Button>
              </div>
            </div>

            {/* Environment */}
            <div className="grid gap-2">
              <Label>Environment</Label>
              <Select
                value={environment}
                onValueChange={(v) => setEnvironment(v as "live" | "test")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="secret-desc">Description (optional)</Label>
              <Textarea
                id="secret-desc"
                placeholder={
                  selectedService
                    ? `${selectedService.label} (${selectedService.envVar})`
                    : "What is this secret used for?"
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {success ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Secret
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
