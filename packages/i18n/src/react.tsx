"use client";

import { createContext, useContext } from "react";
import { createTranslator } from "./translate";
import type { SupportedLocale } from "./config";

const LocaleContext = createContext<SupportedLocale>("nb");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: SupportedLocale;
  children: React.ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useTranslation(namespace: string) {
  const locale = useContext(LocaleContext);
  const t = createTranslator(locale, namespace);
  return { t, locale };
}

export function useLocale(): SupportedLocale {
  return useContext(LocaleContext);
}
