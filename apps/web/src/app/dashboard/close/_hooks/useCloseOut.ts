"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
// ── Fetch active session for current department ──────────────

export function useDepartmentSession(departmentId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["department-session", workspace.workspace_id, departmentId],
    enabled: !!departmentId,
    staleTime: 30 * 1000, // 30 seconds — real-time active session data
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0]!;
      const { data, error } = await supabase
        .from("department_session")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .eq("department_id", departmentId!)
        .eq("session_date", today)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// ── Fetch reconciliation for session ─────────────────────────

export function useReconciliation(sessionId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["reconciliation", workspace.workspace_id, sessionId],
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile reconciliation data
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select("*, settlement_image(*)")
        .eq("session_id", sessionId!)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });
}

// ── Upload settlement image ──────────────────────────────────

export function useUploadSettlementImage() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reconciliationId,
      file,
      sourceType,
      profileId,
    }: {
      reconciliationId: string;
      file: File;
      sourceType: "pos" | "terminal" | "z_report" | "cash_count" | "other";
      profileId: string;
    }) => {
      const date = new Date().toISOString().split("T")[0];
      const ext = file.name.split(".").pop() ?? "jpg";
      const storagePath = `${workspace.workspace_id}/settlements/${date}/${sourceType}-${Date.now()}.${ext}`;

      // 1. Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from("settlements")
        .upload(storagePath, file);

      if (uploadErr) throw uploadErr;

      // 2. Create settlement_image record
      const { data, error } = await supabase
        .from("settlement_image")
        .insert({
          reconciliation_id: reconciliationId,
          workspace_id: workspace.workspace_id,
          source_type: sourceType,
          storage_path: storagePath,
          uploaded_by: profileId,
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Trigger OCR processing
      const response = await fetch("/api/reconciliation/settlement-image/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: data.image_id }),
      });
      if (!response.ok) {
        const { error } = (await response.json()) as { error?: string };
        throw new Error(error || "Processing failed");
      }
      await response.json();

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });
}

// ── Submit reconciliation ────────────────────────────────────

export function useSubmitReconciliation() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reconciliationId,
      profileId,
    }: {
      reconciliationId: string;
      profileId: string;
    }) => {
      // 1. Trigger validation
      const validationResponse = await fetch("/api/reconciliation/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconciliation_id: reconciliationId }),
      });
      if (!validationResponse.ok) {
        const { error } = (await validationResponse.json()) as { error?: string };
        throw new Error(error || "Validation failed");
      }
      const validation = await validationResponse.json();

      // 2. Update reconciliation status
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .update({
          status: "submitted",
          settled_by: profileId,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("reconciliation_id", reconciliationId)
        .select()
        .single();

      if (error) throw error;
      return { reconciliation: data, validation };
    },
    onSuccess: (_data, { reconciliationId, profileId }) => {
      void emit({
        event: "reconciliation submitted",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: { reconciliation_id: reconciliationId },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });
}

// ── Fetch deviations for session ─────────────────────────────

export function useSessionDeviations(sessionId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["session-deviations", workspace.workspace_id, sessionId],
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile deviation data
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deviation")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
