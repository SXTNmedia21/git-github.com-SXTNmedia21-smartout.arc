"use client";

import { Bot, Shield, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAuthorityConfig,
  useUpdateAuthority,
  CAPABILITIES,
  type CapabilityName,
  type AuthorityLevel,
} from "../_hooks/use-authority-config";

const CAPABILITY_META: Record<
  CapabilityName,
  { label: string; description: string; icon: string }
> = {
  knowledge: {
    label: "Kunnskap",
    description: "Policyer, prosedyrer, FAQ-oppslag",
    icon: "📚",
  },
  schedule: {
    label: "Vaktplan",
    description: "Vaktspørsmål, bytteforespørsler, tilgjengelighet",
    icon: "📅",
  },
  training: {
    label: "Opplæring",
    description: "Protokoller, readiness-status, kunnskapstester",
    icon: "🎓",
  },
  operations: {
    label: "Drift",
    description: "Avdelingsøkter, sjekklister, rutiner",
    icon: "⚙️",
  },
  profile: {
    label: "Profil",
    description: "Ansattinformasjon, team, kontraktstatus",
    icon: "👤",
  },
  communication: {
    label: "Kommunikasjon",
    description: "Varsler via SMS, push, e-post",
    icon: "💬",
  },
  memory: {
    label: "Hukommelse",
    description: "Samtalehistorikk, brukerpreferanser",
    icon: "🧠",
  },
  payroll: {
    label: "Lønn",
    description: "Lønnsberegning, overtid, fradrag",
    icon: "💰",
  },
};

const AUTHORITY_LEVELS: { value: AuthorityLevel; label: string; description: string }[] = [
  { value: "autonomous", label: "Autonom", description: "Handler uten bekreftelse" },
  { value: "confirm", label: "Bekreft", description: "Foreslår, bruker bekrefter" },
  { value: "suggest", label: "Foreslå", description: "Foreslår til leder-kø" },
  { value: "read_only", label: "Kun lesing", description: "Kan bare slå opp info" },
  { value: "disabled", label: "Deaktivert", description: "Helt avslått" },
];

function getLevelColor(level: AuthorityLevel): string {
  switch (level) {
    case "autonomous":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "confirm":
      return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    case "suggest":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "read_only":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-400";
    case "disabled":
      return "border-red-500/30 bg-red-500/10 text-red-400";
  }
}

export default function AgentConfigPage() {
  const { data: config, isLoading, error } = useAuthorityConfig();
  const updateAuthority = useUpdateAuthority();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">Kunne ikke laste konfigurasjon.</p>
        <p className="text-xs text-zinc-500">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/ai"
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            <Bot className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Mr. Botsson — Konfigurasjon</h1>
            <p className="text-sm text-zinc-500">
              Kontroller hva Mr. Botsson kan gjøre i denne arbeidsplassen
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
        <div className="text-sm text-zinc-300">
          <p className="font-medium text-indigo-300">Autoritetsnivåer</p>
          <p className="mt-1 text-zinc-400">
            Hver kapabilitet kan konfigureres uavhengig. Standard er{" "}
            <span className="font-medium text-zinc-300">Kun lesing</span> — Mr. Botsson kan svare på
            spørsmål, men ikke utføre handlinger.
          </p>
        </div>
      </div>

      {/* Capability grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {CAPABILITIES.map((capability) => {
          const meta = CAPABILITY_META[capability];
          const level = config?.[capability] ?? "read_only";

          return (
            <Card key={capability} className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <CardTitle className="text-base text-zinc-100">{meta.label}</CardTitle>
                      <CardDescription className="mt-0.5 text-xs text-zinc-500">
                        {meta.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getLevelColor(level)}>
                    {AUTHORITY_LEVELS.find((l) => l.value === level)?.label ?? level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Select
                  value={level}
                  onValueChange={(value: string) => {
                    updateAuthority.mutate({
                      capability,
                      level: value as AuthorityLevel,
                    });
                  }}
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-900">
                    {AUTHORITY_LEVELS.map((al) => (
                      <SelectItem
                        key={al.value}
                        value={al.value}
                        className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{al.label}</span>
                          <span className="text-xs text-zinc-500">{al.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
