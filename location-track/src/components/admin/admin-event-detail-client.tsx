"use client";

import type { AssignmentStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
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
import { Input } from "@/components/ui/input";
import {
  adminEventQueryKeys,
  adminEventQueryOptions,
  fetchAdminEventEmployees,
  fetchAdminEventTimeline,
  formatDateRange,
  formatDateTime,
  type AdminAssignmentSummary,
  type AdminEventTimelineAssignment,
} from "@/lib/admin-events";
import type { Locale, Messages } from "@/lib/i18n";

const AdminEventLocationMap = dynamic(
  () =>
    import("@/components/admin/admin-event-location-map").then(
      (mod) => mod.AdminEventLocationMap,
    ),
  {
    loading: () => (
      <div className="min-h-[300px] rounded-md border border-border bg-surface-subtle" />
    ),
    ssr: false,
  },
);

type AdminEventDetailClientProps = {
  eventId: string;
  labels: Messages["admin"]["eventDetails"];
  locale: Locale;
  statusLabels: Messages["status"];
};

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const assignmentStatuses: Array<AssignmentStatus | ""> = [
  "",
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SUSPICIOUS",
  "FAILED",
  "MISSED",
];

const statusTone: Record<string, StatusTone> = {
  ACCEPTED: "success",
  ACTIVE: "primary",
  CANCELLED: "danger",
  COMPLETED: "success",
  DRAFT: "neutral",
  EXPIRED: "danger",
  FAILED: "danger",
  IN_PROGRESS: "primary",
  MISSED: "danger",
  PASSED: "success",
  PENDING: "neutral",
  REJECTED: "danger",
  SCHEDULED: "neutral",
  SUSPICIOUS: "warning",
};

function getStatusLabel(status: string, labels: Messages["status"]) {
  const key = status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  ) as keyof Messages["status"];

  return labels[key] ?? status;
}

function BooleanLabel({
  labels,
  value,
}: {
  labels: Messages["admin"]["eventDetails"];
  value: boolean;
}) {
  return value ? labels.boolean.yes : labels.boolean.no;
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border border-border bg-surface-elevated px-4 py-4 shadow-[var(--shadow-sm)]">
      <dt className="text-xs font-medium uppercase text-text-subtle">{label}</dt>
      <dd className="text-2xl font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <div className="h-6 w-2/3 rounded-md bg-surface-subtle" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:pt-5">
          <div className="h-12 rounded-md bg-surface-subtle" />
          <div className="h-12 rounded-md bg-surface-subtle" />
          <div className="h-12 rounded-md bg-surface-subtle" />
        </CardContent>
      </Card>
    </div>
  );
}

function latestRecheckForAssignment(
  assignment: AdminEventTimelineAssignment | undefined,
) {
  return assignment?.rechecks.at(-1);
}

function employeeName(assignment: AdminAssignmentSummary) {
  return assignment.employee?.name || assignment.employee?.email || assignment.employeeId;
}

