import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
  // No locale in the URL: middleware negotiates the first visit from the
  // Accept-Language header, then the choice persists in the NEXT_LOCALE cookie
  localePrefix: "never",
});

export type Locale = (typeof routing.locales)[number];
