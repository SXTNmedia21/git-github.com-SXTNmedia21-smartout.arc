"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AddServiceDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<string>("docker");
  const [description, setDescription] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [port, setPort] = useState("");
  const [dockerServiceName, setDockerServiceName] = useState("");
  const [healthEndpoint, setHealthEndpoint] = useState("/health");
  const [isCritical, setIsCritical] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name,
        slug: slug || slugify(name),
        type,
        description: description || undefined,
        health_endpoint: healthEndpoint,
        is_critical: isCritical,
      };
      if (hostUrl) body.host_url = hostUrl;
      if (port) body.port = parseInt(port, 10);
      if (dockerServiceName) body.docker_service_name = dockerServiceName;

      const res = await fetch("/api/platform-admin/services/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "services", "config"],
      });
      toast.success("Service created");
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function resetForm() {
    setName("");
    setSlug("");
    setType("docker");
    setDescription("");
    setHostUrl("");
    setPort("");
    setDockerServiceName("");
    setHealthEndpoint("/health");
    setIsCritical(false);
  }

  const showDocker = type === "docker";
  const showUrl = type === "docker" || type === "external";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) {
                  setSlug(slugify(e.target.value));
                }
              }}
              placeholder="My Service"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-service"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="docker">Docker</SelectItem>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="edge-function">Edge Function</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this service do?"
              rows={2}
            />
          </div>

          {showUrl && (
            <div className="space-y-1.5">
              <Label>Host URL</Label>
              <Input
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                placeholder="http://localhost:5010"
              />
            </div>
          )}

          {showDocker && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="5010"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Docker Service Name</Label>
                  <Input
                    value={dockerServiceName}
                    onChange={(e) => setDockerServiceName(e.target.value)}
                    placeholder="my-service"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Health Endpoint</Label>
            <Input
              value={healthEndpoint}
              onChange={(e) => setHealthEndpoint(e.target.value)}
              placeholder="/health"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is-critical"
              checked={isCritical}
              onCheckedChange={setIsCritical}
            />
            <Label htmlFor="is-critical">Critical service</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
