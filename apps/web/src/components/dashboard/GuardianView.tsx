"use client";

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
} from "lucide-react";
import {
  useGuardianData,
  type GuardianSignal,
  type ActiveEngineSession,
  type SeasonPulse,
} from "@/app/dashboard/_hooks/useGuardianData";

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
      {/* Section 1: Season Pulse */}
      <SeasonPulseSection seasonPulse={seasonPulse} isDark={isDark} />

      {/* Section 2: Active Protocols */}
      <ActiveProtocolsSection sessions={sessions} count={counts.activeMissions} isDark={isDark} />

      {/* Section 3: Signal Feed */}
      <SignalFeedSection signals={signals} isDark={isDark} />
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
}: {
  sessions: ActiveEngineSession[];
  count: number;
  isDark: boolean;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
          <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            Aktive protokoller
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
            Ingen aktive sessions
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, isDark }: { session: ActiveEngineSession; isDark: boolean }) {
  const elapsed = elapsedTime(session.created_at);
  const stageProgress =
    session.total_stages > 0 ? (session.stage_index / session.total_stages) * 100 : 0;
  const channelBadge = getChannelBadge(session.channel, isDark);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${
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

function SignalFeedSection({ signals, isDark }: { signals: GuardianSignal[]; isDark: boolean }) {
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
            <SignalRow key={signal.id} signal={signal} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalRow({ signal, isDark }: { signal: GuardianSignal; isDark: boolean }) {
  const ago = timeAgo(signal.created_at);

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
      </div>
    </div>
  );
}
