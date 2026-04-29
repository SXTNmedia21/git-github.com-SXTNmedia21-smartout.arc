"use client";

import { createContext, useContext, useMemo } from "react";
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
  // Memoize `t` so consumers that include it in `useCallback` / `useEffect`
  // deps don't fire on every render — new identity only when locale or
  // namespace changes. Fixes infinite refetch loops on Contracts and other
  // pages that derive fetchers via useCallback([..., t]).
  const t = useMemo(() => createTranslator(locale, namespace), [locale, namespace]);
  return { t, locale };
}

export function useLocale(): SupportedLocale {
  return useContext(LocaleContext);
}
