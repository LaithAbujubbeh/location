import {
  NotificationChannel,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { AuthenticatedSession } from "../lib/permissions.ts";
import type { NotificationListQueryInput } from "../lib/validators.ts";

export const NOTIFICATION_CHANNELS = {
  IN_APP: NotificationChannel.IN_APP,
} as const;

export class NotificationServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "NotificationServiceError";
    this.status = status;
    this.code = code;
  }
}

type NotificationClient = Prisma.TransactionClient | PrismaClient;

export type RecheckNotificationInput = {
  userId: string;
  eventId: string;
  eventName: string;
  locationName: string | null;
  expiresAt: Date;
  now: Date;
};

export type RecheckNotificationResult = {
  inAppCreated: boolean;
};

type SendRecheckNotificationArgs = RecheckNotificationInput & {
  tx: Prisma.TransactionClient;
};

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  now?: Date;
};

const notificationSelect = {
  id: true,
  userId: true,
  title: true,
  message: true,
  type: true,
  channel: true,
  link: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type SelectedNotification = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

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

export type EmployeeNotificationListResult = NotificationListResult;

function toNotificationRecord(
  notification: SelectedNotification,
): NotificationRecord {
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    channel: notification.channel,
    link: notification.link,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function formatDateForMessage(date: Date) {
  return date.toISOString();
}

function stripHeaderControls(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildRecheckNotificationContent({
  eventName,
  locationName,
  expiresAt,
}: Pick<
  RecheckNotificationInput,
  "eventName" | "locationName" | "expiresAt"
>) {
  const safeEventName = stripHeaderControls(eventName);
  const safeLocationName = locationName ? stripHeaderControls(locationName) : "";
  const locationText = safeLocationName ? ` at ${safeLocationName}` : "";
  const expiresAtText = formatDateForMessage(expiresAt);

  return {
    title: `Recheck required for ${safeEventName}`,
    message: `Please confirm you are still at ${safeEventName}${locationText} before ${expiresAtText}.`,
  };
}

export async function createInAppNotificationWithClient(
  client: NotificationClient,
  input: CreateNotificationInput,
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      title: stripHeaderControls(input.title),
      message: stripHeaderControls(input.message),
      type: input.type,
      channel: NotificationChannel.IN_APP,
      link: input.link ?? null,
      ...(input.now ? { createdAt: input.now } : {}),
    },
    select: {
      id: true,
    },
  });
}

export async function createInAppNotification(input: CreateNotificationInput) {
  const { prisma } = await import("../lib/prisma.ts");

  return createInAppNotificationWithClient(prisma, input);
}

export async function sendRecheckNotification({
  tx,
  ...input
}: SendRecheckNotificationArgs): Promise<RecheckNotificationResult> {
  const content = buildRecheckNotificationContent(input);

  await createInAppNotificationWithClient(tx, {
    userId: input.userId,
    title: content.title,
    message: content.message,
    type: NotificationType.RECHECK,
    link: `/employee/events/${input.eventId}/recheck`,
    now: input.now,
  });

  return {
    inAppCreated: true,
  };
}

export async function notifyAdminsOfPendingDevice(
  client: NotificationClient,
  { now = new Date() }: { now?: Date } = {},
) {
  const admins = await client.user.findMany({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (admins.length === 0) {
    return 0;
  }

  await client.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: "New device needs approval",
      message: "Review the pending device request in the admin devices page.",
      type: NotificationType.DEVICE,
      channel: NotificationChannel.IN_APP,
      link: "/admin/devices",
      createdAt: now,
    })),
  });

  return admins.length;
}

export async function notifyEmployeeDeviceApproved(
  client: NotificationClient,
  { userId, now = new Date() }: { userId: string; now?: Date },
) {
  await createInAppNotificationWithClient(client, {
    userId,
    title: "Your device was approved",
    message: "You can now use this device for attendance actions.",
    type: NotificationType.DEVICE,
    link: "/employee/events",
    now,
  });
}

export async function notifyEmployeeDeviceRejected(
  client: NotificationClient,
  { userId, now = new Date() }: { userId: string; now?: Date },
) {
  await createInAppNotificationWithClient(client, {
    userId,
    title: "Your device was rejected",
    message: "Use an approved device or contact an administrator.",
    type: NotificationType.DEVICE,
    link: "/employee/events",
    now,
  });
}

export async function notifyEmployeeMissedRecheck(
  client: NotificationClient,
  {
    eventId,
    userId,
    now = new Date(),
  }: {
    eventId: string;
    userId: string;
    now?: Date;
  },
) {
  await createInAppNotificationWithClient(client, {
    userId,
    title: "You missed a recheck",
    message: "A scheduled recheck expired before it was submitted.",
    type: NotificationType.RECHECK,
    link: `/employee/events/${eventId}`,
    now,
  });
}

