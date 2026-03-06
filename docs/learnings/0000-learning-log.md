---
title: Learning Log
status: done
updated: 2026-04-10
created: 2026-03-06
module: infra
tags: [learnings]
---

# Learning Log — infra-hardening

| #   | Date       | Learning                                                                                                                                                                          | Impact   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-04-10 | Caddy global server write timeout caps ALL downstream responses, even if reverse_proxy transport has higher timeouts. Never set global write timeout when streaming routes exist. | Critical |
| 2   | 2026-04-10 | HSTS preload is a one-way commitment to the browser preload list. Cannot be undone. Only safe when ALL subdomains are HTTPS forever.                                              | High     |
| 3   | 2026-04-10 | Removing port exposure from base compose breaks health-check scripts on the host. Fix: bind to 127.0.0.1 in prod overlay.                                                         | High     |
| 4   | 2026-04-10 | Docker Compose `${VAR:?msg}` refuses to start if var unset. Split fail-fast (base) and fallback (override) across files.                                                          | Medium   |
| 5   | 2026-04-10 | Scrapling is consumed by Edge Functions on the host, not Docker services. Needs host-accessible ports, not just Docker network DNS.                                               | Medium   |
