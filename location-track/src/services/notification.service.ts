import {
  NotificationChannel,
  NotificationType,
  Prisma,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { AuthenticatedSession } from "../lib/permissions.ts";
import type { EmployeeNotificationListQueryInput } from "../lib/validators.ts";

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

export type EmployeeNotificationListResult = {
  items: NotificationRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

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

function stripEmailHeaderControls(value: string) {
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
  const locationText = locationName ? ` at ${locationName}` : "";
  const expiresAtText = formatDateForMessage(expiresAt);
  const title = stripEmailHeaderControls(`Recheck required for ${eventName}`);
  const message = `Please confirm you are still at ${eventName}${locationText} before ${expiresAtText}.`;

  return {
    title,
    message,
  };
}

async function createInAppNotification(
  tx: Prisma.TransactionClient,
  input: RecheckNotificationInput,
) {
  const content = buildRecheckNotificationContent(input);

  await tx.notification.create({
    data: {
      userId: input.userId,
      title: content.title,
      message: content.message,
      type: NotificationType.RECHECK,
      channel: NotificationChannel.IN_APP,
      link: null,
      createdAt: input.now,
    },
    select: {
      id: true,
    },
  });
}

export async function sendRecheckNotification({
  tx,
  ...input
}: SendRecheckNotificationArgs): Promise<RecheckNotificationResult> {
  await createInAppNotification(tx, input);

  return {
    inAppCreated: true,
  };
}

export async function listNotificationsForEmployee({
  userId,
  query,
}: {
  userId: string;
  query: EmployeeNotificationListQueryInput;
}) {
  const { prisma } = await import("../lib/prisma.ts");

  return listNotificationsForEmployeeWithClient(prisma, { userId, query });
}

export async function listNotificationsForEmployeeWithClient(
  client: NotificationClient,
  {
    userId,
    query,
  }: {
    userId: string;
    query: EmployeeNotificationListQueryInput;
  },
): Promise<EmployeeNotificationListResult> {
  const where: Prisma.NotificationWhereInput = {
    userId,
  };
  const skip = (query.page - 1) * query.pageSize;
  const [total, notifications] = await client.$transaction([
    client.notification.count({ where }),
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

export async function markNotificationReadForEmployee({
  userId,
  notificationId,
  now = new Date(),
}: {
  userId: string;
  notificationId: string;
  now?: Date;
}) {
  const { prisma } = await import("../lib/prisma.ts");

  return markNotificationReadForEmployeeWithClient(prisma, {
    userId,
    notificationId,
    now,
  });
}

export async function markNotificationReadForEmployeeWithClient(
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
  const updateResult = await client.notification.updateMany({
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

  if (updateResult.count === 0 && !notification.readAt) {
    throw new NotificationServiceError(
      409,
      "NOTIFICATION_NOT_READ",
      "Notification could not be marked as read.",
    );
  }

  return toNotificationRecord(notification);
}

export function getEmployeeIdFromSession(session: AuthenticatedSession) {
  return session.user.id;
}
