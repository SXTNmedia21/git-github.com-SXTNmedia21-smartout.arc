// ============================================
// journey-detail-client.tsx — Journey Detail Client Component
// Renders the full detail view for a single journey, including
// header with status changer, classification info, step list,
// event timeline, and output generation tabs (E2E, Doc, Linear, Botsson).
// Connected to: apps/web/src/app/platform-admin/journeys/[id]/page.tsx (server data)
// Connected to: apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx
// Connected to: apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts
// ============================================

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  Journey,
  JourneyStep,
  JourneyEvent,
  JourneyStatus,
  JourneyOutputType,
} from "@smartout/types";
import { STATUS_META } from "@/lib/journey/status-transitions";
import { MODULE_META, ACTOR_META, PRIORITY_META, PLATFORM_META } from "@/lib/journey/module-meta";
import { JourneyStatusChanger } from "../../_components/journey-status-changer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Wand2,
  ClipboardList,
  FileText,
  Hammer,
  Eye,
  TestTube2,
  FlaskConical,
  CheckCircle2,
  Rocket,
  CircleDot,
  CircleMinus,
  AlertTriangle,
  Key,
  Building2,
  Calendar,
  Zap,
  Thermometer,
  GraduationCap,
  Palmtree,
  Banknote,
  MessageSquare,
  BarChart3,
  Settings,
  Bot,
  Trophy,
  ScrollText,
  FileSignature,
  Award,
  Target,
  Smartphone,
  Monitor,
  Laptop,
  Clock,
  Copy,
  Loader2,
  Play,
} from "lucide-react";

/**
 * Maps lucide icon name strings from STATUS_META to actual components.
 * Avoids dynamic imports by building a static lookup table.
 */
const STATUS_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Wand2,
  ClipboardList,
  FileText,
  Hammer,
  Eye,
  TestTube2,
  FlaskConical,
  CheckCircle2,
  Rocket,
  CircleDot,
  CircleMinus,
  AlertTriangle,
};

/**
 * Maps lucide icon name strings from MODULE_META to actual components.
 */
const MODULE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Key,
  Rocket,
  Building2,
  Calendar,
  Zap,
  Thermometer,
  GraduationCap,
  Palmtree,
  Banknote,
  MessageSquare,
  BarChart3,
  Settings,
  Bot,
  Trophy,
  ScrollText,
  FileSignature,
  Award,
  Target,
};

/**
 * Maps lucide icon name strings from PLATFORM_META to actual components.
 */
const PLATFORM_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone,
  Monitor,
  Laptop,
};

// ─── Output Tab Content ─────────────────────────────────────

type OutputTabContentProps = {
  journeyId: string;
  outputType: JourneyOutputType;
  label: string;
  isCode: boolean;
};

/**
 * Shared component for each output tab. Handles generate, display,
 * and copy-to-clipboard for a specific output type.
 *
 * Why shared: All 4 output tabs have identical generate/copy/display
 * logic — only the output type and label differ.
 *
 * @param journeyId - The journey UUID
 * @param outputType - Which generator to call (e2e, doc, linear, botsson)
 * @param label - Human-readable label for the output type
 * @param isCode - Whether to render as code block (true) or markdown-style (false)
 */
