import type { CSSProperties } from "react";

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`sk-bone rounded-lg ${className}`} style={style} />;
}

/** Mirrors LeaderPulseCard */
function LeaderPulseSkeleton() {
  return (
    <div className="border-border bg-card rounded-2xl border px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Bone className="h-2.5 w-40" />
          <Bone className="h-2 w-64 max-w-full" />
        </div>
        <Bone className="h-7 w-20 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

/** Mirrors SignalCard (expanded, with ring chart variant or progress variant) */
function SignalCardSkeleton({ ring = false }: { ring?: boolean }) {
  return (
    <div className="border-border bg-card rounded-2xl border shadow-sm">
      {/* Main content */}
      <div className="p-5">
        {/* Header row */}
        <div className="mb-1 flex items-center gap-3">
          <Bone className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-2 w-40 max-w-full" />
          </div>
          <Bone className="h-4 w-4 shrink-0 rounded" />
        </div>

        {/* Value row */}
        <div className="mt-3 flex items-end gap-3">
          {ring ? (
            <Bone className="h-[72px] w-[72px] shrink-0 rounded-full" />
          ) : (
            <Bone className="h-10 w-16 rounded-lg" />
          )}
          <div className="flex-1 space-y-2">
            {ring && <Bone className="h-8 w-14" />}
            {!ring && <Bone className="h-1.5 w-full rounded-full" />}
            <Bone className="h-2.5 w-24" />
          </div>
        </div>

        {ring && <Bone className="mt-2 h-2 w-32" />}
      </div>

      {/* Expanded detail panel */}
      <div className="border-border space-y-3 border-t px-5 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Bone className="h-5 w-5 shrink-0 rounded" />
              <Bone className="h-2.5 w-28" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Bone className="h-5 w-10 rounded-full" />
              <Bone className="h-5 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors ProtocolCard */
function ProtocolCardSkeleton() {
  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      {/* Tag + badge row */}
      <div className="flex items-center gap-2">
        <Bone className="h-5 w-14 rounded-full" />
        <Bone className="h-5 w-16 rounded-full" />
      </div>
      {/* Icon + title */}
      <div className="flex items-start gap-3">
        <Bone className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Bone className="h-3 w-36 max-w-full" />
          <Bone className="h-2 w-full" />
          <Bone className="h-2 w-4/5" />
        </div>
      </div>
      {/* Status row */}
      <div className="flex items-center justify-between pt-1">
        <Bone className="h-2 w-24" />
        <Bone className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-5 pb-6">
      {/* Leader Pulse */}
      <div className="sk-section" style={{ animationDelay: "0ms" }}>
        <LeaderPulseSkeleton />
      </div>

      {/* Signal Cards — 2-col grid */}
      <div
        className="sk-section grid grid-cols-1 gap-4 md:grid-cols-2"
        style={{ animationDelay: "80ms" }}
      >
        <SignalCardSkeleton ring />
        <SignalCardSkeleton ring={false} />
      </div>

      {/* Protocol Section */}
      <div className="sk-section" style={{ animationDelay: "160ms" }}>
        {/* Section header */}
        <div className="mb-3 flex items-center gap-2 px-1">
          <Bone className="h-4 w-4 rounded" />
          <Bone className="h-3 w-32" />
          <div className="flex-1" />
          <Bone className="h-5 w-6 rounded-full" />
          <Bone className="h-4 w-4 rounded" />
        </div>
        {/* Protocol cards grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProtocolCardSkeleton />
          <ProtocolCardSkeleton />
          <ProtocolCardSkeleton />
          <ProtocolCardSkeleton />
        </div>
      </div>
    </div>
  );
}