export function AdminEventDetailClient({
  eventId,
  labels,
  locale,
  statusLabels,
}: AdminEventDetailClientProps) {
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "">("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const employeesQuery = useQuery({
    queryFn: () =>
      fetchAdminEventEmployees({
        eventId,
        page,
        pageSize,
        status: statusFilter,
      }),
    queryKey: [
      ...adminEventQueryKeys.adminEventEmployees(eventId),
      page,
      pageSize,
      statusFilter,
    ],
    placeholderData: keepPreviousData,
    ...adminEventQueryOptions,
  });
  const timelineQuery = useQuery({
    queryFn: () =>
      fetchAdminEventTimeline({
        eventId,
        page: 1,
        pageSize,
        status: statusFilter,
      }),
    queryKey: [
      ...adminEventQueryKeys.adminEventTimeline(eventId),
      pageSize,
      statusFilter,
    ],
    placeholderData: keepPreviousData,
    ...adminEventQueryOptions,
  });

  const data = employeesQuery.data;
  const timeline = timelineQuery.data;
  const assignmentsById = useMemo(() => {
    const records = new Map<string, AdminEventTimelineAssignment>();

    for (const assignment of timeline?.assignments ?? []) {
      records.set(assignment.assignmentId, assignment);
    }

    return records;
  }, [timeline?.assignments]);
  const filteredAssignments = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    const assignments = data?.assignments ?? [];

    if (!query) {
      return assignments;
    }

    return assignments.filter((assignment) => {
      const haystack = [
        assignment.employee?.name,
        assignment.employee?.email,
        assignment.employeeId,
        assignment.assignmentId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [data?.assignments, employeeSearch]);

  if (employeesQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (employeesQuery.isError || !data) {
    return (
      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <WarningBox>
            <span className="block font-medium">{labels.errorTitle}</span>
            <span className="mt-1 block text-text-muted">
              {labels.errorDescription}
            </span>
          </WarningBox>
          <Button
            className="mt-4 w-full sm:w-fit"
            onClick={() => void employeesQuery.refetch()}
          >
            {labels.actions.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const event = data.event;
  const statusCounts = data.assignments.reduce(
    (counts, assignment) => {
      counts[assignment.status] = (counts[assignment.status] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<AssignmentStatus, number>>,
  );
  const checkedInCount = data.assignments.filter(
    (assignment) => assignment.checkedInAt,
  ).length;
  const failedOrMissedCount =
    (statusCounts.FAILED ?? 0) + (statusCounts.MISSED ?? 0);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label={labels.stats.totalAssigned} value={data.pagination.total} />
        <StatCard label={labels.stats.checkedIn} value={checkedInCount} />
        <StatCard
          label={labels.stats.inProgress}
          value={statusCounts.IN_PROGRESS ?? 0}
        />
        <StatCard label={labels.stats.completed} value={statusCounts.COMPLETED ?? 0} />
        <StatCard
          label={labels.stats.suspicious}
          value={statusCounts.SUSPICIOUS ?? 0}
        />
        <StatCard label={labels.stats.missedFailed} value={failedOrMissedCount} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{labels.sections.summaryTitle}</CardTitle>
            <CardDescription>{labels.sections.summaryDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem
                label={labels.fields.location}
                value={event.locationName ?? labels.none}
              />
              <InfoItem
                label={labels.fields.timeWindow}
                value={formatDateRange(event.startsAt, event.endsAt, locale)}
              />
              <InfoItem
                label={labels.fields.radius}
                value={labels.radiusMeters.replace(
                  "{value}",
                  String(event.radiusMeters),
                )}
              />
              <InfoItem
                label={labels.fields.requirePhoto}
                value={<BooleanLabel labels={labels} value={event.requirePhoto} />}
              />
              <InfoItem
                label={labels.fields.requireCheckout}
                value={<BooleanLabel labels={labels} value={event.requireCheckout} />}
              />
              {event.status ? (
                <InfoItem
                  label={labels.fields.status}
                  value={
                    <Badge tone={statusTone[event.status] ?? "neutral"}>
                      {getStatusLabel(event.status, statusLabels)}
                    </Badge>
                  }
                />
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{labels.sections.locationTitle}</CardTitle>
            <CardDescription>{labels.sections.locationDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <AdminEventLocationMap
              latitude={event.latitude}
              longitude={event.longitude}
              radiusMeters={event.radiusMeters}
            />
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem label={labels.fields.latitude} value={event.latitude} />
              <InfoItem label={labels.fields.longitude} value={event.longitude} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{labels.sections.rechecksTitle}</CardTitle>
          <CardDescription>{labels.sections.rechecksDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {event.recheckSlots.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {event.recheckSlots.map((slot) => (
                <dl
                  className="grid min-w-0 gap-3 rounded-md border border-border bg-surface px-3 py-3"
                  key={slot.id}
                >
                  <InfoItem
                    label={labels.fields.slotStartsAt}
                    value={formatDateTime(slot.startsAt, locale)}
                  />
                  <InfoItem
                    label={labels.fields.slotExpiresAt}
                    value={formatDateTime(slot.expiresAt, locale)}
                  />
                </dl>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6">
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
        <CardHeader className="gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid gap-1.5">
            <CardTitle>{labels.sections.employeesTitle}</CardTitle>
            <CardDescription>{labels.sections.employeesDescription}</CardDescription>
          </div>
          <Button
            className="w-full lg:w-auto"
            onClick={() => {
              void employeesQuery.refetch();
              void timelineQuery.refetch();
            }}
            variant="outline"
          >
            {labels.actions.refresh}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
            <Input
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder={labels.filters.employeeSearchPlaceholder}
              value={employeeSearch}
            />
            <select
              className="min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as AssignmentStatus | "");
              }}
              value={statusFilter}
            >
              {assignmentStatuses.map((status) => (
                <option key={status || "all"} value={status}>
                  {status
                    ? getStatusLabel(status, statusLabels)
                    : labels.filters.allStatuses}
                </option>
              ))}
            </select>
          </div>

          {!filteredAssignments.length ? (
            <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6">
              <p className="text-sm font-medium text-foreground">
                {labels.emptyEmployeesTitle}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
                {labels.emptyEmployeesDescription}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:hidden">
                {filteredAssignments.map((assignment) => {
                  const timelineAssignment = assignmentsById.get(
                    assignment.assignmentId,
                  );
                  const latestRecheck = latestRecheckForAssignment(timelineAssignment);

                  return (
                    <Card className="overflow-hidden" key={assignment.assignmentId}>
                      <CardHeader className="gap-3">
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <CardTitle>{employeeName(assignment)}</CardTitle>
                            <CardDescription>
                              {assignment.employee?.email ?? assignment.employeeId}
                            </CardDescription>
                          </div>
                          <Badge
                            className="w-fit shrink-0"
                            tone={statusTone[assignment.status] ?? "neutral"}
                          >
                            {getStatusLabel(assignment.status, statusLabels)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <InfoItem
                            label={labels.fields.checkedInAt}
                            value={
                              assignment.checkedInAt
                                ? formatDateTime(assignment.checkedInAt, locale)
                                : labels.notSubmitted
                            }
                          />
                          <InfoItem
                            label={labels.fields.checkedOutAt}
                            value={
                              assignment.checkedOutAt
                                ? formatDateTime(assignment.checkedOutAt, locale)
                                : labels.notSubmitted
                            }
                          />
                          <InfoItem
                            label={labels.fields.finalReason}
                            value={assignment.finalReason ?? labels.none}
                          />
                          <InfoItem
                            label={labels.fields.latestRecheck}
                            value={
                              latestRecheck ? (
                                <Badge
                                  tone={
                                    statusTone[latestRecheck.status] ?? "neutral"
                                  }
                                >
                                  {getStatusLabel(
                                    latestRecheck.status,
                                    statusLabels,
                                  )}
                                </Badge>
                              ) : (
                                labels.noRecheck
                              )
                            }
                          />
                        </dl>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-md border border-border lg:block">
                <table className="w-full min-w-[64rem] border-collapse text-sm">
                  <thead className="bg-surface-subtle text-xs font-medium uppercase text-text-subtle">
                    <tr>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.employee}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.assignmentStatus}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.checkedInAt}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.checkedOutAt}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.finalReason}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.latestRecheck}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-elevated">
                    {filteredAssignments.map((assignment) => {
                      const timelineAssignment = assignmentsById.get(
                        assignment.assignmentId,
                      );
                      const latestRecheck =
                        latestRecheckForAssignment(timelineAssignment);

                      return (
                        <tr key={assignment.assignmentId}>
                          <td className="max-w-64 px-3 py-3 align-top">
                            <span className="block truncate font-medium text-foreground">
                              {employeeName(assignment)}
                            </span>
                            <span className="block truncate text-text-muted">
                              {assignment.employee?.email ?? assignment.employeeId}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Badge tone={statusTone[assignment.status] ?? "neutral"}>
                              {getStatusLabel(assignment.status, statusLabels)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 align-top text-foreground">
                            {assignment.checkedInAt
                              ? formatDateTime(assignment.checkedInAt, locale)
                              : labels.notSubmitted}
                          </td>
                          <td className="px-3 py-3 align-top text-foreground">
                            {assignment.checkedOutAt
                              ? formatDateTime(assignment.checkedOutAt, locale)
                              : labels.notSubmitted}
                          </td>
                          <td className="max-w-52 px-3 py-3 align-top text-text-muted">
                            <span className="block truncate">
                              {assignment.finalReason ?? labels.none}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top">
                            {latestRecheck ? (
                              <Badge
                                tone={statusTone[latestRecheck.status] ?? "neutral"}
                              >
                                {getStatusLabel(latestRecheck.status, statusLabels)}
                              </Badge>
                            ) : (
                              <span className="text-text-muted">
                                {labels.noRecheck}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="text-sm text-text-muted">
                  {labels.pagination.summary
                    .replace("{page}", String(data.pagination.page))
                    .replace(
                      "{totalPages}",
                      String(Math.max(data.pagination.totalPages, 1)),
                    )
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
            </>
          )}

          {timelineQuery.isError ? (
            <WarningBox tone="info">{labels.timelinePreviewUnavailable}</WarningBox>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:flex sm:justify-start">
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle sm:w-auto"
          href={`/${locale}/admin/events`}
        >
          {labels.actions.backToEvents}
        </Link>
      </div>
    </div>
  );
}
