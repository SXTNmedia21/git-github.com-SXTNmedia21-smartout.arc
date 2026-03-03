"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

// ── Fetch active session for current department ──────────────

export function useDepartmentSession(departmentId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["department-session", workspace.workspace_id, departmentId],
    enabled: !!departmentId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await (supabase.from as Function)("department_session")
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
    queryFn: async () => {
      const { data, error } = await (supabase.from as Function)("daily_reconciliation")
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
      const { data, error } = await (supabase.from as Function)("settlement_image")
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
      await supabase.functions.invoke("process-settlement-image", {
        body: { image_id: data.image_id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });
}

// ── Submit reconciliation ────────────────────────────────────

export function useSubmitReconciliation() {
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
      const { data: validation } = await supabase.functions.invoke("validate-settlement", {
        body: { reconciliation_id: reconciliationId },
      });

      // 2. Update reconciliation status
      const { data, error } = await (supabase.from as Function)("daily_reconciliation")
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
    onSuccess: () => {
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
    queryFn: async () => {
      const { data, error } = await (supabase.from as Function)("deviation")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
