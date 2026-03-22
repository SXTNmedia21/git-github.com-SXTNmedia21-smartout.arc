import { z } from "zod";

const dayHoursSchema = z.object({
  day: z.string(),
  open: z.string().default(""),
  close: z.string().default(""),
  closed: z.boolean().default(false),
});

export const hoursContentSchema = z.object({
  heading: z.string().default("Opening Hours"),
  description: z.string().default(""),
  schedule: z.array(dayHoursSchema).default([]),
  specialNote: z.string().default(""),
});

export type HoursContent = z.infer<typeof hoursContentSchema>;

export const hoursDefaults: HoursContent = {
  heading: "Opening Hours",
  description: "",
  schedule: [],
  specialNote: "",
};
