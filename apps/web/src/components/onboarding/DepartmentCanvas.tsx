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
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">👥</div>
                    <h3 className="text-lg font-semibold text-white">Departments & Roles</h3>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {departments.map(dept => (
                    <div
                        key={dept.id}
                        className={`p-5 rounded-xl border flex flex-col gap-3 transition-colors ${dept.isComplete
                                ? "bg-zinc-900 border-zinc-700"
                                : "bg-orange-500/5 border-orange-500/30 ring-1 ring-inset ring-orange-500/10"
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-white">{dept.name}</div>
                            {dept.isComplete ? (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                            )}
                        </div>

                        {!dept.isComplete && (
                            <div className="text-xs text-orange-400 flex items-start gap-1.5 bg-orange-500/10 p-2 rounded-lg">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <span>Requires definition: What is the hierarchy and operational responsibility of this department?</span>
                            </div>
                        )}

                        {dept.isComplete && dept.description && (
                            <div className="text-sm text-zinc-400 line-clamp-2">
                                {dept.description}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-1">
                            {dept.roles.map((role: string) => (
                                <span key={role} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-xs font-medium border border-zinc-700">
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
