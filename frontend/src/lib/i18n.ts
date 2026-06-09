// Server-safe i18n helpers (no React). Use these in route handlers,
// AI prompt construction, and any non-React server-side code.
//
// Locale is read from process.env.LOCALE at runtime. The same codebase
// is deployed twice on Render — once with LOCALE unset (defaults to zh)
// and once with LOCALE=en.

import { EN_DICT } from "@/locales/en";

export type Locale = "zh" | "en";

export function getServerLocale(): Locale {
  return (process.env.LOCALE || "").toLowerCase() === "en" ? "en" : "zh";
}

/** Translate a Chinese source string for the configured server locale. */
export function serverTr(zh: string): string {
  if (getServerLocale() !== "en") return zh;
  return EN_DICT[zh] ?? zh;
}

/** Look up a non-source-string key (e.g. "delivery_note_prompt") in the EN dict.
 *  Returns the Chinese fallback that you pass in if the dict has no entry
 *  for the key. */
export function serverTrKey(key: string, zhFallback: string): string {
  if (getServerLocale() !== "en") return zhFallback;
  return EN_DICT[key] ?? zhFallback;
}

/** Browser-runtime translator. Reads <html lang> set by the root layout,
 *  so the same code path works in any client-side module without needing
 *  React context. Returns the Chinese unchanged when not in `en` mode. */
export function browserTr(zh: string): string {
  if (typeof document === "undefined") return zh;
  if (!document.documentElement.lang.toLowerCase().startsWith("en")) return zh;
  return EN_DICT[zh] ?? zh;
}
