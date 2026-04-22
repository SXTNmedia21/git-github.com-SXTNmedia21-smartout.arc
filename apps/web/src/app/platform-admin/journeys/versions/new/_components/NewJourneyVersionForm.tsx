// ============================================
// NewJourneyVersionForm.tsx — creation form client
//
// Collects parent journey, slug, title, module. Server Action creates
// the row and returns its ID; form redirects to the detail editor.
// ============================================

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJourneyVersionAction } from "../../actions/create-journey-version";

export type ParentJourneyOption = {
  journeyId: string;
  slug: string;
  title: string;
  module: string;
};

export function NewJourneyVersionForm({
  parentJourneys,
}: {
  parentJourneys: ReadonlyArray<ParentJourneyOption>;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [journeyId, setJourneyId] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!journeyId) {
      toast.error("Pick a parent journey.");
      return;
    }
    startTransition(async () => {
      const res = await createJourneyVersionAction({
        journeyId,
        slug,
        title,
        module: moduleName,
      });
      if (res.ok) {
        toast.success("Version created");
        router.push(`/platform-admin/journeys/versions/${res.journeyVersionId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  // Auto-fill slug + module from the parent journey so most fields carry
  // over on first pick. Admins can still edit before submitting.
  function handleJourneyPick(id: string) {
    setJourneyId(id);
    const j = parentJourneys.find((p) => p.journeyId === id);
    if (j) {
      if (!slug) setSlug(j.slug);
      if (!title) setTitle(j.title);
      if (!moduleName) setModuleName(j.module);
    }
  }

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 35, damping: 22, mass: 2.2 }
      }
    >
      <Card className="border-border bg-background">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="parent-journey" className="text-foreground text-xs font-medium">
              Parent journey
            </Label>
            <Select value={journeyId} onValueChange={handleJourneyPick}>
              <SelectTrigger
                id="parent-journey"
                className="bg-background border-border text-foreground min-h-11"
              >
                <SelectValue placeholder="Pick a parent journey" />
              </SelectTrigger>
              <SelectContent>
                {parentJourneys.map((j) => (
                  <SelectItem key={j.journeyId} value={j.journeyId}>
                    {j.title}{" "}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{j.slug}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-foreground text-xs font-medium">
              Slug
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="onboarding-employee"
              className="bg-background border-border text-foreground min-h-11 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-foreground text-xs font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Employee onboarding"
              className="bg-background border-border text-foreground min-h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="module" className="text-foreground text-xs font-medium">
              Module
            </Label>
            <Input
              id="module"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="onboarding"
              className="bg-background border-border text-foreground min-h-11"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="min-h-11"
            >
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={isPending} className="min-h-11">
              <Plus className="mr-1.5 h-4 w-4" />
              Create Version
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
