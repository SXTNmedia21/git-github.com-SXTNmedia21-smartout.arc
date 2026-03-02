"use client";

import React, { useState, useCallback } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from "framer-motion";
import { Check, X, Clock, User, Building2, Briefcase } from "lucide-react";

export type ShiftForReview = {
  id: string;
  employee_name: string;
  department_name: string;
  department_color: string;
  role: string;
  start_time: string;
  end_time: string;
  work_hours: number;
};

type Props = {
  shifts: ShiftForReview[];
  onApprove: (shiftId: string) => void;
  onReject: (shiftId: string) => void;
  isDark: boolean;
};

type ReviewDecision = "approved" | "rejected";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(time: string): string {
  if (!time || time === "—") return "—";
  // Handle ISO datetime or time string
  const parts = time.split("T");
  const timePart = parts[1] ?? parts[0] ?? time;
  return timePart.slice(0, 5);
}

export function SwipeReconciliation({ shifts, onApprove, onReject, isDark }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, ReviewDecision>>(new Map());
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);

  const currentShift = shifts[currentIndex] ?? null;
  const totalReviewed = decisions.size;
  const approvedCount = Array.from(decisions.values()).filter((d) => d === "approved").length;
  const rejectedCount = Array.from(decisions.values()).filter((d) => d === "rejected").length;
  const isComplete = totalReviewed >= shifts.length;

  const handleDecision = useCallback(
    (decision: ReviewDecision) => {
      if (!currentShift) return;

      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(currentShift.id, decision);
        return next;
      });

      if (decision === "approved") {
        onApprove(currentShift.id);
      } else {
        onReject(currentShift.id);
      }

      setExitDirection(decision === "approved" ? "right" : "left");

      // Small delay to let the exit animation play before advancing
      setTimeout(() => {
        setCurrentIndex((i) => Math.min(i + 1, shifts.length));
        setExitDirection(null);
      }, 200);
    },
    [currentShift, onApprove, onReject, shifts.length],
  );

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setDecisions(new Map());
    setExitDirection(null);
  }, []);

  if (shifts.length === 0) {
    return (
      <div
        className={`flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-12 ${isDark ? "border-zinc-800" : "border-border"}`}
      >
        <div className="text-center">
          <Building2 className="text-muted-foreground mx-auto mb-3 h-8 w-8 opacity-40" />
          <p className="text-muted-foreground font-semibold">No shifts to review</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className={`flex h-20 w-20 items-center justify-center rounded-full ${isDark ? "bg-emerald-500/15" : "bg-emerald-50"}`}
        >
          <Check className={`h-10 w-10 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
        </motion.div>
        <div className="text-center">
          <h3 className="text-foreground text-xl font-bold">All shifts reviewed</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {approvedCount} approved, {rejectedCount} flagged
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="border-border text-muted-foreground hover:bg-muted/50 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
          >
            Review again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 py-4">
      {/* Progress counter */}
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm font-semibold">
          {totalReviewed} / {shifts.length} reviewed
        </span>
        <div
          className={`h-1.5 w-32 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-muted"}`}
        >
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={false}
            animate={{ width: `${(totalReviewed / shifts.length) * 100}%` }}
            transition={{ type: "spring", damping: 20 }}
          />
        </div>
      </div>

      {/* Card Stack */}
      <div className="relative flex h-[340px] w-full max-w-sm items-center justify-center">
        {/* Preview of next card behind */}
        {currentIndex + 1 < shifts.length && (
          <div
            className={`absolute inset-x-4 top-4 h-[300px] rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-border bg-muted/50"}`}
          />
        )}

        <AnimatePresence mode="popLayout">
          {currentShift && !exitDirection && (
            <SwipeCard
              key={currentShift.id}
              shift={currentShift}
              isDark={isDark}
              onDecision={handleDecision}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => handleDecision("rejected")}
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors ${
            isDark
              ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
              : "border-red-200 text-red-500 hover:bg-red-50"
          }`}
          aria-label="Flag shift"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={() => handleDecision("approved")}
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors ${
            isDark
              ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              : "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
          }`}
          aria-label="Approve shift"
        >
          <Check className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function SwipeCard({
  shift,
  isDark,
  onDecision,
}: {
  shift: ShiftForReview;
  isDark: boolean;
  onDecision: (decision: ReviewDecision) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const approveOpacity = useTransform(x, [0, 100], [0, 1]);
  const rejectOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      onDecision("approved");
    } else if (info.offset.x < -threshold) {
      onDecision("rejected");
    }
  };

  return (
    <motion.div
      className={`absolute h-[300px] w-full max-w-sm cursor-grab rounded-2xl border p-6 active:cursor-grabbing ${
        isDark ? "border-zinc-700 bg-[#0c0c0e] shadow-2xl" : "border-border bg-background shadow-lg"
      }`}
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{
        x: 300,
        opacity: 0,
        transition: { duration: 0.2 },
      }}
      transition={{ type: "spring", damping: 20 }}
    >
      {/* Approve overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10"
        style={{ opacity: approveOpacity }}
      >
        <div className="rounded-xl bg-emerald-500/20 px-6 py-2">
          <span className="text-xl font-black text-emerald-500">APPROVE</span>
        </div>
      </motion.div>

      {/* Reject overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-red-500/50 bg-red-500/10"
        style={{ opacity: rejectOpacity }}
      >
        <div className="rounded-xl bg-red-500/20 px-6 py-2">
          <span className="text-xl font-black text-red-500">FLAG</span>
        </div>
      </motion.div>

      {/* Card Content */}
      <div className="relative flex h-full flex-col justify-between">
        {/* Header — Employee */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: shift.department_color }}
          >
            {getInitials(shift.employee_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground truncate text-lg font-bold">{shift.employee_name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: shift.department_color }}
              />
              <span className="text-muted-foreground text-sm">{shift.department_name}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Briefcase className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm font-medium">{shift.role}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm font-medium">
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <User className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm font-medium">
              {shift.work_hours.toFixed(1)} hours
            </span>
          </div>
        </div>

        {/* Swipe hint */}
        <div className="mt-auto pt-4 text-center">
          <p className="text-muted-foreground/60 text-[11px] font-medium tracking-wider uppercase">
            Swipe right to approve, left to flag
          </p>
        </div>
      </div>
    </motion.div>
  );
}
