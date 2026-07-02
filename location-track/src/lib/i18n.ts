export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];
export type Direction = "ltr" | "rtl";

export const defaultLocale: Locale = "en";
export const localeCookieName = "location-attendance-locale";

const dictionaries = {
  en: () => import("../../messages/en.json").then((module) => module.default),
  ar: () => import("../../messages/ar.json").then((module) => module.default),
};

export type Messages = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDirection(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

export async function getMessages(locale: Locale): Promise<Messages> {
  return dictionaries[locale]();
}
