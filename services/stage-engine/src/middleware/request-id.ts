import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import type { AppEnv } from "../types/app-env.js";

const MAX_INCOMING_LENGTH = 200;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = c.req.header("x-request-id");
  const incoming = raw?.trim();
  const valid =
    incoming &&
    incoming.length > 0 &&
    incoming.length <= MAX_INCOMING_LENGTH &&
    !CONTROL_CHARS.test(incoming);
  const requestId = valid ? incoming : randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
};
