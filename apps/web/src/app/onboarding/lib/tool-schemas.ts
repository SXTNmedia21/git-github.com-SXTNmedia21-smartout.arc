/**
 * Zod schemas for Botsson tool parameter validation.
 *
 * Each schema validates the params object that Ultravox sends when
 * the voice agent invokes a client tool. Params arrive as string values
 * (some containing JSON) — schemas coerce and validate at the boundary.
 */

import { z } from "zod";

/** Helper: parse a JSON string param into an array, defaulting to empty */
const jsonArray = z
  .string()
  .default("[]")
  .transform((s) => JSON.parse(s) as unknown);

const jsonObject = z
  .string()
  .default("{}")
  .transform((s) => JSON.parse(s) as unknown);

// ── Tools with no parameters ──

export const getOnboardingStateSchema = z.object({});
export const advanceToNextSectionSchema = z.object({});
export const finalizeOnboardingSchema = z.object({});

// ── Business & Season ──

export const updateBusinessSchema = z.object({
  fields: jsonObject.pipe(
    z
      .object({
        name: z.string().optional(),
        orgNumber: z.string().optional(),
        website: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        industry: z.string().optional(),
        employeeCount: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough(),
  ),
});

export const updateSeasonSchema = z.object({
  fields: jsonObject.pipe(
    z
      .object({
        name: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .passthrough(),
  ),
});

// ── Collections ──

export const addDepartmentsSchema = z.object({
  names: jsonArray.pipe(z.array(z.string().min(1))),
});

export const addLocationsSchema = z.object({
  locations: jsonArray.pipe(
    z.array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["main", "outdoor", "satellite", "other"]).optional(),
      }),
    ),
  ),
});

export const addZonesSchema = z.object({
  locationName: z.string().min(1),
  zones: jsonArray.pipe(z.array(z.object({ name: z.string().min(1) }))),
});

export const addProceduresSchema = z.object({
  names: jsonArray.pipe(z.array(z.string().min(1))),
});

// ── Intelligence ──

export const searchCompanySchema = z.object({
  name: z.string().min(1),
  city: z.string().optional().default(""),
});

export const identifyCompanySchema = z.object({
  orgNumber: z.string().min(1),
});

export const scrapeWebsiteSchema = z.object({
  url: z.string().min(1),
});

// ── Knowledge ──

export const addKeyFactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const saveMemorySchema = z.object({
  content: z.string().min(1),
  memoryType: z.enum(["constant", "temporal"]).default("constant"),
  expiresAt: z.string().optional(),
});
