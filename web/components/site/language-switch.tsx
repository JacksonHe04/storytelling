"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";

// In-place locale switch: persist the choice in the NEXT_LOCALE cookie
// (the middleware reads it on the next request) and re-render — no route change.
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const target: Locale = locale === "en" ? "zh" : "en";
  const label = locale === "en" ? "中文" : "EN";

  function switchLocale() {
    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      aria-label={locale === "en" ? "切换到中文" : "Switch to English"}
      className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-amber"
    >
      {label}
    </button>
  );
}
