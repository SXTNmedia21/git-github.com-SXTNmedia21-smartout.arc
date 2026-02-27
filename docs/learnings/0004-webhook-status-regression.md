---
id: 0004
title: Webhook status regression guard pattern
date: 2026-02-28
tags: [webhooks, docuseal, idempotency, api]
---

# Learning-0004: Webhook status regression guard pattern

## Context

The DocuSeal webhook handler at `apps/web/src/app/api/webhooks/docuseal/route.ts` updates employment contract status based on incoming events. Webhooks can arrive out of order — a `viewed` event might arrive after a `signed` event due to network delays or retries.

## Discovery

Without a status regression guard, a late-arriving lower-priority event can overwrite a higher-priority status. The fix is a `statusWeight` map that assigns numeric weights to each status, and a check that only allows forward transitions:

```typescript
const statusWeight: Record<string, number> = {
  draft: 0,
  sent: 1,
  viewed: 2,
  signed: 3,
  expired: 3,
  cancelled: 3,
};

const currentWeight = statusWeight[contract.status] ?? 0;
const newWeight = statusWeight[newStatus] ?? 0;

if (newWeight <= currentWeight) {
  return NextResponse.json({ received: true, skipped: "status_not_advanced" });
}
```

The webhook returns `200 OK` with `skipped: "status_not_advanced"` to prevent the external service from retrying.

## Impact

- Any webhook handler that updates a status enum should implement a regression guard
- Use numeric weights, not string comparison — status names don't sort alphabetically
- Terminal states (signed, expired, cancelled) should share the highest weight
- Always return 200 on skipped events — returning 4xx/5xx triggers unnecessary retries

## References

- File: `apps/web/src/app/api/webhooks/docuseal/route.ts`
- PR: #6 (Platform Admin Backoffice)
- Code review finding, fixed before merge
