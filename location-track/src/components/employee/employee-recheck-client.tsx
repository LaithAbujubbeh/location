"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  BrowserLocationError,
  getCurrentBrowserLocation,
  type BrowserLocationResult,
} from "@/lib/browser-location";
import { getDeviceId } from "@/lib/device";
import {
  employeeEventQueryKeys,
  EmployeeEventApiError,
  fetchEmployeeEventDetails,
  findNextRecheckSlot,
  formatDateRange,
  formatDateTime,
  submitEmployeeRecheck,
  type EmployeeEventItem,
  type EmployeeEventRecheckSlot,
  type EmployeeRecheckSubmitResult,
} from "@/lib/employee-events";
import type { Locale, Messages } from "@/lib/i18n";

type EmployeeRecheckClientProps = {
  eventId: string;
  labels: Messages["employee"]["recheck"];
  locale: Locale;
  statusLabels: Messages["status"];
};

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const poorAccuracyThresholdMeters = 100;
const finalRecheckStatuses = new Set([
  "COMPLETED",
  "PASSED",
  "SUSPICIOUS",
  "FAILED",
  "MISSED",
  "EXPIRED",
]);

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

function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value);
}

function formatDuration(milliseconds: number, locale: Locale) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
  }).format(minutes) + ":" + new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
  }).format(seconds);
}

function isRecheckWindowActive(slot: EmployeeEventRecheckSlot, now: Date) {
  const startsAt = new Date(slot.startsAt).getTime();
  const expiresAt = new Date(slot.expiresAt).getTime();
  const status = slot.status ?? "SCHEDULED";

  return (
    startsAt <= now.getTime() &&
    expiresAt > now.getTime() &&
    !finalRecheckStatuses.has(status)
  );
}

function findSelectedRecheckSlot(
  slots: EmployeeEventRecheckSlot[],
  now: Date,
) {
  return (
    slots.find((slot) => isRecheckWindowActive(slot, now)) ??
    findNextRecheckSlot(slots, now) ??
    slots.at(-1) ??
    null
  );
}

