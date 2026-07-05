import type { DeviceStatus } from "@prisma/client";

import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api-response";
import { clientQueryKeys } from "@/lib/cache";

export const adminDeviceQueryOptions = {
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

export const adminDeviceQueryKeys = {
  adminDevices: () => clientQueryKeys.admin.devices.list(),
};

export type AdminDeviceRecord = {
  id: string;
  userId: string;
  deviceId: string;
  status: DeviceStatus;
  label: string | null;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

export type AdminDeviceListResult = {
  items: AdminDeviceRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type AdminDeviceReviewResult = {
  device: Omit<AdminDeviceRecord, "user">;
};

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export class AdminDeviceApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readAdminDeviceApiBody<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiBody<T>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new AdminDeviceApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export async function fetchAdminDevices({
  page = 1,
  pageSize = 20,
  status,
}: {
  page?: number;
  pageSize?: number;
  status?: DeviceStatus | "";
} = {}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (status) {
    searchParams.set("status", status);
  }

  const response = await fetch(`/api/admin/devices?${searchParams}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminDeviceApiBody<AdminDeviceListResult>(response);
}

export async function approveAdminDevice(deviceRecordId: string) {
  const response = await fetch(`/api/admin/devices/${deviceRecordId}/approve`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminDeviceApiBody<AdminDeviceReviewResult>(response);
}

export async function rejectAdminDevice(deviceRecordId: string) {
  const response = await fetch(`/api/admin/devices/${deviceRecordId}/reject`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminDeviceApiBody<AdminDeviceReviewResult>(response);
}
