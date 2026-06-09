"use client";

// Client-side i18n. Provider sits at the root (passed `locale` from a server
// component that read `process.env.LOCALE`). `useTr()` is the per-component
// translator hook.
//
// Pattern in a client component:
//   const tr = useTr();
//   return <h1>{tr("上传与识别")}</h1>;
//
// If the Chinese source string isn't in EN_DICT we render the Chinese — so
// missing keys degrade gracefully instead of crashing.

import { createContext, useContext, type ReactNode } from "react";
import { EN_DICT } from "@/locales/en";
import type { Locale } from "./i18n";

const LocaleContext = createContext<Locale>("zh");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Return a translator function for the active locale. */
export function useTr(): (zh: string) => string {
  const locale = useContext(LocaleContext);
  return (zh: string) => {
    if (locale !== "en") return zh;
    return EN_DICT[zh] ?? zh;
  };
}
