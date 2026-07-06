"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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
    devices: string;
    events: string;
    users: string;
  };
};

type AdminMobileSidebarProps = {
  devicesHref: string;
  eventsHref: string;
  labels: AdminMobileSidebarLabels;
  locale: Locale;
  usersHref: string;
  user: {
    name?: string | null;
    email: string;
  };
};

function subscribeToClientSnapshot() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function AdminMobileSidebar({
  devicesHref,
  eventsHref,
  labels,
  locale,
  usersHref,
  user,
}: AdminMobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToClientSnapshot,
    getClientSnapshot,
    getServerSnapshot,
  );
  const displayName = user.name || user.email;
  const isRtl = locale === "ar";
  const navLinkClass =
    "rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-subtle hover:text-foreground";

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

  const sidebarOverlay =
    mounted
      ? createPortal(
          <>
      <div
        className={cn(
          "fixed inset-0 bg-foreground/15 opacity-0 transition-opacity duration-200 ease-out lg:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none",
        )}
        onPointerDown={() => setIsOpen(false)}
        style={{ zIndex: 2_000 }}
      />

      <aside
        className={cn(
          "fixed inset-y-0 start-0 flex h-dvh w-[86vw] max-w-80 flex-col border-e border-border bg-surface-elevated shadow-[var(--shadow-md)] transition-transform duration-200 ease-out sm:w-80 lg:hidden",
          isOpen
            ? "translate-x-0"
            : isRtl
              ? "translate-x-full"
              : "-translate-x-full",
        )}
        style={{ zIndex: 2_010 }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <Link className="grid min-w-0 gap-1" href={eventsHref}>
            <span className="truncate text-lg font-semibold tracking-tight">
              {labels.appName}
            </span>
            <span className="text-sm text-text-muted">{labels.areaLabel}</span>
          </Link>
          <Button
            aria-label={labels.closeMenu}
            className="h-9 w-9 shrink-0 p-0"
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
            className={navLinkClass}
            href={eventsHref}
            onClick={() => setIsOpen(false)}
          >
            {labels.nav.events}
          </Link>
          <Link
            className={navLinkClass}
            href={devicesHref}
            onClick={() => setIsOpen(false)}
          >
            {labels.nav.devices}
          </Link>
          <Link
            className={navLinkClass}
            href={usersHref}
            onClick={() => setIsOpen(false)}
          >
            {labels.nav.users}
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
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? labels.closeMenu : labels.openMenu}
        className="size-11 p-0 lg:hidden"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
        variant="outline"
      >
        <span
          className={cn(
            "flex h-5 w-5 flex-col items-center justify-center gap-1.5",
            isOpen && "gap-0",
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-out",
              isOpen && "translate-y-0.5 rotate-45",
            )}
          />
          <span
            className={cn(
              "h-0.5 w-5 rounded-full bg-current transition-opacity duration-150 ease-out",
              isOpen && "opacity-0",
            )}
          />
          <span
            className={cn(
              "h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-out",
              isOpen && "-translate-y-0.5 -rotate-45",
            )}
          />
        </span>
      </Button>
      {sidebarOverlay}
    </>
  );
}
