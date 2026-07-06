"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canCheckIn,
  canCheckOut,
  canSubmitRecheck,
  employeeEventQueryKeys,
  employeeEventQueryOptions,
  fetchEmployeeEvents,
  findNextRecheckSlot,
  formatDateRange,
  formatDateTime,
  type EmployeeEventItem,
} from "@/lib/employee-events";
import type { Locale, Messages } from "@/lib/i18n";

type EmployeeEventsClientProps = {
  labels: Messages["employee"]["events"];
  locale: Locale;
  statusLabels: Messages["status"];
};

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const assignmentStatusTone: Record<string, StatusTone> = {
  COMPLETED: "success",
  FAILED: "danger",
  IN_PROGRESS: "primary",
  MISSED: "danger",
  PENDING: "neutral",
  SUSPICIOUS: "warning",
};

function getAssignmentStatusLabel(
  status: string,
  labels: Messages["status"],
) {
  const key = status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  ) as keyof Messages["status"];

  return labels[key] ?? status;
}

function getPrimaryAction(
  item: EmployeeEventItem,
  locale: Locale,
  labels: Messages["employee"]["events"],
) {
  if (canCheckIn(item)) {
    return {
      href: `/${locale}/employee/events/${item.event.id}/check-in`,
      label: labels.actions.checkIn,
    };
  }

  if (canSubmitRecheck(item)) {
    return {
      href: `/${locale}/employee/events/${item.event.id}/recheck`,
      label: labels.actions.viewRecheck,
    };
  }

  if (canCheckOut(item)) {
    return {
      href: `/${locale}/employee/events/${item.event.id}/check-out`,
      label: labels.actions.checkOut,
    };
  }

  return {
    href: `/${locale}/employee/events/${item.event.id}`,
    label: labels.actions.viewDetails,
  };
}

function EventCard({
  item,
  labels,
  locale,
  statusLabels,
}: {
  item: EmployeeEventItem;
  labels: Messages["employee"]["events"];
  locale: Locale;
  statusLabels: Messages["status"];
}) {
  const nextRecheck = findNextRecheckSlot(item.event.recheckSlots);
  const action = getPrimaryAction(item, locale, labels);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{item.event.name}</CardTitle>
            <CardDescription>{item.event.locationName ?? labels.noLocation}</CardDescription>
          </div>
          <Badge
            className="w-fit shrink-0"
            tone={assignmentStatusTone[item.assignment.status] ?? "neutral"}
          >
            {getAssignmentStatusLabel(item.assignment.status, statusLabels)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="grid gap-1">
            <dt className="text-xs font-medium uppercase text-text-subtle">
              {labels.fields.timeWindow}
            </dt>
            <dd className="break-words text-foreground">
              {formatDateRange(item.event.startsAt, item.event.endsAt, locale)}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs font-medium uppercase text-text-subtle">
              {labels.fields.nextRecheck}
            </dt>
            <dd className="break-words text-foreground">
              {nextRecheck
                ? formatDateTime(nextRecheck.startsAt, locale)
                : labels.noRecheck}
            </dd>
          </div>
        </dl>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
            href={`/${locale}/employee/events/${item.event.id}`}
          >
            {labels.actions.viewDetails}
          </Link>
          <Link
            className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-medium leading-tight text-on-primary shadow-[var(--shadow-sm)] transition-colors hover:bg-primary-hover"
            href={action.href}
          >
            {action.label}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCardSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-4 pt-4 sm:pt-5">
        <div className="h-5 w-2/3 rounded-md bg-surface-subtle" />
        <div className="h-4 w-1/2 rounded-md bg-surface-subtle" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-12 rounded-md bg-surface-subtle" />
          <div className="h-12 rounded-md bg-surface-subtle" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-11 rounded-md bg-surface-subtle" />
          <div className="h-11 rounded-md bg-surface-subtle" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeEventsClient({
  labels,
  locale,
  statusLabels,
}: EmployeeEventsClientProps) {
  const query = useQuery({
    queryFn: fetchEmployeeEvents,
    queryKey: employeeEventQueryKeys.employeeEvents(),
    ...employeeEventQueryOptions,
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-4">
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <div className="rounded-md border border-danger/25 bg-danger/10 px-4 py-5">
            <p className="text-sm font-medium text-danger">{labels.errorTitle}</p>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              {labels.errorDescription}
            </p>
            <button
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-[var(--shadow-sm)] sm:w-auto"
              onClick={() => void query.refetch()}
              type="button"
            >
              {labels.actions.retry}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = query.data;

  if (!data) {
    return null;
  }

  if (!data.items.length) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{labels.cardTitle}</CardTitle>
          <CardDescription>{labels.cardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6 sm:py-10">
            <p className="text-sm font-medium text-foreground">
              {labels.emptyTitle}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
              {labels.emptyDescription}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.items.map((item) => (
        <EventCard
          item={item}
          key={item.assignment.id}
          labels={labels}
          locale={locale}
          statusLabels={statusLabels}
        />
      ))}
    </div>
  );
}
