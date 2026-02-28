"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { KeySecretDisplay } from "./key-secret-display";

type Workspace = {
  workspace_id: string;
  name: string;
};

type CreateKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateKeyDialog({ open, onOpenChange, onCreated }: CreateKeyDialogProps) {
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState<"workspace" | "service">("workspace");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [rateLimit, setRateLimit] = useState(60);
  const [expiresAt, setExpiresAt] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Fetch workspaces for the dropdown
    fetch("/api/platform-admin/workspaces")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setWorkspaces(json.data);
      })
      .catch(() => {});
  }, [open]);

  function resetForm() {
    setName("");
    setKeyType("workspace");
    setEnvironment("live");
    setWorkspaceId("");
    setDescription("");
    setRateLimit(60);
    setExpiresAt("");
    setCreatedKey(null);
  }

  function handleClose(newOpen: boolean) {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (keyType === "workspace" && !workspaceId) {
      toast.error("Select a workspace for workspace keys");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/platform-admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key_type: keyType,
          environment,
          workspace_id: keyType === "workspace" ? workspaceId : undefined,
          description: description.trim() || undefined,
          rate_limit_per_minute: rateLimit,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to create key");
        return;
      }

      setCreatedKey(json.data.plaintext_key);
      onCreated();
      toast.success("API key created");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{createdKey ? "Key Created" : "Create API Key"}</DialogTitle>
          <DialogDescription>
            {createdKey
              ? "Your new API key has been created successfully."
              : "Create a new API key for workspace access or service-to-service auth."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="py-4">
            <KeySecretDisplay secretKey={createdKey} />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production API Key"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={keyType}
                  onValueChange={(v) => setKeyType(v as "workspace" | "service")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">Workspace</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
            </div>

            {keyType === "workspace" && (
              <div className="grid gap-2">
                <Label>Workspace</Label>
                <Select value={workspaceId} onValueChange={setWorkspaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="key-desc">Description (optional)</Label>
              <Textarea
                id="key-desc"
                placeholder="What is this key used for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rate-limit">Rate Limit (req/min)</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min={1}
                  max={10000}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="expires-at">Expiry (optional)</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdKey ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Key
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
