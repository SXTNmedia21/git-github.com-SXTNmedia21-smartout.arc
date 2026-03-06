---
title: Decision Log
status: in_progress
updated: 2026-04-08
created: 2026-03-04
module: meta
tags: [decisions]
---

# Decision Log

| #   | Date       | Decision                                                                                                | Status | Module     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1   | 2026-04-08 | Bypass finalize-workspace Edge Function — call `finalize_onboarding_workspace` RPC directly from client | active | onboarding |
| 2   | 2026-04-08 | RPC creates company on-the-fly if workspace was provisioned without one (NULL company_id)               | active | onboarding |