function OutputTabContent({ journeyId, outputType, label, isCode }: OutputTabContentProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Calls the generate API endpoint and stores the result.
   */
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/platform-admin/journeys/${journeyId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: outputType }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(`Failed to generate ${label}: ${error.error ?? "Unknown error"}`);
        return;
      }

      const data = await response.json();
      setContent(data.content);
      toast.success(`${label} generated successfully`);
    } catch {
      toast.error(`Failed to generate ${label}`);
    } finally {
      setLoading(false);
    }
  }, [journeyId, outputType, label]);

  /**
   * Copies the generated content to the clipboard.
   */
  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [content]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate
            </Button>
            {content && (
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {content ? (
          isCode ? (
            <pre className="bg-muted overflow-x-auto rounded-md border p-4 text-sm">
              <code>{content}</code>
            </pre>
          ) : (
            <div className="bg-muted prose prose-sm dark:prose-invert max-w-none rounded-md border p-4">
              <pre className="font-sans text-sm whitespace-pre-wrap">{content}</pre>
            </div>
          )
        ) : (
          <p className="text-muted-foreground text-sm">
            Click &quot;Generate&quot; to create the {label.toLowerCase()} output.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Detail Component ──────────────────────────────────

type JourneyDetailClientProps = {
  journey: Journey;
  steps: JourneyStep[];
  events: JourneyEvent[];
};

/**
 * Full detail view for a single journey. Shows header, classification,
 * step list, event timeline, and output generation tabs.
 *
 * Why client component: Needs interactive status changes, tabs,
 * and output generation with API calls.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @param events - Event history, newest first
 */
export function JourneyDetailClient({
  journey: initialJourney,
  steps,
  events: initialEvents,
}: JourneyDetailClientProps) {
  const [journey, setJourney] = useState(initialJourney);
  const [events, setEvents] = useState(initialEvents);

  const moduleMeta = MODULE_META[journey.module];
  const actorMeta = ACTOR_META[journey.actor];
  const priorityMeta = PRIORITY_META[journey.priority];
  const platformMeta = PLATFORM_META[journey.platform];
  const ModuleIcon = MODULE_ICON_MAP[moduleMeta.icon];
  const PlatformIcon = PLATFORM_ICON_MAP[platformMeta.icon];

  /**
   * Handles status change from the JourneyStatusChanger.
   * Updates local journey state and prepends a synthetic event
   * so the timeline updates without a server round-trip.
   */
  function handleStatusChange(_journeyId: string, newStatus: JourneyStatus) {
    const previousStatus = journey.status;
    setJourney((prev) => ({ ...prev, status: newStatus }));
    // Prepend a synthetic event to the timeline for immediate feedback
    setEvents((prev) => [
      {
        journey_event_id: crypto.randomUUID(),
        journey_id: journey.journey_id,
        workspace_id: journey.workspace_id,
        event_type: "status_change",
        from_status: previousStatus,
        to_status: newStatus,
        actor_id: null,
        metadata: {},
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/platform-admin/journeys"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Journeys
        </Link>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-xs">
                {journey.code}
              </Badge>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">{journey.title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <JourneyStatusChanger
                journeyId={journey.journey_id}
                workspaceId={journey.workspace_id}
                currentStatus={journey.status}
                onStatusChanged={handleStatusChange}
              />
              <Badge
                variant="outline"
                className="gap-1 text-xs"
                style={{ borderColor: moduleMeta.color, color: moduleMeta.color }}
              >
                {ModuleIcon && <ModuleIcon className="h-3 w-3" />}
                {moduleMeta.name}
              </Badge>
              <Badge variant="secondary" className="text-xs" style={{ color: actorMeta.color }}>
                {actorMeta.label}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: priorityMeta.color, color: priorityMeta.color }}
              >
                {journey.priority}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                {PlatformIcon && <PlatformIcon className="h-3 w-3" />}
                {platformMeta.label}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Classification Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tags */}
          {journey.tags.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {journey.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Trigger description */}
          {journey.trigger_description && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Trigger</p>
              <p className="text-foreground text-sm">{journey.trigger_description}</p>
            </div>
          )}

          {/* Preconditions */}
          {journey.preconditions.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium">Preconditions</p>
              <ul className="text-foreground list-inside list-disc space-y-0.5 text-sm">
                {journey.preconditions.map((pre, i) => (
                  <li key={i}>{pre}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Test assertion */}
          {journey.test_assertion && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Test Assertion</p>
              <p className="text-foreground font-mono text-sm">{journey.test_assertion}</p>
            </div>
          )}

          {/* Doc title */}
          {journey.doc_title && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Documentation</p>
              <p className="text-foreground text-sm">{journey.doc_title}</p>
            </div>
          )}

          {/* Outcomes */}
          {(journey.outcomes_success || journey.outcomes_empty || journey.outcomes_error) && (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-3">
                {journey.outcomes_success && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Success Outcome
                    </p>
                    <p className="text-foreground text-sm">{journey.outcomes_success}</p>
                  </div>
                )}
                {journey.outcomes_empty && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Empty State</p>
                    <p className="text-foreground text-sm">{journey.outcomes_empty}</p>
                  </div>
                )}
                {journey.outcomes_error && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Error State</p>
                    <p className="text-foreground text-sm">{journey.outcomes_error}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Output Tabs */}
      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps">Journey Steps</TabsTrigger>
          <TabsTrigger value="e2e">E2E Test</TabsTrigger>
          <TabsTrigger value="doc">Doc</TabsTrigger>
          <TabsTrigger value="linear">Linear</TabsTrigger>
          <TabsTrigger value="botsson">Botsson</TabsTrigger>
        </TabsList>

        <TabsContent value="steps">
          {/* Steps Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Steps ({steps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-muted-foreground text-sm">No steps defined yet.</p>
              ) : (
                <ol className="space-y-4">
                  {steps.map((step) => (
                    <li key={step.journey_step_id} className="flex gap-3">
                      {/* Step number circle */}
                      <div className="bg-muted text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                        {step.step_order}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-foreground text-sm font-medium">{step.title}</p>
                        <p className="text-muted-foreground text-sm">{step.action}</p>
                        {step.expects && (
                          <p className="text-muted-foreground text-xs">
                            <span className="font-medium">Expects:</span> {step.expects}
                          </p>
                        )}
                        {step.screen && (
                          <p className="text-muted-foreground font-mono text-xs">{step.screen}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="e2e">
          <OutputTabContent
            journeyId={journey.journey_id}
            outputType="e2e"
            label="E2E Test"
            isCode={true}
          />
        </TabsContent>

        <TabsContent value="doc">
          <OutputTabContent
            journeyId={journey.journey_id}
            outputType="doc"
            label="Onboarding Doc"
            isCode={false}
          />
        </TabsContent>

        <TabsContent value="linear">
          <OutputTabContent
            journeyId={journey.journey_id}
            outputType="linear"
            label="Linear Issue"
            isCode={false}
          />
        </TabsContent>

        <TabsContent value="botsson">
          <OutputTabContent
            journeyId={journey.journey_id}
            outputType="botsson"
            label="Botsson Script"
            isCode={false}
          />
        </TabsContent>
      </Tabs>

      {/* Event Log Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Event Log ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const FromIcon = event.from_status
                  ? STATUS_ICON_MAP[STATUS_META[event.from_status].icon]
                  : null;
                const ToIcon = event.to_status
                  ? STATUS_ICON_MAP[STATUS_META[event.to_status].icon]
                  : null;

                return (
                  <div key={event.journey_event_id} className="flex items-start gap-3 text-sm">
                    <Clock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {event.event_type}
                        </Badge>

                        {/* Show from -> to for status_change events */}
                        {event.event_type === "status_change" &&
                          event.from_status &&
                          event.to_status && (
                            <span className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className="gap-1 text-xs"
                                style={{
                                  borderColor: STATUS_META[event.from_status].color,
                                  color: STATUS_META[event.from_status].color,
                                }}
                              >
                                {FromIcon && <FromIcon className="h-3 w-3" />}
                                {STATUS_META[event.from_status].label}
                              </Badge>
                              <ArrowRight className="text-muted-foreground h-3 w-3" />
                              <Badge
                                variant="outline"
                                className="gap-1 text-xs"
                                style={{
                                  borderColor: STATUS_META[event.to_status].color,
                                  color: STATUS_META[event.to_status].color,
                                }}
                              >
                                {ToIcon && <ToIcon className="h-3 w-3" />}
                                {STATUS_META[event.to_status].label}
                              </Badge>
                            </span>
                          )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
