import { z } from "zod";
import { validateOrgNumber } from "./orgNumberValidator";

export const step1Schema = z.object({
  email: z.string().email("Ugyldig e-postadresse"),
  companyName: z.string().min(2, "Minimum 2 tegn"),
  industry: z.string().min(1, "Velg bransje"),
  city: z.string().min(2, "Oppgi by"),
  websiteUrl: z
    .string()
    .min(4, "Ugyldig URL")
    .transform((v) => (v.startsWith("http") ? v : `https://${v}`))
    .pipe(z.string().url("Ugyldig URL")),
});

export const step2Schema = z.object({
  firstName: z.string().min(2, "Minimum 2 tegn"),
  lastName: z.string().min(2, "Minimum 2 tegn"),
  street: z.string().min(2, "Påkrevd"),
  postalCode: z.string().regex(/^\d{4}$/, "Må være 4 siffer"),
  city: z.string().min(2, "Påkrevd"),
  orgNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().refine(validateOrgNumber, "Ugyldig organisasjonsnummer")),
});

export const step3Schema = z.object({
  aboutUs: z.string().optional(),
  ourHistory: z.string().optional(),
  ourConcept: z.string().optional(),
});

export const step4Schema = z.object({
  openingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        isClosed: z.boolean(),
        openTime: z.string().optional(),
        closeTime: z.string().optional(),
      }),
    )
    .length(7),
  phone: z.string().min(8, "Ugyldig telefonnummer"),
  instagram: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
});

export const step5Schema = z.object({
  restaurantType: z.string().optional(),
  cuisineTypes: z.array(z.string()).optional(),
  priceCategory: z.string().optional(),
  menuDescription: z.string().optional(),
});

export const step6Schema = z.object({
  employeeCount: z.string().optional(),
  teamInvites: z.array(z.string().email()).optional(),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type Step5Data = z.infer<typeof step5Schema>;
export type Step6Data = z.infer<typeof step6Schema>;
