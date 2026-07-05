import type { UserRole } from "@prisma/client";

import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api-response";
import { clientQueryKeys } from "@/lib/cache";

export const adminUserQueryOptions = {
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

export const adminUserQueryKeys = {
  adminUserDetails: (userId: string) => clientQueryKeys.admin.users.detail(userId),
  adminUsers: () => clientQueryKeys.admin.users.list(),
};

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListResult = {
  items: AdminUserRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type AdminCreateUserPayload = {
  name: string;
  email: string;
  isActive: boolean;
  password: string;
  role: UserRole;
};

export type AdminUpdateUserPayload = {
  isActive: boolean;
  name: string;
  role: UserRole;
};

type AdminUserMutationResult = {
  user: AdminUserRecord;
};

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export class AdminUserApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readAdminUserApiBody<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiBody<T>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new AdminUserApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export async function fetchAdminUsers({
  page = 1,
  pageSize = 20,
  role,
  search,
  isActive,
}: {
  isActive?: boolean | "";
  page?: number;
  pageSize?: number;
  role?: UserRole | "";
  search?: string;
} = {}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (role) {
    searchParams.set("role", role);
  }

  if (isActive !== undefined && isActive !== "") {
    searchParams.set("isActive", String(isActive));
  }

  if (search?.trim()) {
    searchParams.set("search", search.trim());
  }

  const response = await fetch(`/api/admin/users?${searchParams}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminUserApiBody<AdminUserListResult>(response);
}

export async function fetchAdminUser(userId: string) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  return readAdminUserApiBody<AdminUserMutationResult>(response);
}

export async function createAdminUser(payload: AdminCreateUserPayload) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readAdminUserApiBody<AdminUserMutationResult>(response);
}

export async function updateAdminUser(
  userId: string,
  payload: AdminUpdateUserPayload,
) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readAdminUserApiBody<AdminUserMutationResult>(response);
}

export function formatUserDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
