"use client";

import type { AssignmentStatus, ProofType } from "@prisma/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminProofLocationMap } from "@/components/admin/admin-proof-location-map";
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
  fetchAdminEventTimeline,
  formatDateRange,
  formatDateTime,
  type AdminEventTimelineAssignment,
  type AdminProofTimelineRecord,
  type AdminRecheckTimelineRecord,
} from "@/lib/admin-events";
import type { Locale, Messages } from "@/lib/i18n";

type AdminEventTimelineClientProps = {
  eventId: string;
  labels: Messages["admin"]["timeline"];
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

const proofTypes: Array<ProofType | ""> = ["", "CHECK_IN", "RECHECK", "CHECK_OUT"];

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

function proofTypeLabel(type: ProofType, labels: Messages["admin"]["timeline"]) {
  return labels.proofTypes[type] ?? type;
}

function employeeName(assignment: AdminEventTimelineAssignment) {
  return assignment.employee?.name || assignment.employee?.email || assignment.employeeId;
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
          <div className="h-24 rounded-md bg-surface-subtle" />
          <div className="h-24 rounded-md bg-surface-subtle" />
          <div className="h-24 rounded-md bg-surface-subtle" />
        </CardContent>
      </Card>
    </div>
  );
}

function PhotoLink({
  labels,
  photoUrl,
}: {
  labels: Messages["admin"]["timeline"];
  photoUrl: string | null;
}) {
  if (!photoUrl) {
    return <span className="text-text-muted">{labels.none}</span>;
  }

  return (
    <a
      className="break-all text-primary hover:text-primary-hover"
      href={photoUrl}
      rel="noreferrer"
      target="_blank"
    >
      {photoUrl}
    </a>
  );
}

function ProofCard({
  event,
  labels,
  locale,
  proof,
  statusLabels,
}: {
  event: AdminEventTimelineAssignmentEvent;
  labels: Messages["admin"]["timeline"];
  locale: Locale;
  proof: AdminProofTimelineRecord;
  statusLabels: Messages["status"];
}) {
  return (
    <div className="grid min-w-0 gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {proofTypeLabel(proof.type, labels)}
          </h4>
          <p className="break-words text-xs leading-5 text-text-muted">
            {formatDateTime(proof.createdAt, locale)}
          </p>
        </div>
        <Badge className="w-fit shrink-0" tone={statusTone[proof.status] ?? "neutral"}>
          {getStatusLabel(proof.status, statusLabels)}
        </Badge>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoItem
          label={labels.fields.gpsAccuracy}
          value={labels.meters.replace("{value}", String(proof.accuracyMeters))}
        />
        <InfoItem
          label={labels.fields.distanceMeters}
          value={labels.meters.replace("{value}", String(proof.distanceMeters))}
        />
        <InfoItem
          label={labels.fields.gpsTimestamp}
          value={formatDateTime(proof.gpsTimestamp, locale)}
        />
        <InfoItem label={labels.fields.createdAt} value={formatDateTime(proof.createdAt, locale)} />
        <InfoItem label={labels.fields.reason} value={proof.reason ?? labels.none} />
        <InfoItem label={labels.fields.photoUrl} value={<PhotoLink labels={labels} photoUrl={proof.photoUrl} />} />
      </dl>
      <div className="grid gap-2">
        <p className="text-xs font-medium uppercase text-text-subtle">
          {labels.fields.submittedLocation}
        </p>
        <AdminProofLocationMap
          eventLatitude={event.latitude}
          eventLongitude={event.longitude}
          labels={labels.map}
          proofAccuracyMeters={proof.accuracyMeters}
          proofLatitude={proof.latitude}
          proofLongitude={proof.longitude}
          radiusMeters={event.radiusMeters}
        />
        <div className="grid gap-2 text-xs leading-5 text-text-muted min-[390px]:grid-cols-2">
          <span className="min-w-0 break-words">
            {labels.map.eventMarker}
          </span>
          <span className="min-w-0 break-words">
            {labels.map.proofMarker}
          </span>
        </div>
      </div>
    </div>
  );
}

