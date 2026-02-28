"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface CoreDepartment {
  id: string;
  name: string;
  roles: string[];
  description: string;
  isComplete: boolean;
}

interface DepartmentCanvasProps {
  departments: CoreDepartment[];
}

export function DepartmentCanvas({ departments }: DepartmentCanvasProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-zinc-400">
            👥
          </div>
          <h3 className="text-lg font-semibold text-white">Departments & Roles</h3>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className={`flex flex-col gap-3 rounded-xl border p-5 transition-colors ${
              dept.isComplete
                ? "border-zinc-700 bg-zinc-900"
                : "border-orange-500/30 bg-orange-500/5 ring-1 ring-orange-500/10 ring-inset"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">{dept.name}</div>
              {dept.isComplete ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
                </span>
              )}
            </div>

            {!dept.isComplete && (
              <div className="flex items-start gap-1.5 rounded-lg bg-orange-500/10 p-2 text-xs text-orange-400">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Requires definition: What is the hierarchy and operational responsibility of this
                  department?
                </span>
              </div>
            )}

            {dept.isComplete && dept.description && (
              <div className="line-clamp-2 text-sm text-zinc-400">{dept.description}</div>
            )}

            <div className="mt-1 flex flex-wrap gap-2">
              {dept.roles.map((role: string) => (
                <span
                  key={role}
                  className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
