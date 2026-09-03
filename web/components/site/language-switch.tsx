import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Quiet mono toggle in the header — next-intl's locale-aware Link makes this
// work as a server component with zero client JS.
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const target: Locale = locale === "en" ? "zh" : "en";
  const label = locale === "en" ? "中文" : "EN";

  return (
    <Link
      href="/"
      locale={target}
      aria-label={
        locale === "en" ? "切换到中文" : "Switch to English"
      }
      className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-amber"
    >
      {label}
    </Link>
  );
}
