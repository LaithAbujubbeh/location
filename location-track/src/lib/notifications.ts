import type { NotificationChannel, NotificationType } from "@prisma/client";

import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api-response";
import type { Locale } from "@/lib/i18n";

export const notificationQueryOptions = {
  refetchInterval: 15_000,
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

export const notificationQueryKeys = {
  notifications: () => ["notifications"] as const,
  unreadNotifications: () => ["unreadNotifications"] as const,
};

export type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResult = {
  items: NotificationRecord[];
  unreadCount: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type MarkAllReadResult = {
  updatedCount: number;
};

type DeleteNotificationResult = {
  deleted: true;
};

type DeleteAllNotificationsResult = {
  deletedCount: number;
};

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export class NotificationApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readNotificationApiBody<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiBody<T>;

  if (!response.ok || !body.ok) {
    const error = body.ok
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;

    throw new NotificationApiError(error.code, error.message, response.status);
  }

  return body.data;
}

export async function fetchNotifications({
  page = 1,
  pageSize = 20,
  unread,
}: {
  page?: number;
  pageSize?: number;
  unread?: boolean;
} = {}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (unread !== undefined) {
    searchParams.set("unread", String(unread));
  }

  const response = await fetch(`/api/notifications?${searchParams}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  return readNotificationApiBody<NotificationListResult>(response);
}

export async function fetchUnreadNotifications() {
  return fetchNotifications({
    page: 1,
    pageSize: 5,
    unread: true,
  });
}

export async function markNotificationRead(notificationId: string) {
  const response = await fetch(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
    },
  );

  return readNotificationApiBody<NotificationRecord>(response);
}

export async function markAllNotificationsRead() {
  const response = await fetch("/api/notifications/read-all", {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
  });

  return readNotificationApiBody<MarkAllReadResult>(response);
}

export async function deleteNotification(notificationId: string) {
  const response = await fetch(
    `/api/notifications/${encodeURIComponent(notificationId)}`,
    {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
    },
  );

  return readNotificationApiBody<DeleteNotificationResult>(response);
}

export async function deleteAllNotifications() {
  const response = await fetch("/api/notifications", {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  });

  return readNotificationApiBody<DeleteAllNotificationsResult>(response);
}

export function localizedNotificationLink(link: string | null, locale: Locale) {
  if (!link) {
    return null;
  }

  const normalizedLink = link.startsWith("/") ? link : `/${link}`;
  const withoutLocale = normalizedLink.replace(/^\/(?:en|ar)(?=\/|$)/, "");

  return `/${locale}${withoutLocale || "/"}`;
}
