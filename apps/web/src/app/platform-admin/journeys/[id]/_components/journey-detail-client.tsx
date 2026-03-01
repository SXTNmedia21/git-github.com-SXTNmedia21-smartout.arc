// ============================================
// journey-detail-client.tsx — Journey Detail Client Component
// Renders the full detail view for a single journey, including
// header with status changer, classification info, step list,
// event timeline, and output tabs (placeholder for future features).
// Connected to: apps/web/src/app/platform-admin/journeys/[id]/page.tsx (server data)
// Connected to: apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx
// ============================================

"use client";

import { useState } from "react";
import Link from "next/link";
import type { Journey, JourneyStep, JourneyEvent, JourneyStatus } from "@smartout/types";
import { STATUS_META } from "@/lib/journey/status-transitions";
import { MODULE_META, ACTOR_META, PRIORITY_META, PLATFORM_META } from "@/lib/journey/module-meta";
import { JourneyStatusChanger } from "../../_components/journey-status-changer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type JourneyDetailClientProps = {
  journey: Journey;
  steps: JourneyStep[];
  events: JourneyEvent[];
};

/**
 * Full detail view for a single journey. Shows header, classification,
 * step list, event timeline, and placeholder output tabs.
 *
 * Why client component: Needs interactive status changes and tabs.
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
          <TabsTrigger value="e2e" disabled>
            E2E Test
          </TabsTrigger>
          <TabsTrigger value="doc" disabled>
            Doc
          </TabsTrigger>
          <TabsTrigger value="linear" disabled>
            Linear
          </TabsTrigger>
          <TabsTrigger value="botsson" disabled>
            Botsson
          </TabsTrigger>
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

                        {/* Show from → to for status_change events */}
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
