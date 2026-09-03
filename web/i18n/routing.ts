import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
  // English lives at the root (/), Chinese at /zh — keeps the shared URL clean
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
