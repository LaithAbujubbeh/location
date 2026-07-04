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
  employeeEventQueryKeys,
  employeeEventQueryOptions,
  fetchEmployeeEventDetails,
  findActionableRecheckSlot,
  formatDateRange,
  formatDateTime,
  type EmployeeEventItem,
  type EmployeeEventRecheckSlot,
} from "@/lib/employee-events";
import type { Locale, Messages } from "@/lib/i18n";

type EmployeeEventDetailClientProps = {
  eventId: string;
  labels: Messages["employee"]["eventDetails"];
  locale: Locale;
  statusLabels: Messages["status"];
};

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const statusTone: Record<string, StatusTone> = {
  ACCEPTED: "success",
  ACTIVE: "primary",
  COMPLETED: "success",
  EXPIRED: "danger",
  FAILED: "danger",
  IN_PROGRESS: "primary",
  MISSED: "danger",
  PASSED: "success",
  PENDING: "primary",
  REJECTED: "danger",
  SCHEDULED: "neutral",
  SUSPICIOUS: "warning",
};

function getStatusLabel(status: string | null, labels: Messages["status"]) {
  if (!status) {
    return labels.scheduled;
  }

  const key = status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  ) as keyof Messages["status"];

  return labels[key] ?? status;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-border bg-surface px-3 py-3">
      <dt className="text-xs font-medium uppercase text-text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function ActionLink({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      className={
        variant === "primary"
          ? "inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-medium leading-tight text-on-primary shadow-[var(--shadow-sm)] transition-colors hover:bg-primary-hover sm:w-auto"
          : "inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle sm:w-auto"
      }
      href={href}
    >
      {label}
    </Link>
  );
}

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      className="inline-flex min-h-11 w-full min-w-0 cursor-not-allowed items-center justify-center rounded-md border border-border bg-surface-subtle px-4 py-2 text-center text-sm font-medium leading-tight text-text-muted sm:w-auto"
      disabled
      type="button"
    >
      {label}
    </button>
  );
}

function RecheckSlotRow({
  labels,
  locale,
  slot,
  statusLabels,
}: {
  labels: Messages["employee"]["eventDetails"];
  locale: Locale;
  slot: EmployeeEventRecheckSlot;
  statusLabels: Messages["status"];
}) {
  return (
    <li className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="grid min-w-0 gap-1">
        <p className="break-words text-sm font-medium text-foreground">
          {formatDateRange(slot.startsAt, slot.expiresAt, locale)}
        </p>
        {slot.submittedAt ? (
          <p className="text-xs leading-5 text-text-muted">
            <span className="font-medium">{labels.fields.submittedAt}</span>{" "}
            <span>{formatDateTime(slot.submittedAt, locale)}</span>
          </p>
        ) : (
          <p className="text-xs leading-5 text-text-muted">
            {labels.notSubmitted}
          </p>
        )}
      </div>
      <Badge className="w-fit" tone={statusTone[slot.status ?? "SCHEDULED"]}>
        {getStatusLabel(slot.status, statusLabels)}
      </Badge>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <div className="h-6 w-2/3 rounded-md bg-surface-subtle" />
          <div className="h-4 w-1/2 rounded-md bg-surface-subtle" />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailContent({
  item,
  labels,
  locale,
  statusLabels,
}: {
  item: EmployeeEventItem;
  labels: Messages["employee"]["eventDetails"];
  locale: Locale;
  statusLabels: Messages["status"];
}) {
  const actionableRecheck = findActionableRecheckSlot(item.event.recheckSlots);

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-lg">{item.event.name}</CardTitle>
              <CardDescription>
                {item.event.locationName ?? labels.noLocation}
              </CardDescription>
            </div>
            <Badge
              className="w-fit shrink-0"
              tone={statusTone[item.assignment.status] ?? "neutral"}
            >
              {getStatusLabel(item.assignment.status, statusLabels)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-3 md:grid-cols-2">
            <InfoItem
              label={labels.fields.timeWindow}
              value={formatDateRange(
                item.event.startsAt,
                item.event.endsAt,
                locale,
              )}
            />
            <InfoItem
              label={labels.fields.checkIn}
              value={
                item.assignment.checkedInAt
                  ? formatDateTime(item.assignment.checkedInAt, locale)
                  : labels.notCheckedIn
              }
            />
            <InfoItem
              label={labels.fields.checkout}
              value={
                item.assignment.checkedOutAt
                  ? formatDateTime(item.assignment.checkedOutAt, locale)
                  : item.event.requireCheckout
                    ? labels.checkoutRequired
                    : labels.checkoutNotRequired
              }
            />
            <InfoItem
              label={labels.fields.radius}
              value={`${item.event.radiusMeters} ${labels.meters}`}
            />
          </dl>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {canCheckIn(item) ? (
              <ActionLink
                href={`/${locale}/employee/events/${item.event.id}/check-in`}
                label={labels.actions.checkIn}
              />
            ) : null}
            {actionableRecheck ? (
              <DisabledAction label={labels.actions.submitRecheck} />
            ) : null}
            {canCheckOut(item) ? (
              <ActionLink
                href={`/${locale}/employee/events/${item.event.id}/check-out`}
                label={labels.actions.checkOut}
                variant="outline"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{labels.rechecksTitle}</CardTitle>
            <CardDescription>{labels.rechecksDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {item.event.recheckSlots.length ? (
              <ul className="grid gap-3">
                {item.event.recheckSlots.map((slot) => (
                  <RecheckSlotRow
                    key={slot.id}
                    labels={labels}
                    locale={locale}
                    slot={slot}
                    statusLabels={statusLabels}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  {labels.noRechecksTitle}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
                  {labels.noRechecksDescription}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{labels.instructionsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm leading-6 text-text-muted">
              {labels.instructions.map((instruction) => (
                <li className="rounded-md border border-border bg-surface px-3 py-3" key={instruction}>
                  {instruction}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function EmployeeEventDetailClient({
  eventId,
  labels,
  locale,
  statusLabels,
}: EmployeeEventDetailClientProps) {
  const query = useQuery({
    queryFn: () => fetchEmployeeEventDetails(eventId),
    queryKey: employeeEventQueryKeys.employeeEventDetails(eventId),
    ...employeeEventQueryOptions,
  });

  if (query.isLoading) {
    return <DetailSkeleton />;
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

  return (
    <DetailContent
      item={data}
      labels={labels}
      locale={locale}
      statusLabels={statusLabels}
    />
  );
}