export async function notifyAdminsOfSuspiciousProof(
  client: NotificationClient,
  {
    eventId,
    now = new Date(),
  }: {
    eventId: string;
    now?: Date;
  },
) {
  const admins = await client.user.findMany({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (admins.length === 0) {
    return 0;
  }

  await client.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: "Suspicious attendance proof needs review",
      message: "Review the attendance timeline for the related event.",
      type: NotificationType.ATTENDANCE_REVIEW,
      channel: NotificationChannel.IN_APP,
      link: `/admin/events/${eventId}/timeline`,
      createdAt: now,
    })),
  });

  return admins.length;
}

export async function listNotificationsForUser({
  userId,
  query,
}: {
  userId: string;
  query: NotificationListQueryInput;
}) {
  const { prisma } = await import("../lib/prisma.ts");

  return listNotificationsForUserWithClient(prisma, { userId, query });
}

export async function listNotificationsForUserWithClient(
  client: NotificationClient,
  {
    userId,
    query,
  }: {
    userId: string;
    query: NotificationListQueryInput;
  },
): Promise<NotificationListResult> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unread === true ? { readAt: null } : {}),
  };
  const unreadWhere: Prisma.NotificationWhereInput = {
    userId,
    readAt: null,
  };
  const skip = (query.page - 1) * query.pageSize;
  const [total, unreadCount, notifications] = await client.$transaction([
    client.notification.count({ where }),
    client.notification.count({ where: unreadWhere }),
    client.notification.findMany({
      where,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "asc",
        },
      ],
      skip,
      take: query.pageSize,
      select: notificationSelect,
    }),
  ]);
  const totalPages = Math.ceil(total / query.pageSize);

  return {
    items: notifications.map(toNotificationRecord),
    unreadCount,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    },
  };
}

export async function listNotificationsForEmployee({
  userId,
  query,
}: {
  userId: string;
  query: NotificationListQueryInput;
}) {
  return listNotificationsForUser({ userId, query });
}

export async function listNotificationsForEmployeeWithClient(
  client: NotificationClient,
  input: {
    userId: string;
    query: NotificationListQueryInput;
  },
) {
  return listNotificationsForUserWithClient(client, input);
}

export async function markNotificationReadForUser({
  userId,
  notificationId,
  now = new Date(),
}: {
  userId: string;
  notificationId: string;
  now?: Date;
}) {
  const { prisma } = await import("../lib/prisma.ts");

  return markNotificationReadForUserWithClient(prisma, {
    userId,
    notificationId,
    now,
  });
}

export async function markNotificationReadForUserWithClient(
  client: NotificationClient,
  {
    userId,
    notificationId,
    now,
  }: {
    userId: string;
    notificationId: string;
    now: Date;
  },
): Promise<NotificationRecord> {
  await client.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      readAt: null,
    },
    data: {
      readAt: now,
    },
  });

  const notification = await client.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: notificationSelect,
  });

  if (!notification) {
    throw new NotificationServiceError(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification was not found.",
    );
  }

  return toNotificationRecord(notification);
}

export async function markNotificationReadForEmployee(input: {
  userId: string;
  notificationId: string;
  now?: Date;
}) {
  return markNotificationReadForUser(input);
}

export async function markNotificationReadForEmployeeWithClient(
  client: NotificationClient,
  input: {
    userId: string;
    notificationId: string;
    now: Date;
  },
) {
  return markNotificationReadForUserWithClient(client, input);
}

export async function markAllNotificationsReadForUser({
  userId,
  now = new Date(),
}: {
  userId: string;
  now?: Date;
}) {
  const { prisma } = await import("../lib/prisma.ts");
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: now,
    },
  });

  return {
    updatedCount: result.count,
  };
}

export async function deleteNotificationForUser({
  userId,
  notificationId,
}: {
  userId: string;
  notificationId: string;
}) {
  const { prisma } = await import("../lib/prisma.ts");

  return deleteNotificationForUserWithClient(prisma, {
    userId,
    notificationId,
  });
}

export async function deleteNotificationForUserWithClient(
  client: NotificationClient,
  {
    userId,
    notificationId,
  }: {
    userId: string;
    notificationId: string;
  },
) {
  const result = await client.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (result.count !== 1) {
    throw new NotificationServiceError(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification was not found.",
    );
  }

  return {
    deleted: true as const,
  };
}

export async function deleteAllNotificationsForUser({
  userId,
}: {
  userId: string;
}) {
  const { prisma } = await import("../lib/prisma.ts");

  return deleteAllNotificationsForUserWithClient(prisma, { userId });
}

export async function deleteAllNotificationsForUserWithClient(
  client: NotificationClient,
  { userId }: { userId: string },
) {
  const result = await client.notification.deleteMany({
    where: {
      userId,
    },
  });

  return {
    deletedCount: result.count,
  };
}

export function getEmployeeIdFromSession(session: AuthenticatedSession) {
  return session.user.id;
}