type AdminEventTimelineAssignmentEvent = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

function RecheckCard({
  labels,
  locale,
  recheck,
  statusLabels,
}: {
  labels: Messages["admin"]["timeline"];
  locale: Locale;
  recheck: AdminRecheckTimelineRecord;
  statusLabels: Messages["status"];
}) {
  return (
    <div className="grid min-w-0 gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          {labels.recheckRecordTitle}
        </h4>
        <Badge className="w-fit shrink-0" tone={statusTone[recheck.status] ?? "neutral"}>
          {getStatusLabel(recheck.status, statusLabels)}
        </Badge>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoItem label={labels.fields.startsAt} value={formatDateTime(recheck.startsAt, locale)} />
        <InfoItem label={labels.fields.expiresAt} value={formatDateTime(recheck.expiresAt, locale)} />
        <InfoItem
          label={labels.fields.submittedAt}
          value={
            recheck.submittedAt
              ? formatDateTime(recheck.submittedAt, locale)
              : labels.notSubmitted
          }
        />
        <InfoItem
          label={labels.fields.notificationSentAt}
          value={
            recheck.notificationSentAt
              ? formatDateTime(recheck.notificationSentAt, locale)
              : labels.none
          }
        />
        <InfoItem label={labels.fields.reason} value={recheck.reason ?? labels.none} />
      </dl>
    </div>
  );
}

