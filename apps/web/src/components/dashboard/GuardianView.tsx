"use client";

import { useState } from "react";
import {
  Shield,
  Activity,
  Zap,
  AlertTriangle,
  Info,
  Radio,
  User,
  Clock,
  MessageSquare,
  Compass,
  Check,
  CheckCheck,
  X,
  Loader2,
  Brain,
  Eye,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Users,
  BarChart3,
} from "lucide-react";
import {
  useGuardianData,
  type GuardianSignal,
  type ActiveEngineSession,
  type SeasonPulse,
} from "@/app/dashboard/_hooks/useGuardianData";
import { useGuardianActions } from "@/app/dashboard/_hooks/useGuardianActions";
import { Button } from "@/components/ui/button";
import { MissionControlPanel } from "./MissionControlPanel";

// ── Helpers ────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "akkurat na";
  if (minutes < 60) return `${minutes}m siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  return `${days}d siden`;
}

function elapsedTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}t ${remainMinutes}m`;
}

function getIntensity(priceFactor: number, dayFactor: number): number {
  return priceFactor * dayFactor;
}

function getIntensityLabel(intensity: number): string {
  if (intensity > 1.5) return "Hoysesong";
  if (intensity >= 1.0) return "Normal";
  return "Lavsesong";
}

function getIntensityColors(
  intensity: number,
  isDark: boolean,
): { bg: string; text: string; bar: string; badge: string } {
  if (intensity > 1.5) {
    return {
      bg: isDark ? "bg-orange-500/10" : "bg-orange-50",
      text: isDark ? "text-orange-400" : "text-orange-600",
      bar: "bg-orange-500",
      badge: isDark
        ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
        : "border-orange-200 bg-orange-50 text-orange-600",
    };
  }
  if (intensity >= 1.0) {
    return {
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      text: isDark ? "text-emerald-400" : "text-emerald-600",
      bar: "bg-emerald-500",
      badge: isDark
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        : "border-emerald-200 bg-emerald-50 text-emerald-600",
    };
  }
  return {
    bg: isDark ? "bg-blue-500/10" : "bg-blue-50",
    text: isDark ? "text-blue-400" : "text-blue-600",
    bar: "bg-blue-500",
    badge: isDark
      ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
      : "border-blue-200 bg-blue-50 text-blue-600",
  };
}

type Severity = "info" | "warning" | "critical";

function getSeverityIcon(severity: Severity) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getChannelBadge(channel: string, isDark: boolean): string {
  switch (channel) {
    case "voice":
      return isDark
        ? "border-purple-500/20 bg-purple-500/10 text-purple-400"
        : "border-purple-200 bg-purple-50 text-purple-600";
    case "chat":
      return isDark
        ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
        : "border-blue-200 bg-blue-50 text-blue-600";
    default:
      return isDark
        ? "border-zinc-700 bg-zinc-800 text-zinc-400"
        : "border-zinc-200 bg-zinc-100 text-zinc-600";
  }
}

// ── Main Component ─────────────────────────────────────────────────────

interface GuardianViewProps {
  isDark: boolean;
}

export function GuardianView({ isDark }: GuardianViewProps) {
  const { signals, sessions, seasonPulse, counts, isLoading } = useGuardianData();
  const actions = useGuardianActions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Shield
          className={`h-12 w-12 animate-pulse ${isDark ? "text-zinc-600" : "text-zinc-300"}`}
        />
        <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Laster Guardian...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 pb-4 duration-500">
      {/* Section 0: Guardian Metrics Overview */}
      <GuardianMetricsSection isDark={isDark} counts={counts} sessions={sessions} />

      {/* Section 1: Season Pulse */}
      <SeasonPulseSection seasonPulse={seasonPulse} isDark={isDark} />

      {/* Section 2: Protocol Compliance */}
      <ProtocolComplianceSection isDark={isDark} />

      {/* Section 3: Active Protocols */}
      <ActiveProtocolsSection
        sessions={sessions}
        count={counts.activeMissions}
        isDark={isDark}
        onSessionClick={setSelectedSessionId}
      />

      {/* Section 4: Signal Feed */}
      <SignalFeedSection signals={signals} isDark={isDark} actions={actions} />

      {/* Mission Control Panel */}
      <MissionControlPanel
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
        isDark={isDark}
      />
    </div>
  );
}

// ── Section 0: Guardian Metrics ────────────────────────────────────────

