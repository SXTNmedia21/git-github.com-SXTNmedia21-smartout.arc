"use client";

import { useState } from "react";
import { Play, Loader2, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EndpointDef } from "../../_components/service-contracts";
import type { TestResult } from "@/app/api/platform-admin/services/test/route";

type Props = {
  endpoint: EndpointDef;
  serviceKey: string;
};

const methodColors: Record<string, string> = {
  GET: "border-emerald-500/30 text-emerald-500",
  POST: "border-blue-500/30 text-blue-500",
  PUT: "border-orange-500/30 text-orange-500",
  PATCH: "border-orange-500/30 text-orange-500",
  DELETE: "border-red-500/30 text-red-500",
};

export function EndpointTestCard({ endpoint, serviceKey }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function runTest() {
    setTesting(true);
    setResult(null);
    setExpanded(true);

    try {
      const res = await fetch("/api/platform-admin/services/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceKey,
          method: endpoint.method,
          path: endpoint.path,
          body: endpoint.defaultBody ?? undefined,
        }),
      });
      const data = (await res.json()) as TestResult;
      setResult(data);
    } catch {
      setResult({
        status: 0,
        ok: false,
        responseTime: 0,
        headers: {},
        body: null,
        error: "Network error",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-md border">
      {/* Row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Badge
          variant="outline"
          className={cn(
            "w-16 shrink-0 justify-center font-mono text-[10px]",
            methodColors[endpoint.method],
          )}
        >
          {endpoint.method}
        </Badge>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => result && setExpanded(!expanded)}
        >
          <code className="min-w-0 truncate text-xs">{endpoint.path}</code>
          {endpoint.category && (
            <Badge variant="secondary" className="shrink-0 text-[9px]">
              {endpoint.category}
            </Badge>
          )}
        </button>

        <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
          {endpoint.description}
        </span>

        {/* Auth badge */}
        {endpoint.auth !== "none" && (
          <Badge variant="outline" className="text-muted-foreground shrink-0 text-[9px]">
            {endpoint.auth}
          </Badge>
        )}

        {/* Result indicator */}
        {result && !testing && (
          <div className="flex items-center gap-1.5">
            {result.ok ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <X className="h-3.5 w-3.5 text-red-500" />
            )}
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                result.ok ? "text-emerald-500" : "text-red-500",
              )}
            >
              {result.status || "ERR"}
            </span>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {result.responseTime}ms
            </span>
          </div>
        )}

        {/* Test button */}
        {endpoint.testable ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 text-xs"
            onClick={runTest}
            disabled={testing}
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Test
          </Button>
        ) : (
          <span className="text-muted-foreground shrink-0 text-[10px]">manual only</span>
        )}

        {/* Expand chevron */}
        {result && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded result */}
      {expanded && result && (
        <div className="border-t px-3 py-3">
          {result.error && <p className="mb-2 text-xs text-red-400">{result.error}</p>}
          <div className="bg-muted max-h-64 overflow-auto rounded-md p-3">
            <pre className="text-[11px] leading-relaxed break-all whitespace-pre-wrap">
              {typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}
            </pre>
          </div>
          {Object.keys(result.headers).length > 0 && (
            <details className="mt-2">
              <summary className="text-muted-foreground cursor-pointer text-[10px]">
                Response headers
              </summary>
              <pre className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                {Object.entries(result.headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
