import { z } from "zod";

export const emailSchema = z.string().email();

export const passwordSchema = z.string().min(8);

export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, "Required format: +countryCode phoneNumber").nullish();
