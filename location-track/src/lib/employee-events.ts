import type {
  AssignmentStatus,
  EventStatus,
  ProofStatus,
  ProofType,
  RecheckStatus,
} from "@prisma/client";

import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api-response";
import type { Locale } from "@/lib/i18n";

export const employeeEventQueryOptions = {
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

export const employeeEventQueryKeys = {
  employeeEventDetails: (eventId: string) =>
    ["employeeEventDetails", eventId] as const,
  employeeEvents: () => ["employeeEvents"] as const,
  recheckDetails: (eventId: string) => ["recheckDetails", eventId] as const,
};

export type EmployeeEventRecheckSlot = {
  id: string;
  startsAt: string;
  expiresAt: string;
  status: RecheckStatus | null;
  submittedAt: string | null;
  completedAt: string | null;
};

export type EmployeeEventItem = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    completedAt: string | null;
  };
  event: {
    id: string;
    name: string;
    locationName: string | null;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    startsAt: string;
    endsAt: string;
    status: EventStatus;
    requirePhoto: boolean;
    requireCheckout: boolean;
    recheckSlots: EmployeeEventRecheckSlot[];
  };
};

export type EmployeeEventListResult = {
  items: EmployeeEventItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type EmployeeCheckInPayload = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  gpsTimestamp: string;
  deviceId: string;
  photoUrl?: string;
};

export type EmployeeRecheckSubmitPayload = EmployeeCheckInPayload;

export type EmployeeCheckOutPayload = EmployeeCheckInPayload;

export type EmployeeCheckInResult = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    checkedInAt: string | null;
    failureReason: string | null;
  };
  proof: {
    id: string;
    type: ProofType;
    status: ProofStatus;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    distanceMeters: number;
    gpsTimestamp: string;
    deviceId: string;
    photoUrl: string | null;
    rejectionCode: string | null;
    notes: string | null;
    createdAt: string;
  };
  verification: {
    distanceMeters: number;
    radiusMeters: number;
    gpsAgeMs: number;
  };
};

export type EmployeeRecheckSubmitResult = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    failureReason: string | null;
  };
  recheck: {
    id: string;
    status: RecheckStatus;
    startsAt: string;
    expiresAt: string;
    submittedAt: string;
  };
  proof: EmployeeCheckInResult["proof"];
  verification: EmployeeCheckInResult["verification"];
};

export type EmployeeCheckOutResult = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    checkedInAt: string | null;
    checkedOutAt: string;
    completedAt: string | null;
    failureReason: string | null;
  };
  proof: EmployeeCheckInResult["proof"];
  verification: EmployeeCheckInResult["verification"];
};

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export class EmployeeEventApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function fetchEmployeeApi<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = (await response.json()) as ApiBody<T>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new EmployeeEventApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export function fetchEmployeeEvents() {
  return fetchEmployeeApi<EmployeeEventListResult>("/api/employee/events");
}

export function fetchEmployeeEventDetails(eventId: string) {
  return fetchEmployeeApi<EmployeeEventItem>(
    `/api/employee/events/${encodeURIComponent(eventId)}`,
  );
}

export async function submitEmployeeCheckIn({
  eventId,
  payload,
}: {
  eventId: string;
  payload: EmployeeCheckInPayload;
}) {
  const response = await fetch(
    `/api/employee/events/${encodeURIComponent(eventId)}/check-in`,
    {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const body = (await response.json()) as ApiBody<EmployeeCheckInResult>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new EmployeeEventApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export async function submitEmployeeRecheck({
  eventId,
  payload,
  slotId,
}: {
  eventId: string;
  slotId: string;
  payload: EmployeeRecheckSubmitPayload;
}) {
  const response = await fetch(
    `/api/employee/events/${encodeURIComponent(eventId)}/rechecks/${encodeURIComponent(slotId)}/submit`,
    {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const body = (await response.json()) as ApiBody<EmployeeRecheckSubmitResult>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new EmployeeEventApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export async function submitEmployeeCheckOut({
  eventId,
  payload,
}: {
  eventId: string;
  payload: EmployeeCheckOutPayload;
}) {
  const response = await fetch(
    `/api/employee/events/${encodeURIComponent(eventId)}/check-out`,
    {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const body = (await response.json()) as ApiBody<EmployeeCheckOutResult>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new EmployeeEventApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateRange(startsAt: string, endsAt: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).formatRange(new Date(startsAt), new Date(endsAt));
}

export function findNextRecheckSlot(
  slots: EmployeeEventRecheckSlot[],
  now = new Date(),
) {
  return (
    slots.find((slot) => {
      const status = slot.status;

      if (status === "COMPLETED" || status === "PASSED") {
        return false;
      }

      return new Date(slot.expiresAt).getTime() >= now.getTime();
    }) ?? null
  );
}

export function findActionableRecheckSlot(slots: EmployeeEventRecheckSlot[]) {
  return (
    slots.find((slot) => slot.status === "PENDING" || slot.status === "ACTIVE") ??
    null
  );
}

export function canCheckIn(event: EmployeeEventItem) {
  return event.assignment.checkedInAt === null;
}

export function canCheckOut(event: EmployeeEventItem) {
  return (
    event.event.requireCheckout &&
    event.assignment.checkedInAt !== null &&
    event.assignment.checkedOutAt === null
  );
}
