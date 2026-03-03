"use client";

// UI Events:
// - nav: tab switch between overview/monitor/analytics (client-side, no route change)
// - action: connection status indicator shows WebSocket state
// - color-regime: connection status (emerald=connected, red=disconnected)

import { Shield, LayoutDashboard, Radio, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGuardianSocket } from "../_hooks/useGuardianSocket";
import { GuardianOverview } from "./GuardianOverview";
import { GuardianMonitor } from "./GuardianMonitor";
import { GuardianAnalytics } from "./GuardianAnalytics";

export function GuardianDashboard() {
  const { connected, sessions, events, subscribedSession, subscribe, whisper } =
    useGuardianSocket();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2">
            <Shield className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-foreground text-2xl font-semibold">Guardian</h1>
            <p className="text-muted-foreground text-sm">Stage Engine overvaking og analyse</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {/* Semantic status color — deliberate exception from CSS variable rule */}
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                connected ? "animate-ping bg-emerald-400" : "bg-red-400",
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                connected ? "bg-emerald-400" : "bg-red-400",
              )}
            />
          </span>
          <span className="text-muted-foreground">{connected ? "Tilkoblet" : "Frakoblet"}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
            Oversikt
          </TabsTrigger>
          <TabsTrigger value="monitor">
            <Radio className="mr-1.5 h-3.5 w-3.5" />
            Live Monitor
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Analyse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <GuardianOverview activeSessions={sessions.length} />
        </TabsContent>

        <TabsContent value="monitor" className="mt-4">
          <GuardianMonitor
            sessions={sessions}
            events={events}
            subscribedSession={subscribedSession}
            subscribe={subscribe}
            whisper={whisper}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <GuardianAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
