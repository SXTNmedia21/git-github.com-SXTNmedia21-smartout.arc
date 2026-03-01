// ============================================
// crypto.ts
// SHA-256 hashing utility for API key validation.
// API keys are stored as hashes in platform_api_key —
// raw keys are never persisted after creation.
// Connected to: src/middleware/auth.ts (key validation)
// ============================================

import { createHash } from "node:crypto";

/**
 * Hashes an API key using SHA-256.
 * The resulting hex digest is compared against stored hashes
 * in the platform_api_key table.
 *
 * @param key - Raw API key from x-api-key header
 * @returns Hex-encoded SHA-256 hash
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
