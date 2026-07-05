"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

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
  AdminEventApiError,
  adminEventQueryKeys,
  createAdminEvent,
} from "@/lib/admin-events";
import type { Locale, Messages } from "@/lib/i18n";

const LocationPickerMap = dynamic(
  () =>
    import("@/components/admin/location-picker-map").then(
      (mod) => mod.LocationPickerMap,
    ),
  {
    loading: () => (
      <div className="min-h-[300px] rounded-md border border-border bg-surface-subtle" />
    ),
    ssr: false,
  },
);

type AdminCreateEventClientProps = {
  labels: Messages["admin"]["createEvent"];
  locale: Locale;
};

type RecheckSlotForm = {
  id: string;
  startsAt: string;
  expiresAt: string;
};

type FieldKey =
  | "name"
  | "locationName"
  | "latitude"
  | "longitude"
  | "radiusMeters"
  | "startsAt"
  | "endsAt"
  | "employeeIds";

const defaultRadiusMeters = "100";

function toLocalDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseNullableNumber(value: string) {
  const parsed = parseNumber(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseEmployeeIds(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function toIsoString(value: string) {
  return new Date(value).toISOString();
}

function isSlotInsideWindow(slot: RecheckSlotForm, startsAt: string, endsAt: string) {
  if (!slot.startsAt || !slot.expiresAt || !startsAt || !endsAt) {
    return false;
  }

  const slotStart = new Date(slot.startsAt).getTime();
  const slotEnd = new Date(slot.expiresAt).getTime();
  const eventStart = new Date(startsAt).getTime();
  const eventEnd = new Date(endsAt).getTime();

  return slotStart >= eventStart && slotEnd <= eventEnd && slotStart < slotEnd;
}

function Field({
  children,
  description,
  error,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {description ? (
        <span className="text-xs leading-5 text-text-muted">{description}</span>
      ) : null}
      {error ? (
        <span className="text-xs leading-5 text-danger">{error}</span>
      ) : null}
    </label>
  );
}

function WarningBox({
  children,
  tone = "danger",
}: {
  children: React.ReactNode;
  tone?: "danger" | "info" | "warning" | "success";
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

export function AdminCreateEventClient({
  labels,
  locale,
}: AdminCreateEventClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const defaultStartsAt = toLocalDateTimeInputValue(
    new Date(now.getTime() + 60 * 60_000),
  );
  const defaultEndsAt = toLocalDateTimeInputValue(
    new Date(now.getTime() + 3 * 60 * 60_000),
  );
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(defaultRadiusMeters);
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [endsAt, setEndsAt] = useState(defaultEndsAt);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireCheckout, setRequireCheckout] = useState(true);
  const [employeeIdsText, setEmployeeIdsText] = useState("");
  const [slots, setSlots] = useState<RecheckSlotForm[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [slotError, setSlotError] = useState<string | null>(null);

  const employeeIds = useMemo(
    () => parseEmployeeIds(employeeIdsText),
    [employeeIdsText],
  );
  const latitudeNumber = parseNullableNumber(latitude);
  const longitudeNumber = parseNullableNumber(longitude);
  const selectedLatitude =
    latitudeNumber !== null && latitudeNumber >= -90 && latitudeNumber <= 90
      ? latitudeNumber
      : null;
  const selectedLongitude =
    longitudeNumber !== null && longitudeNumber >= -180 && longitudeNumber <= 180
      ? longitudeNumber
      : null;
  const radiusNumber = parseNullableNumber(radiusMeters);
  const mapRadiusMeters =
    radiusNumber !== null && radiusNumber > 0 ? Math.trunc(radiusNumber) : 0;
  const slotStates = slots.map((slot) =>
    isSlotInsideWindow(slot, startsAt, endsAt),
  );

  const mutation = useMutation({
    mutationFn: () =>
      createAdminEvent({
        employeeIds,
        endsAt: toIsoString(endsAt),
        latitude: parseNumber(latitude),
        locationName,
        longitude: parseNumber(longitude),
        name,
        radiusMeters: Math.trunc(parseNumber(radiusMeters)),
        recheckSlots: slots.map((slot) => ({
          startsAt: toIsoString(slot.startsAt),
          expiresAt: toIsoString(slot.expiresAt),
        })),
        requireCheckout,
        requirePhoto,
        startsAt: toIsoString(startsAt),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminEventQueryKeys.adminEvents(),
      });
      router.push(`/${locale}/admin/events`);
    },
  });

  const backendError =
    mutation.error instanceof AdminEventApiError ? mutation.error : null;

  function validateForm() {
    const errors: Partial<Record<FieldKey, string>> = {};
    const latitudeNumber = parseNumber(latitude);
    const longitudeNumber = parseNumber(longitude);
    const radiusNumber = parseNumber(radiusMeters);
    const startsAtTime = new Date(startsAt).getTime();
    const endsAtTime = new Date(endsAt).getTime();

    if (!name.trim()) {
      errors.name = labels.validation.required;
    }

    if (!locationName.trim()) {
      errors.locationName = labels.validation.required;
    }

    if (!Number.isFinite(latitudeNumber) || latitudeNumber < -90 || latitudeNumber > 90) {
      errors.latitude = labels.validation.latitude;
    }

    if (
      !Number.isFinite(longitudeNumber) ||
      longitudeNumber < -180 ||
      longitudeNumber > 180
    ) {
      errors.longitude = labels.validation.longitude;
    }

    if (!Number.isInteger(radiusNumber) || radiusNumber < 1) {
      errors.radiusMeters = labels.validation.radius;
    }

    if (!Number.isFinite(startsAtTime)) {
      errors.startsAt = labels.validation.required;
    }

    if (!Number.isFinite(endsAtTime) || endsAtTime <= startsAtTime) {
      errors.endsAt = labels.validation.endsAfterStart;
    }

    if (!employeeIds.length) {
      errors.employeeIds = labels.validation.employeeIds;
    }

    const slotsValid = slots.every((slot) =>
      isSlotInsideWindow(slot, startsAt, endsAt),
    );
    setSlotError(slotsValid ? null : labels.validation.slotsInvalid);
    setFieldErrors(errors);

    return Object.keys(errors).length === 0 && slotsValid;
  }

  function addSlot() {
    const baseStart = startsAt ? new Date(startsAt) : new Date();
    const slotStart = new Date(baseStart.getTime() + (slots.length + 1) * 30 * 60_000);
    const slotEnd = new Date(slotStart.getTime() + 10 * 60_000);

    setSlotError(null);
    setSlots((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        startsAt: toLocalDateTimeInputValue(slotStart),
        expiresAt: toLocalDateTimeInputValue(slotEnd),
      },
    ]);
  }

  function updateSlot(id: string, key: "startsAt" | "expiresAt", value: string) {
    setSlotError(null);
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, [key]: value } : slot)),
    );
  }

  function removeSlot(id: string) {
    setSlotError(null);
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }

  function handleLocationChange(nextLatitude: number, nextLongitude: number) {
    setLatitude(nextLatitude.toFixed(6));
    setLongitude(nextLongitude.toFixed(6));
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.latitude;
      delete nextErrors.longitude;
      return nextErrors;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    mutation.mutate();
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{labels.sections.basicsTitle}</CardTitle>
          <CardDescription>{labels.sections.basicsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field error={fieldErrors.name} label={labels.fields.name}>
            <Input
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          <Field error={fieldErrors.locationName} label={labels.fields.locationName}>
            <Input
              autoComplete="off"
              onChange={(event) => setLocationName(event.target.value)}
              value={locationName}
            />
          </Field>
          <div className="grid gap-3 md:col-span-2">
            <div className="grid gap-1">
              <h3 className="text-sm font-medium text-foreground">
                {labels.map.title}
              </h3>
              <p className="text-sm leading-6 text-text-muted">
                {labels.map.description}
              </p>
            </div>
            <LocationPickerMap
              labels={labels.map}
              latitude={
                selectedLatitude !== null && selectedLongitude !== null
                  ? selectedLatitude
                  : null
              }
              longitude={
                selectedLatitude !== null && selectedLongitude !== null
                  ? selectedLongitude
                  : null
              }
              onLocationChange={handleLocationChange}
              radiusMeters={mapRadiusMeters}
            />
          </div>
          <Field
            description={labels.help.coordinates}
            error={fieldErrors.latitude}
            label={labels.fields.latitude}
          >
            <Input
              inputMode="decimal"
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="31.9539"
              value={latitude}
            />
          </Field>
          <Field
            description={labels.help.coordinates}
            error={fieldErrors.longitude}
            label={labels.fields.longitude}
          >
            <Input
              inputMode="decimal"
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="35.9106"
              value={longitude}
            />
          </Field>
          <Field error={fieldErrors.radiusMeters} label={labels.fields.radiusMeters}>
            <Input
              inputMode="numeric"
              min={1}
              onChange={(event) => setRadiusMeters(event.target.value)}
              type="number"
              value={radiusMeters}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{labels.sections.scheduleTitle}</CardTitle>
          <CardDescription>{labels.sections.scheduleDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field error={fieldErrors.startsAt} label={labels.fields.startsAt}>
            <Input
              onChange={(event) => setStartsAt(event.target.value)}
              type="datetime-local"
              value={startsAt}
            />
          </Field>
          <Field error={fieldErrors.endsAt} label={labels.fields.endsAt}>
            <Input
              onChange={(event) => setEndsAt(event.target.value)}
              type="datetime-local"
              value={endsAt}
            />
          </Field>
          <label className="flex min-w-0 items-start gap-3 rounded-md border border-border bg-surface px-3 py-3">
            <input
              checked={requirePhoto}
              className="mt-1 size-4 accent-primary"
              onChange={(event) => setRequirePhoto(event.target.checked)}
              type="checkbox"
            />
            <span className="grid min-w-0 gap-1">
              <span className="text-sm font-medium text-foreground">
                {labels.fields.requirePhoto}
              </span>
              <span className="text-xs leading-5 text-text-muted">
                {labels.help.requirePhoto}
              </span>
            </span>
          </label>
          <label className="flex min-w-0 items-start gap-3 rounded-md border border-border bg-surface px-3 py-3">
            <input
              checked={requireCheckout}
              className="mt-1 size-4 accent-primary"
              onChange={(event) => setRequireCheckout(event.target.checked)}
              type="checkbox"
            />
            <span className="grid min-w-0 gap-1">
              <span className="text-sm font-medium text-foreground">
                {labels.fields.requireCheckout}
              </span>
              <span className="text-xs leading-5 text-text-muted">
                {labels.help.requireCheckout}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{labels.sections.assignmentsTitle}</CardTitle>
          <CardDescription>{labels.sections.assignmentsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <WarningBox tone="info">{labels.employeeIdsTemporary}</WarningBox>
          <Field
            description={labels.help.employeeIds}
            error={fieldErrors.employeeIds}
            label={labels.fields.employeeIds}
          >
            <textarea
              className="min-h-28 w-full min-w-0 resize-y rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)] transition-colors placeholder:text-text-subtle"
              onChange={(event) => setEmployeeIdsText(event.target.value)}
              value={employeeIdsText}
            />
          </Field>
          <p className="text-sm text-text-muted">
            {labels.selectedEmployees.replace("{count}", String(employeeIds.length))}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="grid gap-1.5">
            <CardTitle>{labels.sections.rechecksTitle}</CardTitle>
            <CardDescription>{labels.sections.rechecksDescription}</CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={addSlot} variant="outline">
            {labels.actions.addSlot}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {slots.length ? (
            slots.map((slot, index) => {
              const insideWindow = slotStates[index];

              return (
                <div
                  className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  key={slot.id}
                >
                  <Field label={labels.fields.slotStartsAt}>
                    <Input
                      onChange={(event) =>
                        updateSlot(slot.id, "startsAt", event.target.value)
                      }
                      type="datetime-local"
                      value={slot.startsAt}
                    />
                  </Field>
                  <Field label={labels.fields.slotExpiresAt}>
                    <Input
                      onChange={(event) =>
                        updateSlot(slot.id, "expiresAt", event.target.value)
                      }
                      type="datetime-local"
                      value={slot.expiresAt}
                    />
                  </Field>
                  <div className="grid gap-2 md:pt-7">
                    <Button
                      className="w-full"
                      onClick={() => removeSlot(slot.id)}
                      variant="outline"
                    >
                      {labels.actions.removeSlot}
                    </Button>
                    <span
                      className={
                        insideWindow
                          ? "text-xs leading-5 text-success"
                          : "text-xs leading-5 text-warning"
                      }
                    >
                      {insideWindow
                        ? labels.validation.slotInsideWindow
                        : labels.validation.slotOutsideWindow}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6">
              <p className="text-sm font-medium text-foreground">
                {labels.noSlotsTitle}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
                {labels.noSlotsDescription}
              </p>
            </div>
          )}
          {slotError ? <WarningBox tone="warning">{slotError}</WarningBox> : null}
        </CardContent>
      </Card>

      {backendError ? (
        <WarningBox>
          <span className="block font-medium">
            {(labels.backendErrors as Record<string, string>)[backendError.code] ??
              labels.backendErrors.REQUEST_FAILED}
          </span>
          <span className="mt-1 block text-danger">{backendError.message}</span>
        </WarningBox>
      ) : null}

      {mutation.error && !backendError ? (
        <WarningBox>{labels.errors.unknownSubmitError}</WarningBox>
      ) : null}

      <div className="grid gap-2 sm:flex sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? labels.actions.submitting : labels.actions.submit}
        </Button>
      </div>
    </form>
  );
}
