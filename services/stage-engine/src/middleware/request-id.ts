import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

const MAX_INCOMING_LENGTH = 200;

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const requestId =
    incoming && incoming.length > 0 && incoming.length <= MAX_INCOMING_LENGTH
      ? incoming
      : randomUUID();
  c.set("requestId" as never, requestId);
  c.header("x-request-id", requestId);
  await next();
};
