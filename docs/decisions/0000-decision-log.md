---
title: Decision Log
status: in_progress
updated: 2026-04-06
created: 2026-04-06
module: contracts
tags: [decisions]
---

# Decision Log — employee-contract-management

| # | Date | Decision | Status |
|---|------|----------|--------|
| 1 | 2026-04-06 | Reuse `contract` table for employee contracts via `contract_type='employee'` branching, link to `employment_contract` via new `signing_contract_id` FK | accepted |
| 2 | 2026-04-06 | DocuSeal webhook owns `contract.status`; `employment_contract.status` is propagated from webhook (declined → terminated since enum has no declined value) | accepted |
| 3 | 2026-04-06 | Botsson `sendEmployeeContract` placed in `suggestTools` (not autonomous) — irreversible legal actions require user confirmation | accepted |
| 4 | 2026-04-06 | Service-to-service auth uses `X-Service-Key` header (NOT `Authorization: Bearer`) — applies to all Botsson tool → contract service calls | accepted |
| 5 | 2026-04-06 | Botsson tool fetch calls require AbortController with 10s timeout — prevents agent hangs on slow/down services | accepted |
