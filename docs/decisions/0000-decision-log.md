---
title: Decision Log
status: done
updated: 2026-04-10
created: 2026-03-06
module: infra
tags: [decisions]
---

# Decision Log — infra-hardening

| #   | Date       | Decision                                                                                        | Status |
| --- | ---------- | ----------------------------------------------------------------------------------------------- | ------ |
| 1   | 2026-04-10 | Use SAMEORIGIN not DENY for X-Frame-Options — may need iframe embedding                         | active |
| 2   | 2026-04-10 | HSTS without preload — irreversible commitment, not safe for all subdomains yet                 | active |
| 3   | 2026-04-10 | No global Caddy write timeout — would kill SSE/streaming responses at 30s                       | active |
| 4   | 2026-04-10 | Prod service ports bound to 127.0.0.1 — health-check.sh needs host access, no internet exposure | active |
| 5   | 2026-04-10 | Pin n8n to 2.10.4 — prevent :latest breaking changes on deploy                                  | active |
| 6   | 2026-04-10 | Stage Engine gets 300s transport timeouts + flush_interval -1 for AI streaming                  | active |
