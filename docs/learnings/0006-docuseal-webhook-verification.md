---
id: 0006
title: DocuSeal uses plain shared secret for webhook verification
status: canonical
date: 2026-02-28
tags: [docuseal, webhooks, security]
layer: learning
---

# Learning-0006: DocuSeal uses plain shared secret for webhook verification

## Context

During code review of the DocuSeal webhook handler, a potential issue was flagged: the webhook verification compares a header value directly against a stored secret using `===`, rather than computing an HMAC signature.

## Discovery

DocuSeal's webhook verification uses a plain shared secret token — NOT HMAC. The webhook sends a token in a header, and the server compares it directly. This is by design and is DocuSeal's documented verification method.

```typescript
// CORRECT for DocuSeal — plain secret comparison
const token = request.headers.get("x-docuseal-webhook-token");
if (token !== env.DOCUSEAL_WEBHOOK_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

This differs from services like Stripe or GitHub which use HMAC-SHA256 signatures.

## Impact

- DocuSeal webhooks use header-based shared secret verification (not HMAC)
- Don't "fix" this to use HMAC — it would break the integration
- The `DOCUSEAL_WEBHOOK_SECRET` env var must be registered in `env.ts` and accessed via `env.DOCUSEAL_WEBHOOK_SECRET`

## References

- File: `apps/web/src/app/api/webhooks/docuseal/route.ts`
- PR: #6 (Platform Admin Backoffice)
