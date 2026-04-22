// packages/ai/src/lib/pii-redact.ts
// ADR-0184 § Redaction Pipeline — regex-based redact-on-write.
//
// Known-PII classes redact to placeholder; raw match is returned for envelope
// storage (the caller stores the raw payload encrypted in
// agent_session_envelope and keeps only the redacted content in
// agent_session_recording).
//
// The redactor is intentionally simple and Norwegian-biased (personnummer,
// Norwegian bank accounts, +47 phone numbers, kr/NOK salary hints). Address
// and medical free-text cannot be caught by regex — they rely on explicit
// channel guards (ADR-0078) and admin-initiated classification, so they
// are declared in PII_CLASSES but not matched here.

export const PII_CLASSES = [
  "personnummer",
  "bank",
  "email",
  "phone",
  "address",
  "salary",
  "medical",
  "free_text",
] as const;

export type PiiClass = (typeof PII_CLASSES)[number];

type EnvelopeEntry = { pii_class: PiiClass; raw: string };

export type RedactResult = {
  redacted: string;
  redactedObj?: unknown;
  envelopes: EnvelopeEntry[];
};

// Patterns ordered by specificity (most specific first). `personnummer` before
// `bank` because both are 11 digits; personnummer's DDMMYY prefix is checked
// via the dash-or-space break the regex assumes.
const PATTERNS: Array<{ cls: PiiClass; re: RegExp }> = [
  { cls: "personnummer", re: /\b\d{6}[-\s]?\d{5}\b/g },
  { cls: "bank", re: /\b\d{4}[.\s]?\d{2}[.\s]?\d{5}\b/g },
  { cls: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { cls: "phone", re: /\b(?:\+47|0047)?\s?\d{8}\b/g },
  { cls: "salary", re: /\b\d{4,7}\s?(?:kr|NOK|,-)\b/gi },
];

export function redactPII(input: string | Record<string, unknown>): RedactResult {
  if (typeof input === "string") {
    return redactString(input);
  }
  return redactObject(input);
}

function redactString(s: string): RedactResult {
  const envelopes: EnvelopeEntry[] = [];
  let out = s;
  for (const { cls, re } of PATTERNS) {
    out = out.replace(re, (match) => {
      envelopes.push({ pii_class: cls, raw: match });
      return `<${cls}>`;
    });
  }
  return { redacted: out, envelopes };
}

function redactObject(obj: Record<string, unknown>): RedactResult {
  const envelopes: EnvelopeEntry[] = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = redactString(v);
      envelopes.push(...r.envelopes);
      return r.redacted;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  const redactedObj = walk(obj);
  return {
    redacted: JSON.stringify(redactedObj),
    redactedObj,
    envelopes,
  };
}
