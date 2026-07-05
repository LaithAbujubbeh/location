import type { EventStatus } from "@prisma/client";

import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api-response";
import { clientQueryKeys } from "@/lib/cache";

export const adminEventQueryOptions = {
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

export const adminEventQueryKeys = {
  adminEvents: () => clientQueryKeys.admin.events.list(),
};

export type AdminEventRecheckSlot = {
  id: string;
  startsAt: string;
  expiresAt: string;
};

export type AdminEventListItem = {
  id: string;
  name: string;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  radiusMeters: number;
  requirePhoto: boolean;
  requireCheckout: boolean;
  recheckSlots: AdminEventRecheckSlot[];
  createdAt: string;
  assignedEmployeesCount: number;
};

export type AdminEventListResult = {
  items: AdminEventListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type AdminCreateEventPayload = {
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  employeeIds: string[];
  recheckSlots: Array<{
    startsAt: string;
    expiresAt: string;
  }>;
  requirePhoto: boolean;
  requireCheckout: boolean;
};

export type AdminCreateEventResult = {
  event: Omit<AdminEventListItem, "assignedEmployeesCount"> & {
    latitude: number;
    longitude: number;
    createdByUserId: string;
  };
  assignedEmployeesCount: number;
};

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export class AdminEventApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readAdminApiBody<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiBody<T>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new AdminEventApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export async function fetchAdminEvents({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/admin/events?${searchParams}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminApiBody<AdminEventListResult>(response);
}

export async function createAdminEvent(payload: AdminCreateEventPayload) {
  const response = await fetch("/api/admin/events", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readAdminApiBody<AdminCreateEventResult>(response);
}

export function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateRange(startsAt: string, endsAt: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).formatRange(new Date(startsAt), new Date(endsAt));
}
