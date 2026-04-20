// norwegian-validators.ts
//
// Validation functions for Norwegian national identifiers.
// Both personnummer and bank account use Modulus 11 checksum verification.

/**
 * Validate a Norwegian personnummer (national identity number).
 * Format: 11 digits — DDMMYYIIIKK where I = individual, K = check digits.
 * Uses Modulus 11 checksum for both control digits.
 */
export function validatePersonnummer(s: string): boolean {
  if (!/^\d{11}$/.test(s)) return false;

  const d = s.split("").map(Number);

  // Control digit 1 (k1) — weights: 3,7,6,1,8,9,4,5,2
  const w1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
  const sum1 = w1.reduce((sum, w, i) => sum + w * (d[i] ?? 0), 0);
  const r1 = 11 - (sum1 % 11);
  const k1 = r1 === 11 ? 0 : r1;
  if (k1 === 10 || k1 !== d[9]) return false;

  // Control digit 2 (k2) — weights: 5,4,3,2,7,6,5,4,3,2
  const w2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum2 = w2.reduce((sum, w, i) => sum + w * (d[i] ?? 0), 0);
  const r2 = 11 - (sum2 % 11);
  const k2 = r2 === 11 ? 0 : r2;
  if (k2 === 10 || k2 !== d[10]) return false;

  return true;
}

/**
 * Validate a Norwegian bank account number.
 * Format: 11 digits — RRRR.CC.DDDDK where R=registrer, C=account type, D=digits, K=check.
 * Uses Modulus 11 checksum for the last control digit.
 */
export function validateNorwegianBankAccount(s: string): boolean {
  // Strip dots and spaces for flexibility
  const clean = s.replace(/[\s.]/g, "");
  if (!/^\d{11}$/.test(clean)) return false;

  const d = clean.split("").map(Number);

  // Modulus 11 — weights: 5,4,3,2,7,6,5,4,3,2 for first 10 digits
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * (d[i] ?? 0), 0);
  const remainder = 11 - (sum % 11);
  const checkDigit = remainder === 11 ? 0 : remainder;

  // Remainder 10 means the account number is invalid
  if (checkDigit === 10) return false;

  return checkDigit === d[10];
}