function isAssignmentEligible(item: EmployeeEventItem) {
  return (
    item.assignment.status === "IN_PROGRESS" ||
    item.assignment.status === "SUSPICIOUS"
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

function WarningBox({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "danger" | "info" | "success";
}) {
  const classes = {
    danger: "border-danger/25 bg-danger/10 text-danger",
    info: "border-info/25 bg-info/10 text-info",
    success: "border-success/20 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/15 text-warning",
  };

  return (
    <div className={`rounded-md border px-3 py-3 text-sm leading-6 ${classes[tone]}`}>
      {children}
    </div>
  );
}

function StepCard({
  children,
  description,
  status,
  step,
  title,
}: {
  children: React.ReactNode;
  description: string;
  status: string;
  step: number;
  title: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-sm font-semibold text-primary-dark">
            {step}
          </div>
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle>{title}</CardTitle>
              <Badge className="w-fit shrink-0" tone="neutral">
                {status}
              </Badge>
            </div>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

function LocationResult({
  labels,
  locale,
  location,
}: {
  labels: Messages["employee"]["recheck"];
  locale: Locale;
  location: BrowserLocationResult;
}) {
  return (
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
      <InfoItem
        label={labels.fields.latitude}
        value={formatNumber(location.latitude, locale, 6)}
      />
      <InfoItem
        label={labels.fields.longitude}
        value={formatNumber(location.longitude, locale, 6)}
      />
      <InfoItem
        label={labels.fields.accuracyMeters}
        value={`${formatNumber(location.accuracyMeters, locale, 1)} ${labels.meters}`}
      />
      <InfoItem
        label={labels.fields.capturedAt}
        value={formatDateTime(location.gpsTimestamp, locale)}
      />
    </dl>
  );
}

function getLocationErrorMessage(
  error: unknown,
  labels: Messages["employee"]["recheck"],
) {
  if (error instanceof BrowserLocationError) {
    return labels.locationErrors[error.code];
  }

  return labels.locationErrors.UNKNOWN;
}

function getBackendErrorMessage(
  error: EmployeeEventApiError,
  labels: Messages["employee"]["recheck"],
) {
  const backendErrors = labels.backendErrors as Record<string, string>;

  return backendErrors[error.code] ?? labels.backendErrors.REQUEST_FAILED;
}

function CountdownCard({
  labels,
  locale,
  now,
  slot,
  statusLabels,
}: {
  labels: Messages["employee"]["recheck"];
  locale: Locale;
  now: Date;
  slot: EmployeeEventRecheckSlot | null;
  statusLabels: Messages["status"];
}) {
  if (!slot) {
    return <WarningBox tone="info">{labels.warnings.noRecheck}</WarningBox>;
  }

  const startsAt = new Date(slot.startsAt);
  const expiresAt = new Date(slot.expiresAt);
  const nowTime = now.getTime();
  const statusText =
    nowTime < startsAt.getTime()
      ? `${labels.countdown.startsIn} ${formatDuration(startsAt.getTime() - nowTime, locale)}`
      : nowTime >= expiresAt.getTime()
        ? labels.countdown.expired
        : `${labels.countdown.expiresIn} ${formatDuration(expiresAt.getTime() - nowTime, locale)}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{labels.countdown.title}</CardTitle>
        <CardDescription>{statusText}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          <InfoItem
            label={labels.fields.recheckWindow}
            value={formatDateRange(slot.startsAt, slot.expiresAt, locale)}
          />
          <InfoItem
            label={labels.fields.recheckStatus}
            value={getStatusLabel(slot.status, statusLabels)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function DetailsSkeleton() {
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

function ResultCard({
  labels,
  locale,
  result,
  statusLabels,
}: {
  labels: Messages["employee"]["recheck"];
  locale: Locale;
  result: EmployeeRecheckSubmitResult;
  statusLabels: Messages["status"];
}) {
  const tone = statusTone[result.recheck.status] ?? "neutral";
  const description =
    result.recheck.status === "SUSPICIOUS"
      ? labels.result.suspiciousDescription
      : result.recheck.status === "PASSED" || result.recheck.status === "COMPLETED"
        ? labels.result.acceptedDescription
        : labels.result.rejectedDescription;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{labels.result.title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge className="w-fit shrink-0" tone={tone}>
            {getStatusLabel(result.recheck.status, statusLabels)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoItem
            label={labels.fields.distanceMeters}
            value={`${formatNumber(result.verification.distanceMeters, locale, 1)} ${labels.meters}`}
          />
          <InfoItem
            label={labels.fields.radius}
            value={`${formatNumber(result.verification.radiusMeters, locale, 0)} ${labels.meters}`}
          />
          <InfoItem
            label={labels.fields.proofStatus}
            value={getStatusLabel(result.proof.status, statusLabels)}
          />
          <InfoItem
            label={labels.fields.submittedAt}
            value={formatDateTime(result.recheck.submittedAt, locale)}
          />
        </dl>
        {result.proof.notes ? (
          <WarningBox tone={result.recheck.status === "FAILED" ? "danger" : "warning"}>
            {result.proof.notes}
          </WarningBox>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecheckContent({
  item,
  labels,
  locale,
  statusLabels,
}: {
  item: EmployeeEventItem;
  labels: Messages["employee"]["recheck"];
  locale: Locale;
  statusLabels: Messages["status"];
}) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [location, setLocation] = useState<BrowserLocationResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitAttemptedWithoutLocation, setSubmitAttemptedWithoutLocation] =
    useState(false);
  const [result, setResult] = useState<EmployeeRecheckSubmitResult | null>(null);

  const selectedSlot = useMemo(
    () => findSelectedRecheckSlot(item.event.recheckSlots, now),
    [item.event.recheckSlots, now],
  );
  const assignmentEligible = isAssignmentEligible(item);
  const recheckActive = selectedSlot
    ? isRecheckWindowActive(selectedSlot, now)
    : false;
  const alreadySubmitted = selectedSlot
    ? Boolean(selectedSlot.submittedAt) ||
      finalRecheckStatuses.has(selectedSlot.status ?? "")
    : false;
  const notActiveYet = selectedSlot
    ? new Date(selectedSlot.startsAt).getTime() > now.getTime()
    : false;
  const expired = selectedSlot
    ? new Date(selectedSlot.expiresAt).getTime() <= now.getTime() ||
      selectedSlot.status === "EXPIRED" ||
      selectedSlot.status === "MISSED"
    : false;
  const photoBlocked = item.event.requirePhoto;
  const poorAccuracy =
    location && location.accuracyMeters > poorAccuracyThresholdMeters;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      try {
        setDeviceId(getDeviceId());
      } catch {
        setDeviceError(labels.errors.deviceUnavailable);
      }
    });

    return () => {
      active = false;
    };
  }, [labels.errors.deviceUnavailable]);

  const warnings = useMemo(() => {
    const messages: string[] = [];

    if (!selectedSlot) {
      messages.push(labels.warnings.noRecheck);
    } else if (alreadySubmitted) {
      messages.push(labels.warnings.alreadySubmitted);
    } else if (expired) {
      messages.push(labels.warnings.expired);
    } else if (notActiveYet) {
      messages.push(labels.warnings.notActiveYet);
    }

    if (!assignmentEligible) {
      messages.push(labels.warnings.assignmentNotInProgress);
    }

    if (photoBlocked) {
      messages.push(labels.warnings.photoUploadNotConfigured);
    }

    if (poorAccuracy) {
      messages.push(labels.warnings.poorAccuracy);
    }

    if (submitAttemptedWithoutLocation && !location) {
      messages.push(labels.warnings.locationRequired);
    }

    return messages;
  }, [
    alreadySubmitted,
    assignmentEligible,
    expired,
    labels,
    location,
    notActiveYet,
    photoBlocked,
    poorAccuracy,
    selectedSlot,
    submitAttemptedWithoutLocation,
  ]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!location || !deviceId || !selectedSlot) {
        throw new Error(labels.errors.missingLocationOrDevice);
      }

      return submitEmployeeRecheck({
        eventId: item.event.id,
        slotId: selectedSlot.id,
        payload: {
          accuracyMeters: location.accuracyMeters,
          deviceId,
          gpsTimestamp: location.gpsTimestamp,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });
    },
    onSuccess: async (data) => {
      setResult(data);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: employeeEventQueryKeys.employeeEvents(),
        }),
        queryClient.invalidateQueries({
          queryKey: employeeEventQueryKeys.employeeEventDetails(item.event.id),
        }),
        queryClient.invalidateQueries({
          queryKey: employeeEventQueryKeys.recheckDetails(item.event.id),
        }),
      ]);
    },
  });

  async function handleCaptureLocation() {
    setLocationError(null);
    setSubmitAttemptedWithoutLocation(false);
    setResult(null);

    try {
      setLocation(await getCurrentBrowserLocation());
    } catch (error) {
      setLocation(null);
      setLocationError(getLocationErrorMessage(error, labels));
    }
  }

  function handleSubmit() {
    if (!location) {
      setSubmitAttemptedWithoutLocation(true);
      return;
    }

    mutation.mutate();
  }

  const canSubmit =
    Boolean(location) &&
    Boolean(deviceId) &&
    Boolean(selectedSlot) &&
    assignmentEligible &&
    recheckActive &&
    !alreadySubmitted &&
    !photoBlocked &&
    !mutation.isPending;
  const mutationError =
    mutation.error instanceof EmployeeEventApiError ? mutation.error : null;

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
              label={labels.fields.recheckWindow}
              value={
                selectedSlot
                  ? formatDateRange(selectedSlot.startsAt, selectedSlot.expiresAt, locale)
                  : labels.noRecheck
              }
            />
            <InfoItem
              label={labels.fields.recheckStatus}
              value={getStatusLabel(selectedSlot?.status ?? null, statusLabels)}
            />
            <InfoItem
              label={labels.fields.photoRequirement}
              value={item.event.requirePhoto ? labels.photo.required : labels.photo.notRequired}
            />
            <InfoItem
              label={labels.fields.deviceId}
              value={
                deviceId ? (
                  <span className="break-all">{deviceId}</span>
                ) : (
                  labels.devicePending
                )
              }
            />
          </dl>
          {deviceError ? <WarningBox tone="danger">{deviceError}</WarningBox> : null}
        </CardContent>
      </Card>

      {warnings.length ? (
        <div className="grid gap-2">
          {warnings.map((warning) => (
            <WarningBox
              key={warning}
              tone={
                warning === labels.warnings.photoUploadNotConfigured ||
                warning === labels.warnings.expired ||
                warning === labels.warnings.alreadySubmitted
                  ? "danger"
                  : "warning"
              }
            >
              {warning}
            </WarningBox>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <div className="grid min-w-0 gap-4">
          <StepCard
            description={labels.steps.confirmDescription}
            status={recheckActive ? labels.stepStatus.ready : labels.stepStatus.pending}
            step={1}
            title={labels.steps.confirmTitle}
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem
                label={labels.fields.event}
                value={item.event.name}
              />
              <InfoItem
                label={labels.fields.location}
                value={item.event.locationName ?? labels.noLocation}
              />
            </dl>
          </StepCard>

          <StepCard
            description={labels.steps.locationDescription}
            status={location ? labels.stepStatus.complete : labels.stepStatus.pending}
            step={2}
            title={labels.steps.locationTitle}
          >
            <Button
              className="w-full sm:w-fit"
              disabled={mutation.isPending}
              onClick={() => void handleCaptureLocation()}
            >
              {location ? labels.actions.refreshLocation : labels.actions.getLocation}
            </Button>
            {locationError ? <WarningBox tone="danger">{locationError}</WarningBox> : null}
          </StepCard>

          <StepCard
            description={labels.steps.reviewDescription}
            status={location ? labels.stepStatus.ready : labels.stepStatus.pending}
            step={3}
            title={labels.steps.reviewTitle}
          >
            {location ? (
              <>
                <LocationResult labels={labels} locale={locale} location={location} />
                {poorAccuracy ? (
                  <WarningBox>{labels.warnings.poorAccuracy}</WarningBox>
                ) : null}
              </>
            ) : (
              <p className="text-sm leading-6 text-text-muted">
                {labels.emptyLocation}
              </p>
            )}
          </StepCard>

          <StepCard
            description={labels.steps.photoDescription}
            status={photoBlocked ? labels.stepStatus.blocked : labels.stepStatus.complete}
            step={4}
            title={labels.steps.photoTitle}
          >
            <WarningBox tone={photoBlocked ? "danger" : "info"}>
              {photoBlocked
                ? labels.warnings.photoUploadNotConfigured
                : labels.photo.notConfiguredOptional}
            </WarningBox>
          </StepCard>

          <StepCard
            description={labels.steps.submitDescription}
            status={
              result
                ? labels.stepStatus.complete
                : canSubmit
                  ? labels.stepStatus.ready
                  : labels.stepStatus.pending
            }
            step={5}
            title={labels.steps.submitTitle}
          >
            <Button className="w-full sm:w-fit" disabled={!canSubmit} onClick={handleSubmit}>
              {mutation.isPending ? labels.actions.submitting : labels.actions.submit}
            </Button>

            {mutationError ? (
              <WarningBox tone="danger">
                <span className="block font-medium">
                  {getBackendErrorMessage(mutationError, labels)}
                </span>
                <span className="mt-1 block text-danger">{mutationError.message}</span>
              </WarningBox>
            ) : null}

            {mutation.error && !mutationError ? (
              <WarningBox tone="danger">{labels.errors.unknownSubmitError}</WarningBox>
            ) : null}
          </StepCard>
        </div>

        <div className="grid h-fit min-w-0 gap-4">
          <CountdownCard
            labels={labels}
            locale={locale}
            now={now}
            slot={selectedSlot}
            statusLabels={statusLabels}
          />

          {result ? (
            <ResultCard
              labels={labels}
              locale={locale}
              result={result}
              statusLabels={statusLabels}
            />
          ) : null}

          <Link
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
            href={`/${locale}/employee/events/${item.event.id}`}
          >
            {labels.actions.backToDetails}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function EmployeeRecheckClient({
  eventId,
  labels,
  locale,
  statusLabels,
}: EmployeeRecheckClientProps) {
  const query = useQuery({
    queryFn: () => fetchEmployeeEventDetails(eventId),
    queryKey: employeeEventQueryKeys.recheckDetails(eventId),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (query.isLoading) {
    return <DetailsSkeleton />;
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <WarningBox tone="danger">
            <span className="block font-medium">{labels.detailsErrorTitle}</span>
            <span className="mt-1 block">{labels.detailsErrorDescription}</span>
          </WarningBox>
          <Button
            className="mt-4 w-full sm:w-fit"
            onClick={() => void query.refetch()}
          >
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

  return (
    <RecheckContent
      item={data}
      labels={labels}
      locale={locale}
      statusLabels={statusLabels}
    />
  );
}
