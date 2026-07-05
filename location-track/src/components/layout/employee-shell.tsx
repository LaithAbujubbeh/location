import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { Locale, Messages } from "@/lib/i18n";

type EmployeeShellLabels = {
  appName: string;
  areaLabel: string;
  signedInAs: string;
  logout: string;
  nav: {
    events: string;
  };
  notifications: Messages["notifications"];
  language: {
    label: string;
    english: string;
    arabic: string;
  };
  theme: {
    label: string;
    light: string;
    dark: string;
    system: string;
  };
};

type EmployeeShellProps = {
  children: React.ReactNode;
  locale: Locale;
  labels: EmployeeShellLabels;
  user: {
    name?: string | null;
    email: string;
  };
};

export function EmployeeShell({
  children,
  labels,
  locale,
  user,
}: EmployeeShellProps) {
  const eventsHref = `/${locale}/employee/events`;
  const displayName = user.name || user.email;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col bg-background">
        <header className="sticky top-0 z-[900] border-b border-border bg-surface-elevated/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur sm:px-5">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <Link className="grid min-w-0 gap-0.5" href={eventsHref}>
              <span className="truncate text-base font-semibold">
                {labels.appName}
              </span>
              <span className="truncate text-xs text-text-muted">
                {labels.areaLabel}
              </span>
            </Link>
            <div className="grid w-full z-40 min-w-0 gap-2 min-[390px]:grid-cols-2 sm:w-[28rem] sm:grid-cols-3">
              <NotificationBell labels={labels.notifications} locale={locale} />
              <LanguageToggle currentLocale={locale} labels={labels.language} />
              <ThemeToggle
                labels={{
                  ariaLabel: labels.theme.label,
                  dark: labels.theme.dark,
                  light: labels.theme.light,
                  system: labels.theme.system,
                }}
              />
            </div>
          </div>

          <div className="mt-3 grid min-w-0 gap-3 rounded-md border border-border bg-surface px-3 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-text-subtle">
                {labels.signedInAs}
              </p>
              <p className="truncate text-sm font-medium">{displayName}</p>
            </div>
            <LogoutButton label={labels.logout} locale={locale} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-5 lg:px-6 xl:px-8">
          {children}
        </main>

        <nav
          aria-label={labels.areaLabel}
          className="fixed inset-x-0 bottom-0 z-[900] border-t border-border bg-surface-elevated/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-md)] backdrop-blur"
        >
          <div className="mx-auto w-full max-w-7xl">
            <Link
              aria-current="page"
              className="flex h-11 items-center justify-center rounded-md bg-primary text-sm font-medium text-on-primary shadow-[var(--shadow-sm)]"
              href={eventsHref}
            >
              {labels.nav.events}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
