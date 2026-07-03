import { timingSafeEqual } from "crypto";

import { AssignmentStatus, RecheckStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import {
  generateRecheckToken,
  hashRecheckToken,
} from "./recheck.service.ts";
import {
  sendRecheckNotification,
  type EmailSendFn,
  type NotificationWarning,
} from "./notification.service.ts";

export type ProcessRechecksSummary = {
  activatedCount: number;
  missedCount: number;
  notifications: {
    inAppCreatedCount: number;
    emailSentCount: number;
    emailSkippedCount: number;
    warnings: NotificationWarning[];
  };
};

export type CronAuthorizationInput = {
  authorizationHeader: string | null;
  querySecret: string | null;
  expectedSecret: string | null | undefined;
};

export type ProcessScheduledRechecksOptions = {
  now?: Date;
  appUrl?: string | null;
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
  sendEmail?: EmailSendFn;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseAuthorizationSecret(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, value] = authorizationHeader.trim().split(/\s+/, 2);

  if (!scheme || !value) {
    return authorizationHeader.trim();
  }

  return scheme.toLowerCase() === "bearer" ? value : null;
}

export function isCronRequestAuthorized({
  authorizationHeader,
  querySecret,
  expectedSecret,
}: CronAuthorizationInput) {
  if (!expectedSecret) {
    return false;
  }

  const providedSecret =
    parseAuthorizationSecret(authorizationHeader) ?? querySecret;

  if (!providedSecret) {
    return false;
  }

  return safeEqual(providedSecret, expectedSecret);
}

export function normalizeAppUrl(appUrl: string | null | undefined) {
  const fallbackUrl = "http://localhost:3000";
  const configuredUrl = appUrl?.trim() || fallbackUrl;

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fallbackUrl;
    }

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

    return `${url.origin}${path}`;
  } catch {
    return fallbackUrl;
  }
}

export async function processScheduledRechecks({
  now = new Date(),
  appUrl = process.env.APP_URL,
  resendApiKey = process.env.RESEND_API_KEY,
  resendFromEmail = process.env.RESEND_FROM_EMAIL,
  sendEmail,
}: ProcessScheduledRechecksOptions = {}): Promise<ProcessRechecksSummary> {
  const { prisma } = await import("../lib/prisma.ts");

  return prisma.$transaction((tx) =>
    processScheduledRechecksInTransaction(tx, {
      now,
      appUrl,
      resendApiKey,
      resendFromEmail,
      sendEmail,
    }),
  );
}

function buildRecheckLink({
  appUrl,
  rawToken,
}: {
  appUrl: string | null | undefined;
  rawToken: string;
}) {
  return `${normalizeAppUrl(appUrl)}/recheck/${encodeURIComponent(rawToken)}`;
}

function emptySummary(): ProcessRechecksSummary {
  return {
    activatedCount: 0,
    missedCount: 0,
    notifications: {
      inAppCreatedCount: 0,
      emailSentCount: 0,
      emailSkippedCount: 0,
      warnings: [],
    },
  };
}

export async function processScheduledRechecksInTransaction(
  tx: Prisma.TransactionClient,
  {
    now,
    appUrl,
    resendApiKey,
    resendFromEmail,
    sendEmail,
  }: {
    now: Date;
    appUrl?: string | null;
    resendApiKey?: string | null;
    resendFromEmail?: string | null;
    sendEmail?: EmailSendFn;
  },
): Promise<ProcessRechecksSummary> {
  const summary = emptySummary();
  const rechecksToActivate = await tx.eventRecheck.findMany({
    where: {
      status: RecheckStatus.SCHEDULED,
      startsAt: {
        lte: now,
      },
      expiresAt: {
        gt: now,
      },
      submittedAt: null,
      notificationSentAt: null,
    },
    orderBy: [
      {
        startsAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    select: {
      id: true,
      employeeId: true,
      expiresAt: true,
      assignment: {
        select: {
          event: {
            select: {
              title: true,
              locationName: true,
            },
          },
        },
      },
    },
  });

  const employeeIds = [
    ...new Set(rechecksToActivate.map((recheck) => recheck.employeeId)),
  ];
  const employees =
    employeeIds.length > 0
      ? await tx.user.findMany({
          where: {
            id: {
              in: employeeIds,
            },
          },
          select: {
            id: true,
            email: true,
          },
        })
      : [];
  const employeeEmailById = new Map(
    employees.map((employee) => [employee.id, employee.email]),
  );

  for (const recheck of rechecksToActivate) {
    const rawToken = generateRecheckToken();
    const tokenHash = hashRecheckToken(rawToken);
    const updateResult = await tx.eventRecheck.updateMany({
      where: {
        id: recheck.id,
        status: RecheckStatus.SCHEDULED,
        startsAt: {
          lte: now,
        },
        expiresAt: {
          gt: now,
        },
        submittedAt: null,
        notificationSentAt: null,
      },
      data: {
        status: RecheckStatus.PENDING,
        tokenHash,
        notificationSentAt: now,
      },
    });

    if (updateResult.count !== 1) {
      continue;
    }

    summary.activatedCount += 1;

    const userEmail = employeeEmailById.get(recheck.employeeId);

    const notificationResult = await sendRecheckNotification({
      tx,
      userId: recheck.employeeId,
      userEmail: userEmail ?? "",
      eventName: recheck.assignment.event.title,
      locationName: recheck.assignment.event.locationName,
      expiresAt: recheck.expiresAt,
      recheckLink: buildRecheckLink({ appUrl, rawToken }),
      now,
      resendApiKey,
      resendFromEmail,
      sendEmail,
    });

    if (notificationResult.inAppCreated) {
      summary.notifications.inAppCreatedCount += 1;
    }

    if (notificationResult.emailSent) {
      summary.notifications.emailSentCount += 1;
    }

    if (notificationResult.emailSkipped) {
      summary.notifications.emailSkippedCount += 1;
    }

    summary.notifications.warnings.push(...notificationResult.warnings);
  }

  const expiredRechecks = await tx.eventRecheck.findMany({
    where: {
      status: {
        in: [RecheckStatus.SCHEDULED, RecheckStatus.PENDING],
      },
      expiresAt: {
        lte: now,
      },
      submittedAt: null,
    },
    orderBy: [
      {
        expiresAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    select: {
      id: true,
      assignmentId: true,
    },
  });
  const missedAssignmentIds: string[] = [];

  for (const recheck of expiredRechecks) {
    const updateResult = await tx.eventRecheck.updateMany({
      where: {
        id: recheck.id,
        status: {
          in: [RecheckStatus.SCHEDULED, RecheckStatus.PENDING],
        },
        expiresAt: {
          lte: now,
        },
        submittedAt: null,
      },
      data: {
        status: RecheckStatus.MISSED,
        completedAt: now,
      },
    });

    if (updateResult.count === 1) {
      summary.missedCount += 1;
      missedAssignmentIds.push(recheck.assignmentId);
    }
  }

  if (missedAssignmentIds.length > 0) {
    const uniqueMissedAssignmentIds = [...new Set(missedAssignmentIds)];

      await tx.eventAssignment.updateMany({
        where: {
          id: {
            in: uniqueMissedAssignmentIds,
          },
          status: AssignmentStatus.IN_PROGRESS,
        },
        data: {
          status: AssignmentStatus.SUSPICIOUS,
          failureReason: "RECHECK_MISSED",
        },
      });

      await tx.eventAssignment.updateMany({
        where: {
          id: {
            in: uniqueMissedAssignmentIds,
          },
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.MISSED,
          failureReason: "RECHECK_MISSED",
        },
      });
  }

  return summary;
}