function AssignmentTimeline({
  assignment,
  event,
  labels,
  locale,
  proofTypeFilter,
  statusLabels,
}: {
  assignment: AdminEventTimelineAssignment;
  event: AdminEventTimelineAssignmentEvent;
  labels: Messages["admin"]["timeline"];
  locale: Locale;
  proofTypeFilter: ProofType | "";
  statusLabels: Messages["status"];
}) {
  const proofs = proofTypeFilter
    ? assignment.proofs.filter((proof) => proof.type === proofTypeFilter)
    : assignment.proofs;
  const hasRecords = proofs.length > 0 || assignment.rechecks.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid min-w-0 gap-1">
          <CardTitle>{employeeName(assignment)}</CardTitle>
          <CardDescription>
            {assignment.employee?.email ?? assignment.employeeId}
          </CardDescription>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge tone={statusTone[assignment.status] ?? "neutral"}>
            {getStatusLabel(assignment.status, statusLabels)}
          </Badge>
          {assignment.finalReason ? (
            <Badge tone="warning">{assignment.finalReason}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            label={labels.fields.proofCount}
            value={String(assignment.proofs.length)}
          />
          <InfoItem
            label={labels.fields.recheckCount}
            value={String(assignment.rechecks.length)}
          />
        </dl>

        {!hasRecords ? (
          <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-6 text-center">
            <p className="text-sm font-medium text-foreground">
              {labels.emptyRecordsTitle}
            </p>
          </div>
        ) : null}

        {proofs.length ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {labels.sections.proofsTitle}
            </h3>
            {proofs.map((proof) => (
              <ProofCard
                event={event}
                key={proof.id}
                labels={labels}
                locale={locale}
                proof={proof}
                statusLabels={statusLabels}
              />
            ))}
          </div>
        ) : null}

        {assignment.rechecks.length ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {labels.sections.rechecksTitle}
            </h3>
            {assignment.rechecks.map((recheck) => (
              <RecheckCard
                key={recheck.id}
                labels={labels}
                locale={locale}
                recheck={recheck}
                statusLabels={statusLabels}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminEventTimelineClient({
  eventId,
  labels,
  locale,
  statusLabels,
}: AdminEventTimelineClientProps) {
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "">("");
  const [proofTypeFilter, setProofTypeFilter] = useState<ProofType | "">("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const timelineQuery = useQuery({
    queryFn: () =>
      fetchAdminEventTimeline({
        eventId,
        page,
        pageSize,
        status: statusFilter,
      }),
    queryKey: [
      ...adminEventQueryKeys.adminEventTimeline(eventId),
      page,
      pageSize,
      statusFilter,
    ],
    placeholderData: keepPreviousData,
    ...adminEventQueryOptions,
  });

  const data = timelineQuery.data;
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
  const visibleAssignments = proofTypeFilter
    ? filteredAssignments.filter((assignment) =>
        assignment.proofs.some((proof) => proof.type === proofTypeFilter),
      )
    : filteredAssignments;

  if (timelineQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (timelineQuery.isError || !data) {
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
            onClick={() => void timelineQuery.refetch()}
          >
            {labels.actions.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const event = data.event;
  const proofCounts = data.timeline.reduce(
    (counts, proof) => {
      counts[proof.type] = (counts[proof.type] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<ProofType, number>>,
  );
  const missedRecheckCount = data.rechecks.filter(
    (recheck) => recheck.status === "MISSED" || recheck.status === "EXPIRED",
  ).length;
  const suspiciousProofCount = data.timeline.filter(
    (proof) => proof.status === "SUSPICIOUS",
  ).length;

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid min-w-0 gap-1.5">
            <CardTitle>{event.name}</CardTitle>
            <CardDescription>
              {event.locationName ?? labels.none}
            </CardDescription>
          </div>
          <Button
            className="w-full lg:w-auto"
            onClick={() => void timelineQuery.refetch()}
            variant="outline"
          >
            {labels.actions.refresh}
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              label={labels.fields.timeWindow}
              value={formatDateRange(event.startsAt, event.endsAt, locale)}
            />
            <InfoItem
              label={labels.fields.radius}
              value={labels.meters.replace("{value}", String(event.radiusMeters))}
            />
            <InfoItem
              label={labels.stats.checkIns}
              value={String(proofCounts.CHECK_IN ?? 0)}
            />
            <InfoItem
              label={labels.stats.checkOuts}
              value={String(proofCounts.CHECK_OUT ?? 0)}
            />
            <InfoItem
              label={labels.stats.recheckProofs}
              value={String(proofCounts.RECHECK ?? 0)}
            />
            <InfoItem
              label={labels.stats.missedRechecks}
              value={String(missedRecheckCount)}
            />
            <InfoItem
              label={labels.stats.suspiciousProofs}
              value={String(suspiciousProofCount)}
            />
            <InfoItem
              label={labels.fields.assignmentCount}
              value={String(data.pagination.total)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{labels.sections.filtersTitle}</CardTitle>
          <CardDescription>{labels.sections.filtersDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_minmax(12rem,16rem)]">
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
          <select
            className="min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
            onChange={(event) =>
              setProofTypeFilter(event.target.value as ProofType | "")
            }
            value={proofTypeFilter}
          >
            {proofTypes.map((type) => (
              <option key={type || "all"} value={type}>
                {type ? proofTypeLabel(type, labels) : labels.filters.allProofTypes}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {!visibleAssignments.length ? (
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6">
              <p className="text-sm font-medium text-foreground">
                {labels.emptyTitle}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
                {labels.emptyDescription}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {visibleAssignments.map((assignment) => (
            <AssignmentTimeline
              assignment={assignment}
              event={{
                latitude: event.latitude,
                longitude: event.longitude,
                radiusMeters: event.radiusMeters,
              }}
              key={assignment.assignmentId}
              labels={labels}
              locale={locale}
              proofTypeFilter={proofTypeFilter}
              statusLabels={statusLabels}
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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

      <div className="grid gap-2 sm:flex sm:justify-start">
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle sm:w-auto"
          href={`/${locale}/admin/events/${eventId}`}
        >
          {labels.actions.backToDetails}
        </Link>
      </div>
    </div>
  );
}
