/**
 * Timeline template data hooks — barrel re-export.
 *
 * Hooks in this folder:
 *   useTimelineTemplates  — list templates by scope (useQuery)
 *   useSaveTemplate       — save mutation (useMutation → POST /api/timeline-template)
 *   useApplyTemplate      — apply mutation (useMutation → POST /api/timeline-template/apply)
 *   useArchiveTemplate    — archive mutation (useMutation → PATCH /api/timeline-template/[id])
 *
 * Key factory:
 *   timelineTemplateKeys  — TanStack Query key shapes for this feature
 *
 * All mutation hooks delegate emit() to the capability tool via the BFF.
 * No client-side emit here per ADR-0287 (tool body owns gate + mutate + emit).
 *
 * Location note:
 *   These hooks live in apps/web/src/app/dashboard/_hooks/timeline-template/
 *   following the established project pattern (sibling hooks for schedule,
 *   settings, governance, etc. all live under dashboard/_hooks/).
 *   The spec asks for packages/data/src/timeline-template/ but packages/data
 *   has no React/TanStack dependency (pure Zod package) — hooks cannot live
 *   there without adding a React peer dependency to that package. T5 can decide
 *   whether to add that dependency if mobile native reuse is required; until
 *   then the mobile parity goal is satisfied by web PWA on port 8083.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Data hooks
 * ADR ref:  ADR-0334
 */

export * from "./keys";
export * from "./use-timeline-templates";
export * from "./use-save-template";
export * from "./use-apply-template";
export * from "./use-archive-template";
