"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { ProofPhotoField } from "@/components/employee/proof-photo-field";
import { useProofPhotoUpload } from "@/components/employee/use-proof-photo-upload";
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
  employeeEventQueryOptions,
  EmployeeEventApiError,
  fetchEmployeeEventDetails,
  formatDateRange,
  formatDateTime,
  submitEmployeeCheckIn,
  type EmployeeCheckInResult,
  type EmployeeEventItem,
  type EmployeeEventRecheckSlot,
} from "@/lib/employee-events";
import type { Locale, Messages } from "@/lib/i18n";

type EmployeeCheckInClientProps = {
  eventId: string;
  labels: Messages["employee"]["checkIn"];
  locale: Locale;
  proofPhotoLabels: Messages["employee"]["proofPhoto"];
  statusLabels: Messages["status"];
};

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const poorAccuracyThresholdMeters = 100;

const statusTone: Record<string, StatusTone> = {
  ACCEPTED: "success",
  ACTIVE: "primary",
  COMPLETED: "success",
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

function isEventOpenForCheckIn(item: EmployeeEventItem) {
  const now = Date.now();
  const startsAt = new Date(item.event.startsAt).getTime();
  const endsAt = new Date(item.event.endsAt).getTime();

  return (
    (item.event.status === "SCHEDULED" || item.event.status === "ACTIVE") &&
    startsAt <= now &&
    endsAt >= now
  );
}

function isAssignmentEligible(item: EmployeeEventItem) {
  return item.assignment.status === "PENDING" && item.assignment.checkedInAt === null;
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
  labels: Messages["employee"]["checkIn"];
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

function RecheckSlotRow({
  locale,
  slot,
  statusLabels,
}: {
  locale: Locale;
  slot: EmployeeEventRecheckSlot;
  statusLabels: Messages["status"];
}) {
  return (
    <li className="grid min-w-0 gap-3 rounded-md border border-border bg-surface px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <p className="min-w-0 break-words text-sm font-medium text-foreground">
        {formatDateRange(slot.startsAt, slot.expiresAt, locale)}
      </p>
      <Badge className="w-fit shrink-0" tone={statusTone[slot.status ?? "SCHEDULED"]}>
        {getStatusLabel(slot.status, statusLabels)}
      </Badge>
    </li>
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

function getLocationErrorMessage(
  error: unknown,
  labels: Messages["employee"]["checkIn"],
) {
  if (error instanceof BrowserLocationError) {
    return labels.locationErrors[error.code];
  }

  return labels.locationErrors.UNKNOWN;
}

function getBackendErrorMessage(
  error: EmployeeEventApiError,
  labels: Messages["employee"]["checkIn"],
) {
  const backendErrors = labels.backendErrors as Record<string, string>;

  return backendErrors[error.code] ?? labels.backendErrors.REQUEST_FAILED;
}

function ResultCard({
  labels,
  locale,
  result,
  statusLabels,
}: {
  labels: Messages["employee"]["checkIn"];
  locale: Locale;
  result: EmployeeCheckInResult;
  statusLabels: Messages["status"];
}) {
  const tone = statusTone[result.proof.status] ?? "neutral";
  const description = result.assignment.checkedInAt
    ? result.proof.status === "SUSPICIOUS"
      ? labels.result.suspiciousDescription
      : labels.result.acceptedDescription
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
            {getStatusLabel(result.proof.status, statusLabels)}
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
            label={labels.fields.checkIn}
            value={
              result.assignment.checkedInAt
                ? formatDateTime(result.assignment.checkedInAt, locale)
                : labels.result.notStarted
            }
          />
        </dl>
        {result.proof.notes ? (
          <WarningBox tone={result.assignment.checkedInAt ? "warning" : "danger"}>
            {result.proof.notes}
          </WarningBox>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CheckInContent({
  item,
  labels,
  locale,
  proofPhotoLabels,
  statusLabels,
}: {
  item: EmployeeEventItem;
  labels: Messages["employee"]["checkIn"];
  locale: Locale;
  proofPhotoLabels: Messages["employee"]["proofPhoto"];
  statusLabels: Messages["status"];
}) {
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [location, setLocation] = useState<BrowserLocationResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitAttemptedWithoutLocation, setSubmitAttemptedWithoutLocation] =
    useState(false);
  const [result, setResult] = useState<EmployeeCheckInResult | null>(null);
  const proofPhoto = useProofPhotoUpload({
    assignmentId: item.assignment.id,
    labels: proofPhotoLabels,
    proofType: "CHECK_IN",
  });

  const eventOpen = isEventOpenForCheckIn(item);
  const assignmentEligible = isAssignmentEligible(item);
  const photoRequired = item.event.requirePhoto;
  const poorAccuracy =
    location && location.accuracyMeters > poorAccuracyThresholdMeters;

  const warnings = useMemo(() => {
    const messages: string[] = [];

    if (!assignmentEligible) {
      messages.push(labels.warnings.alreadyCheckedIn);
    }

    if (!eventOpen) {
      messages.push(labels.warnings.eventNotActive);
    }

    if (photoRequired && !proofPhoto.file && !proofPhoto.uploadedUrl) {
      messages.push(labels.warnings.photoRequired);
    }

    if (poorAccuracy) {
      messages.push(labels.warnings.poorAccuracy);
    }

    if (submitAttemptedWithoutLocation && !location) {
      messages.push(labels.warnings.locationRequired);
    }

    return messages;
  }, [
    assignmentEligible,
    eventOpen,
    labels,
    location,
    photoRequired,
    poorAccuracy,
    proofPhoto.file,
    proofPhoto.uploadedUrl,
    submitAttemptedWithoutLocation,
  ]);

  const mutation = useMutation({
    mutationFn: ({ photoUrl }: { photoUrl?: string }) => {
      if (!location || !deviceId) {
        throw new Error(labels.errors.missingLocationOrDevice);
      }

      return submitEmployeeCheckIn({
        eventId: item.event.id,
        payload: {
          accuracyMeters: location.accuracyMeters,
          deviceId,
          gpsTimestamp: location.gpsTimestamp,
          latitude: location.latitude,
          longitude: location.longitude,
          photoUrl,
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
      ]);
    },
  });

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

  async function handleSubmit() {
    if (!location) {
      setSubmitAttemptedWithoutLocation(true);
      return;
    }

    const photoUrl = await proofPhoto.preparePhotoUrl(photoRequired);

    if (photoUrl === null) {
      return;
    }

    mutation.mutate({ photoUrl });
  }

  const canSubmit =
    Boolean(location) &&
    Boolean(deviceId) &&
    assignmentEligible &&
    eventOpen &&
    (!photoRequired || Boolean(proofPhoto.file || proofPhoto.uploadedUrl)) &&
    !proofPhoto.uploading &&
    !mutation.isPending;
  const locationStepStatus = location
    ? labels.stepStatus.complete
    : labels.stepStatus.pending;
  const reviewStepStatus = location
    ? labels.stepStatus.ready
    : labels.stepStatus.pending;
  const photoStepStatus =
    proofPhoto.uploadedUrl || proofPhoto.file
      ? labels.stepStatus.complete
      : photoRequired
        ? labels.stepStatus.pending
        : labels.stepStatus.ready;
  const submitStepStatus = result
    ? labels.stepStatus.complete
    : canSubmit
      ? labels.stepStatus.ready
      : labels.stepStatus.pending;
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
              label={labels.fields.timeWindow}
              value={formatDateRange(
                item.event.startsAt,
                item.event.endsAt,
                locale,
              )}
            />
            <InfoItem
              label={labels.fields.photoRequirement}
              value={item.event.requirePhoto ? labels.photo.required : labels.photo.notRequired}
            />
            <InfoItem
              label={labels.fields.radius}
              value={`${formatNumber(item.event.radiusMeters, locale, 0)} ${labels.meters}`}
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
              tone={warning === labels.warnings.photoRequired ? "danger" : "warning"}
            >
              {warning}
            </WarningBox>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <div className="grid min-w-0 gap-4">
          <StepCard
            description={labels.steps.locationDescription}
            status={locationStepStatus}
            step={1}
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
            status={reviewStepStatus}
            step={2}
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
            status={photoStepStatus}
            step={3}
            title={labels.steps.photoTitle}
          >
            <ProofPhotoField
              disabled={mutation.isPending}
              error={proofPhoto.error}
              fileName={proofPhoto.fileName}
              labels={proofPhotoLabels}
              onClear={proofPhoto.clear}
              onFileChange={proofPhoto.handleFileChange}
              previewUrl={proofPhoto.previewUrl}
              required={photoRequired}
              uploadedUrl={proofPhoto.uploadedUrl}
              uploading={proofPhoto.uploading}
            />
          </StepCard>

          <StepCard
            description={labels.steps.submitDescription}
            status={submitStepStatus}
            step={4}
            title={labels.steps.submitTitle}
          >
            <Button
              className="w-full sm:w-fit"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {mutation.isPending || proofPhoto.uploading
                ? labels.actions.submitting
                : labels.actions.submit}
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

export function EmployeeCheckInClient({
  eventId,
  labels,
  locale,
  proofPhotoLabels,
  statusLabels,
}: EmployeeCheckInClientProps) {
  const query = useQuery({
    queryFn: () => fetchEmployeeEventDetails(eventId),
    queryKey: employeeEventQueryKeys.employeeEventDetails(eventId),
    ...employeeEventQueryOptions,
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
    <CheckInContent
      item={data}
      labels={labels}
      locale={locale}
      proofPhotoLabels={proofPhotoLabels}
      statusLabels={statusLabels}
    />
  );
}
