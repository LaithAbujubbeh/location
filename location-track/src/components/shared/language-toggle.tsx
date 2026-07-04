"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";

const localeCookieName = "location-attendance-locale";

type LanguageToggleLabels = {
  label: string;
  english: string;
  arabic: string;
};

type LanguageToggleProps = {
  className?: string;
  currentLocale: Locale;
  labels: LanguageToggleLabels;
};

function getLocalizedPath(pathname: string, nextLocale: Locale) {
  const segments = pathname.split("/");

  if (segments[1] === "en" || segments[1] === "ar") {
    segments[1] = nextLocale;
    return segments.join("/") || `/${nextLocale}`;
  }

  return `/${nextLocale}${pathname === "/" ? "" : pathname}`;
}

export function LanguageToggle({
  className,
  currentLocale,
  labels,
}: LanguageToggleProps) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === currentLocale) {
      return;
    }

    const nextPath = getLocalizedPath(pathname, nextLocale);

    window.localStorage.setItem(localeCookieName, nextLocale);
    document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.replace(nextPath);
  }

  return (
    <div
      aria-label={labels.label}
      className={cn(
        "inline-flex w-full max-w-full min-w-0 rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-sm)]",
        className,
      )}
      role="group"
    >
      <Button
        aria-pressed={currentLocale === "en"}
        className="min-w-0 flex-1 basis-0 px-2 text-xs leading-tight sm:px-3"
        onClick={() => switchLocale("en")}
        size="sm"
        type="button"
        variant={currentLocale === "en" ? "primary" : "ghost"}
      >
        {labels.english}
      </Button>
      <Button
        aria-pressed={currentLocale === "ar"}
        className="min-w-0 flex-1 basis-0 px-2 text-xs leading-tight sm:px-3"
        onClick={() => switchLocale("ar")}
        size="sm"
        type="button"
        variant={currentLocale === "ar" ? "primary" : "ghost"}
      >
        {labels.arabic}
      </Button>
    </div>
  );
}
