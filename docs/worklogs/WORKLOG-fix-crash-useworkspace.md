---
title: "Worklog — fix-crash-useworkspace"
status: done
updated: 2026-03-02
created: 2026-03-02
module: web
tags: [bugfix, dashboard, workspace, crash]
---

# Worklog — fix-crash-useworkspace

## Status: 🟢 Done

## Done

- [x] Identified crash: fallback path in dashboard layout renders DashboardShell without WorkspaceProvider
- [x] Fixed: replaced fallback JSX render (lines 90-94) with `redirect("/onboarding")`
- [x] Typecheck passes (0 errors in dashboard/layout.tsx)
- [x] Committed and pushed

## Remaining

- (none)

## Decisions

| Date       | Decision                                          | Reason                                                     |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------- |
| 2026-03-02 | Redirect to /onboarding instead of /access-denied | User without workspace needs onboarding, not an error page |

## Log

| Date       | Time | Event                                              |
| ---------- | ---- | -------------------------------------------------- |
| 2026-03-02 | —    | Read layout.tsx, confirmed crash at lines 90-94    |
| 2026-03-02 | —    | Replaced fallback JSX with redirect("/onboarding") |
| 2026-03-02 | —    | Typecheck clean, committed, pushed, PR created     |
