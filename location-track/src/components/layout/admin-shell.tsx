import Link from "next/link";

import { AdminMobileSidebar } from "@/components/layout/admin-mobile-sidebar";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { Locale } from "@/lib/i18n";

type AdminShellLabels = {
  appName: string;
  areaLabel: string;
  closeMenu: string;
  openMenu: string;
  signedInAs: string;
  logout: string;
  nav: {
    devices: string;
    events: string;
  };
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

type AdminShellProps = {
  children: React.ReactNode;
  locale: Locale;
  labels: AdminShellLabels;
  user: {
    name?: string | null;
    email: string;
  };
};

export function AdminShell({
  children,
  labels,
  locale,
  user,
}: AdminShellProps) {
  const devicesHref = `/${locale}/admin/devices`;
  const eventsHref = `/${locale}/admin/events`;
  const displayName = user.name || user.email;
  const navLinkClass =
    "rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-subtle hover:text-foreground";

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground lg:flex">
      <aside className="hidden w-64 shrink-0 border-e border-border bg-surface-elevated xl:w-72 lg:flex lg:flex-col">
        <div className="border-b border-border p-5">
          <Link className="grid gap-1" href={eventsHref}>
            <span className="text-lg font-semibold tracking-tight">
              {labels.appName}
            </span>
            <span className="text-sm text-text-muted">{labels.areaLabel}</span>
          </Link>
        </div>

        <nav className="grid gap-1 p-3" aria-label={labels.areaLabel}>
          <Link className={navLinkClass} href={eventsHref}>
            {labels.nav.events}
          </Link>
          <Link className={navLinkClass} href={devicesHref}>
            {labels.nav.devices}
          </Link>
        </nav>

        <div className="mt-auto grid gap-4 border-t border-border p-5">
          <div className="grid gap-1">
            <p className="text-xs font-medium uppercase text-text-subtle">
              {labels.signedInAs}
            </p>
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <LogoutButton label={labels.logout} locale={locale} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-surface-elevated/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur sm:px-5 lg:static lg:bg-transparent lg:px-6 lg:shadow-none">
          <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <AdminMobileSidebar
                devicesHref={devicesHref}
                eventsHref={eventsHref}
                labels={{
                  appName: labels.appName,
                  areaLabel: labels.areaLabel,
                  closeMenu: labels.closeMenu,
                  logout: labels.logout,
                  nav: labels.nav,
                  openMenu: labels.openMenu,
                  signedInAs: labels.signedInAs,
                }}
                locale={locale}
                user={user}
              />
              <div className="grid min-w-0 gap-0.5">
                <Link
                  className="truncate text-base font-semibold"
                  href={eventsHref}
                >
                  {labels.appName}
                </Link>
                <p className="truncate text-xs text-text-muted">
                  {labels.areaLabel}
                </p>
              </div>
            </div>

            <div className="grid w-full min-w-0 gap-2 min-[390px]:grid-cols-2 sm:w-72 sm:justify-self-end md:w-80 lg:ms-auto">
              <LanguageToggle
                currentLocale={locale}
                labels={labels.language}
              />
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
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
