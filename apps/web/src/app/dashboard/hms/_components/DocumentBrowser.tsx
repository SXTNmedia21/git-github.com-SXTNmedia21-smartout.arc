"use client";

import { useContext, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Search, ShieldCheck, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export type DocumentSelection = {
  type: "handbook" | "policy" | "protocol" | "procedure";
  id: string;
  name: string;
};

type Props = {
  onSelect: (selection: DocumentSelection) => void;
  selected: DocumentSelection | null;
};

type PolicyNode = {
  policyId: string;
  name: string;
  policyType: string;
  protocols: ProtocolNode[];
};

type ProtocolNode = {
  protocolId: string;
  name: string;
  procedures: ProcedureNode[];
};

type ProcedureNode = {
  procedureId: string;
  name: string;
};

function useDocumentTree() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ["hms", "document-tree", workspace.workspace_id],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PolicyNode[]> => {
      const supabase = createClient();

      const [policiesRes, protocolsRes, proceduresRes] = await Promise.all([
        supabase
          .from("policy")
          .select("policy_id, name, policy_type")
          .eq("workspace_id", workspace.workspace_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("protocol")
          .select("protocol_id, name, policy_id")
          .eq("workspace_id", workspace.workspace_id)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("procedure")
          .select("procedure_id, name, protocol_id")
          .eq("workspace_id", workspace.workspace_id)
          .eq("is_active", true)
          .order("sort_order"),
      ]);

      if (policiesRes.error) throw policiesRes.error;
      if (protocolsRes.error) throw protocolsRes.error;
      if (proceduresRes.error) throw proceduresRes.error;

      const procByProtocol = new Map<string, ProcedureNode[]>();
      for (const p of proceduresRes.data ?? []) {
        if (!p.protocol_id) continue;
        const list = procByProtocol.get(p.protocol_id) ?? [];
        list.push({ procedureId: p.procedure_id, name: p.name });
        procByProtocol.set(p.protocol_id, list);
      }

      const protoByPolicy = new Map<string, ProtocolNode[]>();
      for (const p of protocolsRes.data ?? []) {
        if (!p.policy_id) continue;
        const list = protoByPolicy.get(p.policy_id) ?? [];
        list.push({
          protocolId: p.protocol_id,
          name: p.name,
          procedures: procByProtocol.get(p.protocol_id) ?? [],
        });
        protoByPolicy.set(p.policy_id, list);
      }

      return (policiesRes.data ?? []).map((p) => ({
        policyId: p.policy_id,
        name: p.name,
        policyType: p.policy_type,
        protocols: protoByPolicy.get(p.policy_id) ?? [],
      }));
    },
  });
}

export function DocumentBrowser({ onSelect, selected }: Props) {
  const { isDark } = useContext(DashboardContext);
  const { data: tree, isLoading } = useDocumentTree();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!tree) return [];
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    return tree
      .map((policy) => ({
        ...policy,
        protocols: policy.protocols
          .map((proto) => ({
            ...proto,
            procedures: proto.procedures.filter((proc) => proc.name.toLowerCase().includes(q)),
          }))
          .filter((proto) => proto.name.toLowerCase().includes(q) || proto.procedures.length > 0),
      }))
      .filter((policy) => policy.name.toLowerCase().includes(q) || policy.protocols.length > 0);
  }, [tree, search]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isSelected = (type: string, id: string) => selected?.type === type && selected?.id === id;

  return (
    <div
      className={`flex w-72 shrink-0 flex-col border-r ${isDark ? "border-zinc-800 bg-zinc-950/50" : "border-border bg-muted/30"}`}
    >
      {/* Search */}
      <div className="border-b border-inherit p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Sok i dokumenter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-xs">
            Ingen dokumenter funnet.
          </p>
        ) : (
          filtered.map((policy) => (
            <div key={policy.policyId} className="mb-1">
              {/* Policy level */}
              <button
                onClick={() => {
                  toggleExpand(policy.policyId);
                  onSelect({ type: "policy", id: policy.policyId, name: policy.name });
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold transition-colors ${
                  isSelected("policy", policy.policyId)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {expanded.has(policy.policyId) ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{policy.name}</span>
              </button>

              {/* Protocols */}
              {expanded.has(policy.policyId) &&
                policy.protocols.map((proto) => (
                  <div key={proto.protocolId} className="ml-4">
                    <button
                      onClick={() => {
                        toggleExpand(proto.protocolId);
                        onSelect({ type: "protocol", id: proto.protocolId, name: proto.name });
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                        isSelected("protocol", proto.protocolId)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {proto.procedures.length > 0 ? (
                        expanded.has(proto.protocolId) ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )
                      ) : (
                        <span className="w-3" />
                      )}
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{proto.name}</span>
                      {proto.procedures.length > 0 && (
                        <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
                          {proto.procedures.length}
                        </span>
                      )}
                    </button>

                    {/* Procedures */}
                    {expanded.has(proto.protocolId) &&
                      proto.procedures.map((proc) => (
                        <button
                          key={proc.procedureId}
                          onClick={() =>
                            onSelect({ type: "procedure", id: proc.procedureId, name: proc.name })
                          }
                          className={`ml-4 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                            isSelected("procedure", proc.procedureId)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{proc.name}</span>
                        </button>
                      ))}
                  </div>
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
