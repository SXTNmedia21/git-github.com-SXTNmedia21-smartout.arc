// ============================================
// crypto.ts
// SHA-256 hashing utility for API key validation.
// API keys are stored as SHA-256 hashes in platform_api_key.
// We hash the incoming key and compare against the stored hash.
// Connected to: src/middleware/auth.ts (uses hashApiKey)
// Connected to: SECURITY.md (key storage pattern)
// ============================================

import { createHash } from "node:crypto";

/**
 * Hashes a raw API key using SHA-256.
 * Used to look up API keys in the platform_api_key table,
 * which stores only hashes — never raw keys.
 *
 * @param key - The raw API key from the x-api-key header
 * @returns The SHA-256 hex digest
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
