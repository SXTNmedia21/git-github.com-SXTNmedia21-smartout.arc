// packages/utils/src/hash/index.ts
// SHA-256 hex helper for bulk_import file + row idempotency (ADR-0401).
import { createHash } from "node:crypto";

export function sha256Hex(input: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}
