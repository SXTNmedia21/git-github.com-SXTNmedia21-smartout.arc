---
title: Decision Log
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: onboarding
tags: [decisions]
---

# Decision Log — onboarding-cleanup

| #   | Date       | Decision                                                                                     | Status   |
| --- | ---------- | -------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-26 | Delete showcase/ (dead code, 44 files, 2000+ lines)                                          | accepted |
| 2   | 2026-03-26 | Server-side re-entry guard in layout.tsx (not middleware) to avoid DB query on every request | accepted |
| 3   | 2026-03-26 | Zod schemas for Botsson tools in dedicated file (tool-schemas.ts) rather than inline         | accepted |
| 4   | 2026-03-26 | brandPanel i18n via key resolution in renderBrandPanel (no WizardShell type change needed)   | accepted |
| 5   | 2026-03-26 | Unified redirect via lib/redirect.ts using NEXT_PUBLIC_ROOT_DOMAIN env var                   | accepted |
| 6   | 2026-03-26 | Easing constants added to design-tokens (easingExpo + array variants)                        | accepted |
