export const defaultLocale = "nb" as const;
export const supportedLocales = ["nb", "en", "sv", "da", "pl", "ar", "so", "fi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const RTL_LOCALES: SupportedLocale[] = ["ar"];
export const fallbackLocale = "nb" as const;
