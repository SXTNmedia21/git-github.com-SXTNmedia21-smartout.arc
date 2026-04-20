import { createHash } from "node:crypto";

/**
 * UUID namespace for strike-mcp generated entities. Constant — must never change.
 * Changing this would break all existing migrations.
 *
 * Generated once via uuidgen on 2026-04-07.
 */
export const STRIKE_NAMESPACE_UUID = "8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * UUIDv5 (RFC 4122 §4.3) using SHA-1.
 */
function uuidv5(name: string, namespace: string): string {
  const namespaceBytes = hexToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);

  const hash = createHash("sha1").update(combined).digest();
  const bytes = new Uint8Array(hash.subarray(0, 16));

  // Set version (5) in byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Set variant (RFC 4122) in byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

/**
 * Compute the deterministic v3 UUID for a strike-mcp entity.
 * Same inputs always produce the same UUID — re-running migrations collides
 * with existing data, surfacing duplicates as unique-constraint violations.
 */
export function strikeUuid(entity: string, bubbleId: string): string {
  return uuidv5(`${entity}:${bubbleId}`, STRIKE_NAMESPACE_UUID);
}
