import {
  i18n,
  resolveAppLocale,
  syncI18nLocale,
} from "@/app_directories/i18n/i18n";
import { useLocales } from "expo-localization";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  type PropsWithChildren,
} from "react";

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

type I18nContextValue = {
  readonly t: TranslateFn;
  readonly locale: "en" | "pt";
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const locale = resolveAppLocale(locales[0]?.languageCode);

  useLayoutEffect(() => {
    syncI18nLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, options) => String(i18n.t(key, options)),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
