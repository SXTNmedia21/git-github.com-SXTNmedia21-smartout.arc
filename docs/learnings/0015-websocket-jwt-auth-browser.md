---
title: "Browser WebSocket API Cannot Send Custom Headers"
id: LEARNING_0015
status: canonical
layer: learning
created: 2026-03-14
updated: 2026-04-07
tags: [websocket, auth, browser, jwt]
---

# Learning-0015: Browser WebSocket API Cannot Send Custom Headers

> Renumbered from Learning-0001 → Learning-0015 on 2026-04-07. Original 0001 number collided with `0001-turbopack-x-forwarded-host.md` (older). Turbopack learning kept the 0001 slot.

## Context

Implementing Guardian WebSocket auth between the Next.js dashboard and the stage engine. Initial implementation used WebSocket subprotocol (`["bearer", token]`) to pass the JWT, while the server read from `headers["authorization"]`.

## Discovery

The browser `WebSocket` constructor only accepts a URL and an optional protocols array. It does **not** support custom headers like `Authorization: Bearer <token>`. The subprotocol field (`Sec-WebSocket-Protocol`) is technically available but was not matched on the server side, causing silent auth failures.

The reliable pattern for browser-to-server WebSocket auth is passing the token as a **query parameter**: `ws://host/path?token=<jwt>`. The server reads it from the URL before completing the upgrade handshake.

## Impact

- All future WebSocket endpoints in the stage engine must use query-param auth, not `Authorization` headers
- The `authenticateUpgrade()` function in `routes/guardian.ts` reads `url.searchParams.get("token")`
- Client-side hook passes `?token=${session.access_token}` in the WebSocket URL
- Tokens in query params appear in server access logs — ensure logs are not exposed publicly

## References

- `services/stage-engine/src/routes/guardian.ts` — server-side auth
- `apps/web/src/app/dashboard/guardian/_hooks/useGuardianSocket.ts` — client-side connection
- MDN WebSocket API: constructor only accepts `(url, protocols?)`, no headers option
