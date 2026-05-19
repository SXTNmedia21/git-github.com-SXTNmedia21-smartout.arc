"use client";

/**
 * PipelineListClient — Admin override dashboard list view.
 *
 * Filter chips (all/pending/rejected/cancelled) drive `/api/admin/pipeline?status=...`.
 * Row click opens override drawer; drawer dispatches Botsson chat event per ADR-0240.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { PipelineRow } from "./pipeline-row";
import { OverrideDrawer } from "./override-drawer";
import { AuditDrawer } from "./audit-drawer";

type PipelineStatus = "all" | "pending" | "rejected" | "cancelled";

export type PipelineItem = {
  pipeline_instance_id: string;
  blueprint_id: string;
  status: string;
  current_step: number | null;
  entity_id: string | null;
  entity_type: string | null;
  started_at: string;
  completed_at: string | null;
  actor_profile_id: string | null;
};

type ApiResponse = {
  pipelines: PipelineItem[];
  total_count: number;
  has_more: boolean;
};

const FILTER_LABELS: { value: PipelineStatus; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "pending", label: "Ventende" },
  { value: "rejected", label: "Avvist" },
  { value: "cancelled", label: "Kansellert" },
];

const STATUS_PARAM_MAP: Record<Exclude<PipelineStatus, "all">, string> = {
  pending: "pending",
  rejected: "failed",
  cancelled: "complete",
};

async function fetchPipelines(filter: PipelineStatus): Promise<PipelineItem[]> {
  const params = filter === "all" ? "" : `?status=${STATUS_PARAM_MAP[filter]}`;
  const res = await fetch(`/api/admin/pipeline${params}`);
  if (res.status === 403) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return [];
  }
  if (!res.ok) throw new Error(`Kunne ikke laste pipelines (${res.status})`);
  const data = (await res.json()) as ApiResponse;
  return data.pipelines ?? [];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, ...motionTokens.spring },
  },
  exit: { opacity: 0, y: -8, transition: { duration: motionTokens.exitMs / 1000 } },
};

export function PipelineListClient({
  initialFilter = "rejected",
}: {
  initialFilter?: PipelineStatus;
}) {
  const [filter, setFilter] = useState<PipelineStatus>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-pipeline", filter],
    queryFn: () => fetchPipelines(filter),
    staleTime: 30_000,
  });

  const selectedPipeline = data?.find((p) => p.pipeline_instance_id === selectedId) ?? null;

  function handleRowClick(item: PipelineItem) {
    setSelectedId(item.pipeline_instance_id);
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedId(null), 300);
  }

  function handleAuditClick(item: PipelineItem) {
    setAuditId(item.pipeline_instance_id);
    setAuditOpen(true);
  }

  function handleAuditClose() {
    setAuditOpen(false);
    setTimeout(() => setAuditId(null), 300);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {FILTER_LABELS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <motion.button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", ...motionTokens.springSnappy }}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground border-border border",
              ].join(" ")}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/60 border-border h-20 animate-pulse rounded-xl border"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : isError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-6 text-sm">
          Kunne ikke laste pipelines. Prøv å laste siden på nytt.
        </div>
      ) : !data || data.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", ...motionTokens.spring }}
          className="border-border bg-muted/30 rounded-xl border border-dashed p-12 text-center"
        >
          <p className="text-muted-foreground text-sm">Ingen pipelines i denne statusen</p>
        </motion.div>
      ) : (
        <motion.div
          key={filter}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3"
        >
          <AnimatePresence mode="popLayout">
            {data.map((item) => (
              <motion.div key={item.pipeline_instance_id} variants={itemVariants} layout>
                <PipelineRow
                  item={item}
                  onClick={() => handleRowClick(item)}
                  onAuditClick={() => handleAuditClick(item)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <OverrideDrawer open={drawerOpen} pipeline={selectedPipeline} onClose={handleDrawerClose} />
      <AuditDrawer pipelineId={auditId} open={auditOpen} onClose={handleAuditClose} />
    </>
  );
}
