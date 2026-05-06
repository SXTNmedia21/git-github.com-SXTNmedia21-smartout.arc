"use client";

// ============================================
// MissionEnrichPanel.tsx — M4 author-enrich form
//
// Renders one card per engine_stages row. Each card lets the admin
// review + override the auto-derived starter values (goal / instructions /
// success_criteria / creative_freedom) before activating the mission.
//
// Nordic Split compliance (non-negotiable):
//   - Zero hardcoded color classes. Token classes only.
//   - Spring physics stiffness=35, damping=22, mass=2.2 on state transitions.
//   - useReducedMotion() on every animated element.
//   - ARIA live region for save success + activation.
//   - Min-h-11 (≥44pt) on all interactive controls.
//   - Lucide icons only. font-heading on headings.
// ============================================

import { useState, useTransition, useId } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Pencil,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enrichStageAction, activateMissionAction } from "../../actions/enrich-mission";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MissionStageRow {
  stage_id: string;
  stage_order: number;
  goal: string;
  instructions: string;
  success_criteria: string;
  creative_freedom: number;
  /** Derived-starter values from IR (for diff highlighting). */
  derived_goal?: string;
  derived_instructions?: string;
  derived_success_criteria?: string;
}

export interface MissionEnrichPanelProps {
  missionId: string;
  missionName: string;
  isActive: boolean;
  stages: MissionStageRow[];
  journeyVersionId: string;
}

// ─── Spring config (Nordic Split — non-negotiable) ────────────────────────────
const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 } as const;

// ─── StageCard ────────────────────────────────────────────────────────────────

interface StageCardProps {
  stage: MissionStageRow;
  locked: boolean;
  onSaved: (stageId: string) => void;
  missionId: string;
}

