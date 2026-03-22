import { z } from "zod";

export const bookingCtaContentSchema = z.object({
  heading: z.string().default("Reserve a Table"),
  body: z.string().default(""),
  buttonText: z.string().default("Book Now"),
  provider: z.enum(["none", "dinnerbooking", "opentable", "custom"]).default("none"),
  bookingUrl: z.string().default(""),
  showPhone: z.boolean().default(true),
});

export type BookingCtaContent = z.infer<typeof bookingCtaContentSchema>;

export const bookingCtaDefaults: BookingCtaContent = {
  heading: "Reserve a Table",
  body: "",
  buttonText: "Book Now",
  provider: "none",
  bookingUrl: "",
  showPhone: true,
};
