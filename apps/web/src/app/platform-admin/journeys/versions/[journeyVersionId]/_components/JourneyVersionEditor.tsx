// ============================================
// JourneyVersionEditor.tsx — main detail/edit client for one journey_version
//
// Composes:
//   - metadata form (slug, title, module)
//   - JourneyStepsEditor (delegates action slot to StepActionEditor)
//   - status transition toolbar
//
// All mutations go through Server Actions under ../../actions/. Zod
// validation happens in the action; this client validates only UX-level
// concerns (required fields filled) and calls the action.
// ============================================

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArchiveIcon,
  CheckCircle2,
  ClipboardCheck,
  ClockIcon,
  Hourglass,
  Rocket,
  Save,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import type { JourneyIR } from "@smartout/journey-ir";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveJourneyVersionDraftAction } from "../../actions/save-draft";
import { transitionJourneyVersionStatusAction } from "../../actions/transition-status";
import { publishMissionAction } from "../../actions/publish-mission";
import { publishGuideAction } from "../../actions/publish-guide";
import {
  ALLOWED_TRANSITIONS,
  STATUS_DESCRIPTION,
  STATUS_LABEL,
  type JourneyVersionStatus,
} from "../../_lib/version-status";
import { StatusBadge } from "../../_components/StatusBadge";
import {
  JourneyStepsEditor,
  draftFromIrStep,
  irStepFromDraft,
  type DraftStep,
} from "./JourneyStepsEditor";

export interface JourneyVersionEditorProps {
  journeyVersionId: string;
  initialStatus: JourneyVersionStatus;
  initialVersionNumber: number;
  initialIr: JourneyIR;
}

type DraftMeta = {
  slug: string;
  title: string;
  module: string;
};

// Transition labels for the toolbar buttons. Uses tokens/icons only; no
// raw colors. Ordering is the natural lifecycle progression.
const TRANSITION_META: Record<
  JourneyVersionStatus,
  { Icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  draft: { Icon: Save, label: "Return to Draft" },
  ready_test: { Icon: ClipboardCheck, label: "Submit for Test" },
  testing: { Icon: Hourglass, label: "Mark Testing" },
  ready_publish: { Icon: CheckCircle2, label: "Mark Ready to Publish" },
  published: { Icon: Rocket, label: "Mark Published" },
  archived: { Icon: ArchiveIcon, label: "Archive" },
};

export function JourneyVersionEditor({
  journeyVersionId,
  initialStatus,
  initialVersionNumber,
  initialIr,
}: JourneyVersionEditorProps) {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [status, setStatus] = useState<JourneyVersionStatus>(initialStatus);
  const [meta, setMeta] = useState<DraftMeta>({
    slug: initialIr.slug,
    title: initialIr.title,
    module: initialIr.module,
  });
  const [steps, setSteps] = useState<DraftStep[]>(initialIr.steps.map(draftFromIrStep));
  const [isPending, startTransition] = useTransition();

  const readOnly = status === "published" || status === "archived";

  function buildIr(): JourneyIR {
    return {
      version: initialIr.version,
      slug: meta.slug,
      title: meta.title,
      module: meta.module,
      steps: steps.map(irStepFromDraft),
    };
  }

  function save() {
    const ir = buildIr();
    startTransition(async () => {
      const res = await saveJourneyVersionDraftAction({
        journeyVersionId,
        ir,
      });
      if (res.ok) {
        toast.success("Saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function transitionTo(to: JourneyVersionStatus) {
    startTransition(async () => {
      const res = await transitionJourneyVersionStatusAction({
        journeyVersionId,
        toStatus: to,
      });
      if (res.ok) {
        setStatus(to);
        toast.success(`Status → ${STATUS_LABEL[to]}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function publishMission() {
    startTransition(async () => {
      const res = await publishMissionAction({ journeyVersionId });
      if (res.ok) {
        setStatus("published");
        toast.success(`Mission published · run ${res.runId.slice(0, 8)}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function publishGuide() {
    startTransition(async () => {
      const res = await publishGuideAction({ journeyVersionId });
      if (res.ok) {
        toast.success(`Guide published · run ${res.runId.slice(0, 8)}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const allowed = ALLOWED_TRANSITIONS[status];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 35, damping: 22, mass: 2.2 }
        }
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-foreground text-2xl">
              {meta.title || "Untitled journey"}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            {meta.slug || "no-slug"} · v{initialVersionNumber}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">{STATUS_DESCRIPTION[status]}</p>
        </div>

        {/* Toolbar — status transitions + publish actions */}
        <div
          role="toolbar"
          aria-label="Journey version actions"
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            type="button"
            onClick={save}
            disabled={readOnly || isPending}
            className="min-h-11"
          >
            <Save className="mr-1.5 h-4 w-4" />
            Save Draft
          </Button>

          {/* Context-sensitive transitions — only show allowed next states */}
          {allowed
            .filter((to) => to !== "published" && to !== "archived")
            .map((to) => {
              const meta = TRANSITION_META[to];
              return (
                <Button
                  key={to}
                  type="button"
                  variant="outline"
                  onClick={() => transitionTo(to)}
                  disabled={isPending}
                  className="min-h-11"
                >
                  <meta.Icon className="mr-1.5 h-4 w-4" />
                  {meta.label}
                </Button>
              );
            })}

          {/* Publish actions only visible from ready_publish. Mission publish
              also advances status to 'published' — see publishMissionAction. */}
          {status === "ready_publish" && (
            <>
              <Button
                type="button"
                onClick={publishMission}
                disabled={isPending}
                className="min-h-11"
              >
                <Rocket className="mr-1.5 h-4 w-4" />
                Publish Mission
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={publishGuide}
                disabled={isPending}
                className="min-h-11"
              >
                <ScrollText className="mr-1.5 h-4 w-4" />
                Publish Guide
              </Button>
            </>
          )}

          {/* Archive — always allowed when it's in the lifecycle */}
          {allowed.includes("archived") && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => transitionTo("archived")}
              disabled={isPending}
              className="text-muted-foreground hover:text-foreground min-h-11"
            >
              <ArchiveIcon className="mr-1.5 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </motion.div>

      {/* Metadata card */}
      <Card className="border-border bg-background">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-foreground text-lg">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-foreground text-xs font-medium">
              Slug
            </Label>
            <Input
              id="slug"
              value={meta.slug}
              disabled={readOnly}
              onChange={(e) => setMeta((m) => ({ ...m, slug: e.target.value }))}
              className="bg-background border-border text-foreground min-h-11 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-foreground text-xs font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={meta.title}
              disabled={readOnly}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              className="bg-background border-border text-foreground min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="module" className="text-foreground text-xs font-medium">
              Module
            </Label>
            <Input
              id="module"
              value={meta.module}
              disabled={readOnly}
              onChange={(e) => setMeta((m) => ({ ...m, module: e.target.value }))}
              className="bg-background border-border text-foreground min-h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Steps card */}
      <Card className="border-border bg-background">
        <CardContent className="p-6">
          <JourneyStepsEditor steps={steps} onChange={setSteps} disabled={readOnly} />
        </CardContent>
      </Card>

      {/* Footer note + live region for transitions */}
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <ClockIcon className="h-3.5 w-3.5" />
        <span className={cn("sr-only")} aria-live="polite" role="status">
          Status: {STATUS_LABEL[status]}
        </span>
        <span>
          IR v{initialIr.version} — M3.5 will extend with <code>actor</code>, <code>platform</code>,{" "}
          <code>auth_profile</code>, <code>preconditions</code>, and <code>actions[]</code>.
        </span>
      </div>
    </div>
  );
}