function StageCard({ stage, locked, onSaved, missionId }: StageCardProps) {
  const reduce = useReducedMotion();
  const labelPrefix = useId();

  const [goal, setGoal] = useState(stage.goal);
  const [instructions, setInstructions] = useState(stage.instructions);
  const [successCriteria, setSuccessCriteria] = useState(stage.success_criteria);
  const [creativeFreedom, setCreativeFreedom] = useState(
    Math.min(1, Math.max(0, stage.creative_freedom ?? 0.3)),
  );
  const [isPending, startTransition] = useTransition();
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Diff: highlight fields still showing auto-derived starter values.
  const goalIsDerived = stage.derived_goal ? goal.trim() === stage.derived_goal.trim() : false;
  const instructionsIsDerived = stage.derived_instructions
    ? instructions.trim() === stage.derived_instructions.trim()
    : false;
  const successCriteriaIsDerived = stage.derived_success_criteria
    ? successCriteria.trim() === stage.derived_success_criteria.trim()
    : false;

  const anyFieldDerived = goalIsDerived || instructionsIsDerived || successCriteriaIsDerived;

  function save() {
    startTransition(async () => {
      const result = await enrichStageAction({
        stage_id: stage.stage_id,
        mission_id: missionId,
        goal,
        instructions,
        success_criteria: successCriteria,
        creative_freedom: creativeFreedom,
      });
      if (result.ok) {
        const ts = new Date().toLocaleTimeString();
        setLastSaved(ts);
        onSaved(stage.stage_id);
        toast.success(`Stage ${stage.stage_order + 1} saved`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : SPRING}
    >
      <Card
        className={cn(
          "border-border bg-background transition-colors",
          anyFieldDerived && !locked && "border-l-primary border-l-4",
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-heading text-foreground flex items-center gap-2 text-base">
              <span className="text-muted-foreground font-mono text-xs">
                {String(stage.stage_order + 1).padStart(2, "0")}
              </span>
              Stage {stage.stage_order + 1}
            </CardTitle>
            <div className="flex items-center gap-2">
              {locked && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              )}
              {anyFieldDerived && !locked && (
                <Badge
                  variant="outline"
                  className="border-primary text-primary flex items-center gap-1 text-xs"
                >
                  <Sparkles className="h-3 w-3" />
                  Auto-derived
                </Badge>
              )}
              {lastSaved && !locked && (
                <span className="text-muted-foreground font-mono text-xs">Saved {lastSaved}</span>
              )}
            </div>
          </div>
          {anyFieldDerived && !locked && (
            <p className="text-muted-foreground text-xs">
              Highlighted fields still show auto-derived values from the IR. Review and update
              before activating.
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Goal */}
          <div className="space-y-1.5">
            <Label
              htmlFor={`${labelPrefix}-goal`}
              className={cn(
                "text-xs font-medium",
                goalIsDerived && !locked ? "text-primary" : "text-foreground",
              )}
            >
              Goal
              {goalIsDerived && !locked && " (derived)"}
            </Label>
            <Input
              id={`${labelPrefix}-goal`}
              value={goal}
              disabled={locked || isPending}
              onChange={(e) => setGoal(e.target.value)}
              className="bg-background border-border text-foreground min-h-11"
              placeholder="What should the user achieve at this stage?"
              aria-describedby={goalIsDerived ? `${labelPrefix}-goal-hint` : undefined}
            />
            {goalIsDerived && !locked && (
              <p id={`${labelPrefix}-goal-hint`} className="text-muted-foreground text-xs">
                Derived from IR step title — update for agent-coaching language.
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label
              htmlFor={`${labelPrefix}-instructions`}
              className={cn(
                "text-xs font-medium",
                instructionsIsDerived && !locked ? "text-primary" : "text-foreground",
              )}
            >
              Instructions
              {instructionsIsDerived && !locked && " (derived)"}
            </Label>
            <Textarea
              id={`${labelPrefix}-instructions`}
              value={instructions}
              disabled={locked || isPending}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="bg-background border-border text-foreground min-h-[88px] resize-y"
              placeholder="Step-by-step guidance Mr. Botsson will give to the user."
            />
          </div>

          {/* Success criteria */}
          <div className="space-y-1.5">
            <Label
              htmlFor={`${labelPrefix}-success`}
              className={cn(
                "text-xs font-medium",
                successCriteriaIsDerived && !locked ? "text-primary" : "text-foreground",
              )}
            >
              Success Criteria
              {successCriteriaIsDerived && !locked && " (derived)"}
            </Label>
            <Textarea
              id={`${labelPrefix}-success`}
              value={successCriteria}
              disabled={locked || isPending}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              rows={2}
              className="bg-background border-border text-foreground min-h-[64px] resize-y"
              placeholder="How will the agent know the user has completed this stage?"
            />
          </div>

          {/* Creative freedom */}
          <div className="space-y-1.5">
            <Label htmlFor={`${labelPrefix}-cf`} className="text-foreground text-xs font-medium">
              Creative Freedom{" "}
              <span className="text-muted-foreground font-mono">
                ({creativeFreedom.toFixed(2)})
              </span>
            </Label>
            <Input
              id={`${labelPrefix}-cf`}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={creativeFreedom}
              disabled={locked || isPending}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setCreativeFreedom(Math.min(1, Math.max(0, v)));
              }}
              className="bg-background border-border text-foreground min-h-11 w-28 font-mono"
              aria-label="Creative freedom (0 = rigid, 1 = fully open)"
            />
            <p className="text-muted-foreground text-xs">
              0 = strict script, 1 = open conversation. Default 0.30.
            </p>
          </div>

          {/* Save button */}
          {!locked && (
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                onClick={save}
                disabled={
                  isPending || !goal.trim() || !instructions.trim() || !successCriteria.trim()
                }
                className="min-h-11"
              >
                {isPending ? (
                  <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="mr-1.5 h-4 w-4" />
                )}
                Save Stage
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── MissionEnrichPanel ───────────────────────────────────────────────────────

export function MissionEnrichPanel({
  missionId,
  missionName,
  isActive,
  stages,
  journeyVersionId,
}: MissionEnrichPanelProps) {
  const reduce = useReducedMotion();
  const liveRegionId = useId();

  const [savedStageIds, setSavedStageIds] = useState<Set<string>>(new Set());
  const [isActivating, startActivation] = useTransition();
  const [activationResult, setActivationResult] = useState<{
    ok: boolean;
    error?: string;
    missing?: string[];
  } | null>(null);
  const [missionIsActive, setMissionIsActive] = useState(isActive);

  // Disable the Activate button if any stage has empty required fields
  // based on current in-memory state. This is a client-side pre-check;
  // the server action enforces the same rule authoritatively.
  const allStagesNonEmpty = stages.every(
    (s) =>
      s.goal.trim().length > 0 &&
      s.instructions.trim().length > 0 &&
      s.success_criteria.trim().length > 0,
  );

  function handleSaved(stageId: string) {
    setSavedStageIds((prev) => new Set([...prev, stageId]));
    setActivationResult(null); // clear prior errors on any save
  }

  function activate() {
    startActivation(async () => {
      const result = await activateMissionAction({
        mission_id: missionId,
        journey_version_id: journeyVersionId,
      });
      setActivationResult(result);
      if (result.ok) {
        setMissionIsActive(true);
        toast.success("Mission activated — visible to the runtime now.");
      } else if (result.error === "stages_incomplete") {
        toast.error("Some stages are incomplete — fill all fields first.");
      } else {
        toast.error(result.error ?? "Activation failed.");
      }
    });
  }

  return (
    <div className="space-y-6" aria-labelledby="mission-enrich-heading">
      {/* Section heading */}
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : SPRING}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 id="mission-enrich-heading" className="font-heading text-foreground text-xl">
            Mission Enrichment
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Review auto-derived stage content and update to agent-coaching language before
            activating.{" "}
            {missionIsActive && (
              <span className="text-primary font-medium">
                Mission is active — fields are locked.
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 font-mono text-xs">Mission ID: {missionId}</p>
        </div>

        {missionIsActive ? (
          <Badge variant="default" className="flex items-center gap-1.5 px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-muted-foreground flex items-center gap-1.5 px-3 py-1.5"
          >
            Not active
          </Badge>
        )}
      </motion.div>

      {/* Stage cards */}
      <div className="space-y-4" role="list" aria-label="Mission stages">
        {stages
          .slice()
          .sort((a, b) => a.stage_order - b.stage_order)
          .map((stage) => (
            <div key={stage.stage_id} role="listitem">
              <StageCard
                stage={stage}
                locked={missionIsActive}
                onSaved={handleSaved}
                missionId={missionId}
              />
            </div>
          ))}
      </div>

      {/* Activate Mission button — bottom of panel */}
      {!missionIsActive && (
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : SPRING}
          className="border-border rounded-lg border p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">Activate Mission</p>
              <p className="text-muted-foreground text-xs">
                Once active the mission is visible to the runtime selector. All stage fields must be
                filled. Post-activation edits require deactivating the mission first (v2).
              </p>
            </div>

            <Button
              type="button"
              onClick={activate}
              disabled={isActivating || !allStagesNonEmpty}
              className="min-h-11"
              aria-describedby={!allStagesNonEmpty ? "activate-incomplete-hint" : undefined}
            >
              {isActivating ? (
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-1.5 h-4 w-4" />
              )}
              Activate Mission
            </Button>
          </div>

          {/* Error feedback */}
          <AnimatePresence>
            {activationResult && !activationResult.ok && (
              <motion.div
                key="activate-error"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={reduce ? { duration: 0 } : SPRING}
                className="bg-destructive/10 border-destructive/30 mt-3 flex items-start gap-2 rounded-md border p-3"
                role="alert"
              >
                <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-medium">
                    {activationResult.error === "stages_incomplete"
                      ? "Stages incomplete"
                      : "Activation failed"}
                  </p>
                  {activationResult.error === "stages_incomplete" &&
                    activationResult.missing &&
                    activationResult.missing.length > 0 && (
                      <p className="text-muted-foreground font-mono text-xs">
                        {activationResult.missing.length} stage
                        {activationResult.missing.length === 1 ? "" : "s"} missing required fields.
                      </p>
                    )}
                  {activationResult.error !== "stages_incomplete" && (
                    <p className="text-muted-foreground text-xs">{activationResult.error}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!allStagesNonEmpty && (
            <p id="activate-incomplete-hint" className="text-muted-foreground mt-2 text-xs">
              Fill all Goal, Instructions, and Success Criteria fields to enable activation.
            </p>
          )}
        </motion.div>
      )}

      {/* ARIA live region — announces save + activation to assistive tech. */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {missionIsActive
          ? `Mission ${missionName} is now active.`
          : savedStageIds.size > 0
            ? `${savedStageIds.size} stage${savedStageIds.size === 1 ? "" : "s"} saved. ${
                allStagesNonEmpty
                  ? "All stages complete — ready to activate."
                  : "Fill remaining stages before activating."
              }`
            : ""}
      </div>
    </div>
  );
}
