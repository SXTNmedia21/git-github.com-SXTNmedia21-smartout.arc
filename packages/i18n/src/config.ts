export const defaultLocale = "nb" as const;
export const supportedLocales = ["nb", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const RTL_LOCALES: SupportedLocale[] = [];
export const fallbackLocale = "nb" as const;
