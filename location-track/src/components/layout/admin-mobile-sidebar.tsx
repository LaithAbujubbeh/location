"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";

type AdminMobileSidebarLabels = {
  appName: string;
  areaLabel: string;
  closeMenu: string;
  openMenu: string;
  signedInAs: string;
  logout: string;
  nav: {
    events: string;
  };
};

type AdminMobileSidebarProps = {
  eventsHref: string;
  labels: AdminMobileSidebarLabels;
  locale: Locale;
  user: {
    name?: string | null;
    email: string;
  };
};

export function AdminMobileSidebar({
  eventsHref,
  labels,
  locale,
  user,
}: AdminMobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayName = user.name || user.email;
  const isRtl = locale === "ar";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? labels.closeMenu : labels.openMenu}
        className="h-10 w-10 p-0 lg:hidden"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
        variant="outline"
      >
        <span className="relative h-5 w-5" aria-hidden="true">
          <span
            className={cn(
              "absolute start-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-out",
              isOpen && "translate-y-2 rotate-45",
            )}
          />
          <span
            className={cn(
              "absolute start-0 top-2 h-0.5 w-5 rounded-full bg-current transition-opacity duration-150 ease-out",
              isOpen && "opacity-0",
            )}
          />
          <span
            className={cn(
              "absolute start-0 top-4 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-out",
              isOpen && "-translate-y-2 -rotate-45",
            )}
          />
        </span>
      </Button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/30 opacity-0 transition-opacity duration-200 ease-out lg:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none",
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={cn(
          "fixed top-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col border-border bg-surface-elevated shadow-[var(--shadow-md)] transition-transform duration-200 ease-out lg:hidden",
          isRtl ? "right-0 border-s" : "left-0 border-e",
          isOpen
            ? "translate-x-0"
            : isRtl
              ? "translate-x-full"
              : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <Link className="grid min-w-0 gap-1" href={eventsHref}>
            <span className="truncate text-lg font-semibold tracking-tight">
              {labels.appName}
            </span>
            <span className="text-sm text-text-muted">{labels.areaLabel}</span>
          </Link>
          <Button
            aria-label={labels.closeMenu}
            className="h-9 w-9 p-0"
            onClick={() => setIsOpen(false)}
            type="button"
            variant="ghost"
          >
            <span className="relative h-5 w-5" aria-hidden="true">
              <span className="absolute start-0 top-2 h-0.5 w-5 rotate-45 rounded-full bg-current" />
              <span className="absolute start-0 top-2 h-0.5 w-5 -rotate-45 rounded-full bg-current" />
            </span>
          </Button>
        </div>

        <nav className="grid gap-1 p-3" aria-label={labels.areaLabel}>
          <Link
            aria-current="page"
            className="rounded-md bg-primary-soft px-3 py-2 text-sm font-medium text-primary-dark dark:bg-surface-muted dark:text-foreground"
            href={eventsHref}
            onClick={() => setIsOpen(false)}
          >
            {labels.nav.events}
          </Link>
        </nav>

        <div className="mt-auto grid gap-4 border-t border-border p-5">
          <div className="grid min-w-0 gap-1">
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
    </>
  );
}
