import { createHash } from "crypto";
import type { SiteSnapshot } from "../types/snapshot";
import { LIMITS } from "../constants";

/** SHA-256 hash of the snapshot JSON for deduplication. */
export function hashSnapshot(data: SiteSnapshot): string {
  const json = JSON.stringify(data);
  return createHash("sha256").update(json).digest("hex");
}

/** Checks that snapshot JSON does not exceed the size limit. */
export function validateSnapshotSize(data: SiteSnapshot): {
  valid: boolean;
  sizeBytes: number;
} {
  const json = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(json, "utf8");
  return { valid: sizeBytes <= LIMITS.maxSnapshotSizeBytes, sizeBytes };
}
