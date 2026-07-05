"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  adminEventQueryKeys,
  adminEventQueryOptions,
  fetchAdminEvents,
  formatDateRange,
  formatDateTime,
  type AdminEventListItem,
} from "@/lib/admin-events";
import type { Locale, Messages } from "@/lib/i18n";

type AdminEventsClientProps = {
  labels: Messages["admin"]["events"];
  locale: Locale;
  statusLabels: Messages["status"];
};

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const statusTone: Record<string, StatusTone> = {
  ACTIVE: "primary",
  CANCELLED: "danger",
  COMPLETED: "success",
  DRAFT: "neutral",
  SCHEDULED: "neutral",
};

function getStatusLabel(status: string, labels: Messages["status"]) {
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

function WarningBox({
  children,
  tone = "danger",
}: {
  children: React.ReactNode;
  tone?: "danger" | "info";
}) {
  const classes = {
    danger: "border-danger/25 bg-danger/10 text-danger",
    info: "border-info/25 bg-info/10 text-info",
  };

  return (
    <div className={`rounded-md border px-4 py-5 text-sm leading-6 ${classes[tone]}`}>
      {children}
    </div>
  );
}

function EventCard({
  item,
  labels,
  locale,
  statusLabels,
}: {
  item: AdminEventListItem;
  labels: Messages["admin"]["events"];
  locale: Locale;
  statusLabels: Messages["status"];
}) {
  return (
    <Card className="overflow-hidden lg:hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{item.name}</CardTitle>
            <CardDescription>{item.locationName ?? labels.noLocation}</CardDescription>
          </div>
          <Badge className="w-fit shrink-0" tone={statusTone[item.status] ?? "neutral"}>
            {getStatusLabel(item.status, statusLabels)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoItem
            label={labels.fields.timeWindow}
            value={formatDateRange(item.startsAt, item.endsAt, locale)}
          />
          <InfoItem
            label={labels.fields.assigned}
            value={item.assignedEmployeesCount}
          />
          <InfoItem
            label={labels.fields.createdAt}
            value={formatDateTime(item.createdAt, locale)}
          />
          <InfoItem
            label={labels.fields.recheckSlots}
            value={item.recheckSlots.length}
          />
        </dl>
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
          href={`/${locale}/admin/events/${item.id}`}
        >
          {labels.actions.viewDetails}
        </Link>
      </CardContent>
    </Card>
  );
}

function EventCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-4 pt-4 sm:pt-5">
        <div className="h-5 w-2/3 rounded-md bg-surface-subtle" />
        <div className="h-4 w-1/2 rounded-md bg-surface-subtle" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-14 rounded-md bg-surface-subtle" />
          <div className="h-14 rounded-md bg-surface-subtle" />
          <div className="h-14 rounded-md bg-surface-subtle" />
          <div className="h-14 rounded-md bg-surface-subtle" />
        </div>
      </CardContent>
    </Card>
  );
}

function EventsTable({
  items,
  labels,
  locale,
  statusLabels,
}: {
  items: AdminEventListItem[];
  labels: Messages["admin"]["events"];
  locale: Locale;
  statusLabels: Messages["status"];
}) {
  return (
    <Card className="hidden overflow-hidden lg:block">
      <CardHeader>
        <CardTitle>{labels.cardTitle}</CardTitle>
        <CardDescription>{labels.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead className="bg-surface-subtle text-xs font-medium uppercase text-text-subtle">
              <tr>
                <th className="px-3 py-3 text-start">{labels.fields.name}</th>
                <th className="px-3 py-3 text-start">{labels.fields.location}</th>
                <th className="px-3 py-3 text-start">{labels.fields.timeWindow}</th>
                <th className="px-3 py-3 text-start">{labels.fields.assigned}</th>
                <th className="px-3 py-3 text-start">{labels.fields.status}</th>
                <th className="px-3 py-3 text-start">{labels.fields.createdAt}</th>
                <th className="px-3 py-3 text-end">{labels.fields.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-elevated">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="max-w-56 px-3 py-3 align-top font-medium text-foreground">
                    <span className="block truncate">{item.name}</span>
                  </td>
                  <td className="max-w-48 px-3 py-3 align-top text-text-muted">
                    <span className="block truncate">
                      {item.locationName ?? labels.noLocation}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-foreground">
                    {formatDateRange(item.startsAt, item.endsAt, locale)}
                  </td>
                  <td className="px-3 py-3 align-top text-foreground">
                    {item.assignedEmployeesCount}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge tone={statusTone[item.status] ?? "neutral"}>
                      {getStatusLabel(item.status, statusLabels)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 align-top text-text-muted">
                    {formatDateTime(item.createdAt, locale)}
                  </td>
                  <td className="px-3 py-3 text-end align-top">
                    <Link
                      className="inline-flex min-h-9 min-w-0 items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
                      href={`/${locale}/admin/events/${item.id}`}
                    >
                      {labels.actions.viewDetails}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminEventsClient({
  labels,
  locale,
  statusLabels,
}: AdminEventsClientProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const query = useQuery({
    queryFn: () => fetchAdminEvents({ page, pageSize }),
    queryKey: [...adminEventQueryKeys.adminEvents(), page, pageSize],
    ...adminEventQueryOptions,
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
          <WarningBox>
            <span className="block font-medium">{labels.errorTitle}</span>
            <span className="mt-1 block text-text-muted">
              {labels.errorDescription}
            </span>
          </WarningBox>
          <Button className="mt-4 w-full sm:w-fit" onClick={() => void query.refetch()}>
            {labels.actions.retry}
          </Button>
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
            <Link
              className="mt-4 inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-medium leading-tight text-on-primary shadow-[var(--shadow-sm)] transition-colors hover:bg-primary-hover sm:w-auto"
              href={`/${locale}/admin/events/create`}
            >
              {labels.actions.create}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-4 lg:hidden">
        {data.items.map((item) => (
          <EventCard
            item={item}
            key={item.id}
            labels={labels}
            locale={locale}
            statusLabels={statusLabels}
          />
        ))}
      </div>
      <EventsTable
        items={data.items}
        labels={labels}
        locale={locale}
        statusLabels={statusLabels}
      />
      <div className="grid gap-3 rounded-md border border-border bg-surface-elevated px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="text-sm text-text-muted">
          {labels.pagination.summary
            .replace("{page}", String(data.pagination.page))
            .replace("{totalPages}", String(Math.max(data.pagination.totalPages, 1)))
            .replace("{total}", String(data.pagination.total))}
        </p>
        <div className="grid gap-2 min-[390px]:grid-cols-2 sm:flex">
          <Button
            className="w-full sm:w-auto"
            disabled={!data.pagination.hasPreviousPage}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            variant="outline"
          >
            {labels.pagination.previous}
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={!data.pagination.hasNextPage}
            onClick={() => setPage((value) => value + 1)}
            variant="outline"
          >
            {labels.pagination.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
