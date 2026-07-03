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
  EMAIL: NotificationChannel.EMAIL,
  SMS: NotificationChannel.SMS,
  WHATSAPP: NotificationChannel.WHATSAPP,
  WEB_PUSH: NotificationChannel.WEB_PUSH,
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

type EmailSendInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSendFn = (input: EmailSendInput) => Promise<void>;

export type RecheckNotificationInput = {
  userId: string;
  userEmail: string;
  eventName: string;
  locationName: string | null;
  expiresAt: Date;
  recheckLink: string;
  now: Date;
};

export type NotificationWarning = {
  code: string;
  message: string;
};

export type RecheckNotificationResult = {
  inAppCreated: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  warnings: NotificationWarning[];
};

type SendRecheckNotificationArgs = RecheckNotificationInput & {
  tx: Prisma.TransactionClient;
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
  sendEmail?: EmailSendFn;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRecheckNotificationContent({
  eventName,
  locationName,
  expiresAt,
  recheckLink,
}: Pick<
  RecheckNotificationInput,
  "eventName" | "locationName" | "expiresAt" | "recheckLink"
>) {
  const locationText = locationName ? ` at ${locationName}` : "";
  const expiresAtText = formatDateForMessage(expiresAt);
  const title = stripEmailHeaderControls(`Recheck required for ${eventName}`);
  const message = `Please confirm you are still at ${eventName}${locationText} before ${expiresAtText}.`;
  const text = `${message}\n\nOpen your recheck link: ${recheckLink}`;
  const html = `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(recheckLink)}">Open recheck</a></p>`;

  return {
    title,
    message,
    text,
    html,
  };
}

function extractEmailAddress(sender: string) {
  const bracketMatch = sender.match(/<([^<>]+)>/);

  return (bracketMatch?.[1] ?? sender).trim().toLowerCase();
}

function validateResendConfig({
  resendApiKey,
  resendFromEmail,
}: {
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
}): NotificationWarning | null {
  if (!resendApiKey?.trim() || !resendFromEmail?.trim()) {
    return {
      code: "EMAIL_NOT_CONFIGURED",
      message: "Resend email settings are missing; email was skipped.",
    };
  }

  const senderEmail = extractEmailAddress(resendFromEmail);

  if (senderEmail.endsWith(".vercel.app")) {
    return {
      code: "EMAIL_SENDER_DOMAIN_NOT_ALLOWED",
      message:
        "Resend sender must use a verified sending domain; .vercel.app senders are not allowed.",
    };
  }

  return null;
}

async function sendEmailWithResend({
  apiKey,
  email,
}: {
  apiKey: string;
  email: EmailSendInput;
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const result = await resend.emails.send(email);

  if (result.error) {
    throw new Error(result.error.message);
  }
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
  resendApiKey,
  resendFromEmail,
  sendEmail,
  ...input
}: SendRecheckNotificationArgs): Promise<RecheckNotificationResult> {
  const warnings: NotificationWarning[] = [];
  const content = buildRecheckNotificationContent(input);

  await createInAppNotification(tx, input);

  const configWarning = validateResendConfig({
    resendApiKey,
    resendFromEmail,
  });

  if (configWarning || !input.userEmail.trim()) {
    return {
      inAppCreated: true,
      emailSent: false,
      emailSkipped: true,
      warnings: [
        configWarning ?? {
          code: "EMPLOYEE_EMAIL_NOT_FOUND",
          message: "Employee email address was not found; email was skipped.",
        },
      ],
    };
  }

  try {
    const apiKey = resendApiKey?.trim() ?? "";
    const fromEmail = resendFromEmail?.trim() ?? "";
    const email = {
      from: fromEmail,
      to: input.userEmail,
      subject: content.title,
      text: content.text,
      html: content.html,
    };

    if (sendEmail) {
      await sendEmail(email);
    } else {
      await sendEmailWithResend({
        apiKey,
        email,
      });
    }

    return {
      inAppCreated: true,
      emailSent: true,
      emailSkipped: false,
      warnings,
    };
  } catch (error) {
    warnings.push({
      code: "EMAIL_SEND_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Resend email sending failed.",
    });

    return {
      inAppCreated: true,
      emailSent: false,
      emailSkipped: true,
      warnings,
    };
  }
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
