import { createContext, useContext, useState, useEffect, useCallback } from "react";
import pt from "../locales/pt.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Lang = "pt" | "en" | "es";

const TRANSLATIONS: Record<Lang, Record<string, any>> = { pt, en, es };

const STORAGE_KEY = "lucro_driver_lang";

// ─── Auto-detect language from browser ────────────────────────────────────────
function detectLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved && ["pt", "en", "es"].includes(saved)) return saved;

  const nav = navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("es")) return "es";
  return "en";
}

// ─── Get nested value from a translation object ───────────────────────────────
function resolve(obj: Record<string, any>, key: string): string {
  const parts = key.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return key;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : key;
}

// ─── Interpolate {placeholder} values ────────────────────────────────────────
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "pt",
  setLang: () => {},
  t: (key) => key,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const translations = TRANSLATIONS[lang];
      const enFallback   = TRANSLATIONS["en"];
      const raw = resolve(translations, key) !== key
        ? resolve(translations, key)
        : resolve(enFallback, key);
      return interpolate(raw, params);
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useT() {
  return useContext(I18nContext);
}

// ─── Language metadata ────────────────────────────────────────────────────────
export const LANG_OPTIONS: { id: Lang; label: string; flag: string }[] = [
  { id: "pt", label: "Português", flag: "🇧🇷" },
  { id: "en", label: "English",   flag: "🇺🇸" },
  { id: "es", label: "Español",   flag: "🇪🇸" },
];
