import type {
  AssignmentStatus,
  EventStatus,
  ProofStatus,
  ProofType,
  RecheckStatus,
} from "@prisma/client";

import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api-response";
import { clientQueryKeys } from "@/lib/cache";

export const adminEventQueryOptions = {
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

export const adminEventQueryKeys = {
  adminEventEmployees: (eventId: string) =>
    clientQueryKeys.admin.events.employees(eventId),
  adminEventTimeline: (eventId: string) =>
    clientQueryKeys.admin.events.timeline(eventId),
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
  latitude: number;
  longitude: number;
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

export type AdminEventSummary = Omit<
  AdminEventListItem,
  "assignedEmployeesCount" | "createdAt" | "status"
> & {
  status?: EventStatus;
  createdAt?: string;
  assignedEmployeesCount?: number;
};

export type AdminAssignmentSummary = {
  assignmentId: string;
  employeeId: string;
  employee: {
    name: string;
    email: string;
  } | null;
  status: AssignmentStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  finalReason: string | null;
};

export type AdminEventEmployeesResult = {
  event: AdminEventSummary;
  assignments: AdminAssignmentSummary[];
  pagination: AdminEventListResult["pagination"];
};

export type AdminProofTimelineRecord = {
  id: string;
  assignmentId: string;
  employeeId: string;
  type: ProofType;
  status: ProofStatus;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceMeters: number;
  gpsTimestamp: string;
  photoUrl: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdminRecheckTimelineRecord = {
  id: string;
  assignmentId: string;
  employeeId: string;
  status: RecheckStatus;
  startsAt: string;
  expiresAt: string;
  submittedAt: string | null;
  notificationSentAt: string | null;
  reason: string | null;
};

export type AdminEventTimelineAssignment = AdminAssignmentSummary & {
  proofs: AdminProofTimelineRecord[];
  rechecks: AdminRecheckTimelineRecord[];
};

export type AdminEventTimelineResult = {
  event: AdminEventSummary;
  recheckSlots: AdminEventRecheckSlot[];
  assignments: AdminEventTimelineAssignment[];
  timeline: AdminProofTimelineRecord[];
  rechecks: AdminRecheckTimelineRecord[];
  pagination: AdminEventListResult["pagination"];
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

export type AdminUpdateEventPayload = {
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  requirePhoto: boolean;
  requireCheckout: boolean;
  status: EventStatus;
};

export type AdminUpdateEventResult = {
  event: AdminEventSummary;
};

export type AdminDeleteEventResult = {
  deleted: true;
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

export async function fetchAdminEventEmployees({
  employeeId,
  eventId,
  page = 1,
  pageSize = 50,
  status,
}: {
  employeeId?: string;
  eventId: string;
  page?: number;
  pageSize?: number;
  status?: AssignmentStatus | "";
}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (status) {
    searchParams.set("status", status);
  }

  if (employeeId) {
    searchParams.set("employeeId", employeeId);
  }

  const response = await fetch(
    `/api/admin/events/${eventId}/employees?${searchParams}`,
    {
      cache: "no-store",
      credentials: "same-origin",
    },
  );

  return readAdminApiBody<AdminEventEmployeesResult>(response);
}

export async function fetchAdminEventTimeline({
  eventId,
  page = 1,
  pageSize = 50,
  status,
}: {
  eventId: string;
  page?: number;
  pageSize?: number;
  status?: AssignmentStatus | "";
}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (status) {
    searchParams.set("status", status);
  }

  const response = await fetch(
    `/api/admin/events/${eventId}/timeline?${searchParams}`,
    {
      cache: "no-store",
      credentials: "same-origin",
    },
  );

  return readAdminApiBody<AdminEventTimelineResult>(response);
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

export async function updateAdminEvent(
  eventId: string,
  payload: AdminUpdateEventPayload,
) {
  const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readAdminApiBody<AdminUpdateEventResult>(response);
}

export async function deleteAdminEvent(eventId: string) {
  const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminApiBody<AdminDeleteEventResult>(response);
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
