---
title: Decision Log
status: done
updated: 2026-03-20
created: 2026-03-20
module: contracts
tags: [decisions]
---

# Decision Log — contract-enhancements

| #   | Date       | Decision                                                                                                                               | Status   |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-20 | Extract placeholder logic to `@smartout/utils` as pure functions (no DB deps) so both platform-admin and contract-service can use them | Accepted |
| 2   | 2026-03-20 | `contract_attachment` table: platform-admin only, no RLS policies, all access via `service_role`                                       | Accepted |
| 3   | 2026-03-20 | Del 3 (DocuSeal multi-document delivery) deferred to separate branch — higher risk, needs manual DocuSeal testing                      | Accepted |
| 4   | 2026-03-20 | Use dynamic `import()` for `@smartout/utils` in Next.js API route to avoid workspace resolution issues                                 | Accepted |