function GuardianMetricsSection({
  isDark,
  counts,
  sessions,
}: {
  isDark: boolean;
  counts: {
    activeSignals: number;
    criticalSignals: number;
    activeMissions: number;
    activeJourneys: number;
  };
  sessions: ActiveEngineSession[];
}) {
  // Calculate average session time
  const avgSessionTime =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((sum, s) => {
            const diff = Date.now() - new Date(s.created_at).getTime();
            return sum + diff / 60_000;
          }, 0) / sessions.length,
        )
      : 0;

  const totalWhispers = sessions.reduce((sum, s) => sum + s.guardian_whisper_count, 0);

  const metrics = [
    {
      label: "Aktive Agenter",
      value: counts.activeMissions,
      icon: Brain,
      color: isDark ? "text-purple-400" : "text-purple-600",
      bg: isDark ? "bg-purple-500/10" : "bg-purple-50",
      borderColor: isDark ? "border-purple-500/20" : "border-purple-200",
    },
    {
      label: "Aktive Signaler",
      value: counts.activeSignals,
      icon: AlertTriangle,
      color:
        counts.criticalSignals > 0
          ? isDark
            ? "text-red-400"
            : "text-red-600"
          : isDark
            ? "text-emerald-400"
            : "text-emerald-600",
      bg:
        counts.criticalSignals > 0
          ? isDark
            ? "bg-red-500/10"
            : "bg-red-50"
          : isDark
            ? "bg-emerald-500/10"
            : "bg-emerald-50",
      borderColor:
        counts.criticalSignals > 0
          ? isDark
            ? "border-red-500/20"
            : "border-red-200"
          : isDark
            ? "border-emerald-500/20"
            : "border-emerald-200",
    },
    {
      label: "Snitt Okttid",
      value: avgSessionTime > 60 ? `${Math.floor(avgSessionTime / 60)}t` : `${avgSessionTime}m`,
      icon: Clock,
      color: isDark ? "text-blue-400" : "text-blue-600",
      bg: isDark ? "bg-blue-500/10" : "bg-blue-50",
      borderColor: isDark ? "border-blue-500/20" : "border-blue-200",
    },
    {
      label: "Guardian Whispers",
      value: totalWhispers,
      icon: Eye,
      color:
        totalWhispers > 0
          ? isDark
            ? "text-orange-400"
            : "text-orange-600"
          : isDark
            ? "text-zinc-400"
            : "text-zinc-500",
      bg:
        totalWhispers > 0
          ? isDark
            ? "bg-orange-500/10"
            : "bg-orange-50"
          : isDark
            ? "bg-zinc-800"
            : "bg-zinc-50",
      borderColor:
        totalWhispers > 0
          ? isDark
            ? "border-orange-500/20"
            : "border-orange-200"
          : isDark
            ? "border-zinc-700"
            : "border-zinc-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`relative overflow-hidden rounded-2xl border p-4 ${m.borderColor} ${
            isDark ? "bg-[#0c0c0e]" : "bg-white"
          }`}
        >
          <div
            className={`pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full blur-2xl ${m.bg}`}
          />
          <div className="relative z-10">
            <div className={`mb-2 inline-flex rounded-lg border p-2 ${m.borderColor} ${m.bg}`}>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              {m.value}
            </p>
            <p
              className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              {m.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Protocol Compliance Section ────────────────────────────────────────

const DEMO_COMPLIANCE = [
  { name: "Matservering", compliance: 67, assigned: 12, completed: 8, critical: false },
  { name: "Brannvern", compliance: 100, assigned: 18, completed: 18, critical: false },
  { name: "Kassasystem", compliance: 38, assigned: 8, completed: 3, critical: true },
  { name: "Allergener", compliance: 93, assigned: 15, completed: 14, critical: false },
  { name: "Arbeidsmiljo", compliance: 75, assigned: 20, completed: 15, critical: false },
];

function ProtocolComplianceSection({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
          <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            Protokoll Compliance
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart3 className={`h-3.5 w-3.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
          <span className={`text-[10px] font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Organisasjon
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {DEMO_COMPLIANCE.map((protocol) => {
          const barColor =
            protocol.compliance >= 90
              ? "bg-emerald-500"
              : protocol.compliance >= 70
                ? "bg-orange-500"
                : "bg-red-500";

          const textColor =
            protocol.compliance >= 90
              ? isDark
                ? "text-emerald-400"
                : "text-emerald-600"
              : protocol.compliance >= 70
                ? isDark
                  ? "text-orange-400"
                  : "text-orange-600"
                : isDark
                  ? "text-red-400"
                  : "text-red-600";

          return (
            <div key={protocol.name}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                  >
                    {protocol.name}
                  </span>
                  {protocol.critical && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                      }`}
                    >
                      Kritisk
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    {protocol.completed}/{protocol.assigned}
                  </span>
                  <span className={`text-xs font-bold ${textColor}`}>{protocol.compliance}%</span>
                </div>
              </div>
              <div
                className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                  style={{ width: `${protocol.compliance}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div
        className={`mt-4 flex items-center gap-4 border-t pt-3 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}
      >
        <div className="flex items-center gap-1.5">
          <Users className={`h-3 w-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
          <span
            className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            73 tilordninger totalt
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className={`h-3 w-3 ${isDark ? "text-emerald-500" : "text-emerald-600"}`} />
          <span
            className={`text-[10px] font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
          >
            +12% siste 30 dager
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Section 1: Season Pulse ────────────────────────────────────────────

function SeasonPulseSection({
  seasonPulse,
  isDark,
}: {
  seasonPulse: SeasonPulse | null;
  isDark: boolean;
}) {
  if (!seasonPulse) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border p-8 ${
          isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Compass className={`h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
          <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Ingen aktiv sesong
          </p>
        </div>
      </div>
    );
  }

  const intensity = getIntensity(seasonPulse.price_factor, seasonPulse.day_factor);
  const intensityLabel = getIntensityLabel(intensity);
  const colors = getIntensityColors(intensity, isDark);
  const intensityBarWidth = Math.min(intensity / 2.5, 1) * 100;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${
        isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"
      }`}
    >
      {/* Subtle glow */}
      <div
        className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-[60px] ${colors.bg}`}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl border p-2.5 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
            >
              <Activity className={`h-5 w-5 ${colors.text}`} />
            </div>
            <div>
              <h2
                className={`text-base font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                {seasonPulse.season_name}
              </h2>
              <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Sesong</p>
            </div>
          </div>

          {/* Intensity badge */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${colors.badge}`}
          >
            <Zap className="h-3.5 w-3.5" />
            {intensityLabel}
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <p
              className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Prisfaktor
            </p>
            <p className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              {seasonPulse.price_factor.toFixed(2)}x
            </p>
          </div>
          <div>
            <p
              className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Dagfaktor
            </p>
            <p className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              {seasonPulse.day_factor.toFixed(2)}x
            </p>
          </div>
          <div>
            <p
              className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Intensitet
            </p>
            <p className={`text-lg font-black ${colors.text}`}>{intensity.toFixed(2)}x</p>
          </div>
        </div>

        {/* Intensity Bar */}
        <div
          className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${colors.bar}`}
            style={{ width: `${intensityBarWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Section 2: Active Protocols ────────────────────────────────────────

function ActiveProtocolsSection({
  sessions,
  count,
  isDark,
  onSessionClick,
}: {
  sessions: ActiveEngineSession[];
  count: number;
  isDark: boolean;
  onSessionClick: (sessionId: string) => void;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
          <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            Aktive Sesjoner
          </h3>
          {count > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {count}
            </span>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-8 ${
            isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"
          }`}
        >
          <Shield className={`h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
          <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Ingen aktive sesjoner
          </p>
          <p className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Sesjoner vil vises her nar agenter star i samtale med ansatte
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isDark={isDark}
              onClick={() => onSessionClick(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  isDark,
  onClick,
}: {
  session: ActiveEngineSession;
  isDark: boolean;
  onClick: () => void;
}) {
  const elapsed = elapsedTime(session.created_at);
  const stageProgress =
    session.total_stages > 0 ? (session.stage_index / session.total_stages) * 100 : 0;
  const channelBadge = getChannelBadge(session.channel, isDark);

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${
        isDark ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700" : "border-zinc-200 bg-white"
      }`}
    >
      {/* Top row: mission name + channel badge */}
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h4
            className={`truncate text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            {session.mission_name ?? "Agent Session"}
          </h4>
          {session.journey_title && (
            <p className={`mt-0.5 truncate text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {session.journey_title}
            </p>
          )}
        </div>
        <span
          className={`ml-2 flex-shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold capitalize ${channelBadge}`}
        >
          {session.channel}
        </span>
      </div>

      {/* Info row: profile, elapsed, whispers */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {(session.profile_first_name || session.profile_last_name) && (
          <span
            className={`flex items-center gap-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
          >
            <User className="h-3 w-3" />
            {[session.profile_first_name, session.profile_last_name].filter(Boolean).join(" ")}
          </span>
        )}
        <span
          className={`flex items-center gap-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          <Clock className="h-3 w-3" />
          {elapsed}
        </span>
        {session.guardian_whisper_count > 0 && (
          <span
            className={`flex items-center gap-1 text-xs ${isDark ? "text-orange-400" : "text-orange-500"}`}
          >
            <MessageSquare className="h-3 w-3" />
            {session.guardian_whisper_count}
          </span>
        )}
      </div>

      {/* Stage progress */}
      {session.total_stages > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span
              className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Stage {session.stage_index}/{session.total_stages}
            </span>
            <span className={`text-[10px] font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {Math.round(stageProgress)}%
            </span>
          </div>
          <div
            className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 3: Signal Feed ─────────────────────────────────────────────

type GuardianActions = ReturnType<typeof useGuardianActions>;

function SignalFeedSection({
  signals,
  isDark,
  actions,
}: {
  signals: GuardianSignal[];
  isDark: boolean;
  actions: GuardianActions;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
        <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
          Signaler
        </h3>
      </div>

      {signals.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-8 ${
            isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"
          }`}
        >
          <Shield className={`h-8 w-8 ${isDark ? "text-emerald-600" : "text-emerald-300"}`} />
          <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Ingen signaler — alt ser bra ut
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {signals.map((signal) => (
            <SignalRow key={signal.id} signal={signal} isDark={isDark} actions={actions} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalRow({
  signal,
  isDark,
  actions,
}: {
  signal: GuardianSignal;
  isDark: boolean;
  actions: GuardianActions;
}) {
  const ago = timeAgo(signal.created_at);

  const isActing =
    actions.acknowledgingId === signal.id ||
    actions.resolvingId === signal.id ||
    actions.dismissingId === signal.id;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        isDark
          ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      {/* Severity icon */}
      <div className="mt-0.5 flex-shrink-0">{getSeverityIcon(signal.severity)}</div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            {signal.title}
          </h4>
          <span
            className={`flex-shrink-0 text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            {ago}
          </span>
        </div>

        {signal.description && (
          <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            {signal.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {signal.domain}
          </span>
          {signal.entity_label && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {signal.entity_label}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <SignalActions signal={signal} isDark={isDark} actions={actions} isActing={isActing} />
      </div>
    </div>
  );
}

function SignalActions({
  signal,
  isDark,
  actions,
  isActing,
}: {
  signal: GuardianSignal;
  isDark: boolean;
  actions: GuardianActions;
  isActing: boolean;
}) {
  // No actions for resolved or dismissed signals
  if (signal.status === "resolved" || signal.status === "dismissed") {
    return (
      <div className="mt-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${
            signal.status === "resolved"
              ? isDark
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-emerald-50 text-emerald-600"
              : isDark
                ? "bg-zinc-800 text-zinc-500"
                : "bg-zinc-100 text-zinc-400"
          }`}
        >
          {signal.status === "resolved" ? "Lost" : "Avvist"}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5">
      {signal.status === "active" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-[11px] font-semibold ${
              isDark
                ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            }`}
            disabled={isActing}
            onClick={() => actions.acknowledge({ signalId: signal.id })}
          >
            {actions.acknowledgingId === signal.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Bekreft
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-[11px] font-semibold ${
              isDark
                ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            }`}
            disabled={isActing}
            onClick={() => actions.dismiss({ signalId: signal.id })}
          >
            {actions.dismissingId === signal.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            Avvis
          </Button>
        </>
      )}

      {signal.status === "acknowledged" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-[11px] font-semibold ${
              isDark
                ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
            disabled={isActing}
            onClick={() => actions.resolve({ signalId: signal.id })}
          >
            {actions.resolvingId === signal.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3 w-3" />
            )}
            Los
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 px-2 text-[11px] font-semibold ${
              isDark
                ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            }`}
            disabled={isActing}
            onClick={() => actions.dismiss({ signalId: signal.id })}
          >
            {actions.dismissingId === signal.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            Avvis
          </Button>
        </>
      )}
    </div>
  );
}
