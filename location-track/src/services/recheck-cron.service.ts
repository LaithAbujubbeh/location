import { timingSafeEqual } from "crypto";

import { AssignmentStatus, RecheckStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import {
  generateRecheckToken,
  hashRecheckToken,
} from "./recheck.service.ts";
import { sendRecheckNotification } from "./notification.service.ts";
import { notifyEmployeeMissedRecheck } from "./notification.service.ts";

export type ProcessRechecksSummary = {
  activatedCount: number;
  missedCount: number;
  notifications: {
    inAppCreatedCount: number;
  };
};

export type CronAuthorizationInput = {
  authorizationHeader: string | null;
  querySecret: string | null;
  expectedSecret: string | null | undefined;
};

export type ProcessScheduledRechecksOptions = {
  now?: Date;
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

export async function processScheduledRechecks({
  now = new Date(),
}: ProcessScheduledRechecksOptions = {}): Promise<ProcessRechecksSummary> {
  const { prisma } = await import("../lib/prisma.ts");

  return prisma.$transaction((tx) =>
    processScheduledRechecksInTransaction(tx, {
      now,
    }),
  );
}

function emptySummary(): ProcessRechecksSummary {
  return {
    activatedCount: 0,
    missedCount: 0,
    notifications: {
      inAppCreatedCount: 0,
    },
  };
}

export async function processScheduledRechecksInTransaction(
  tx: Prisma.TransactionClient,
  {
    now,
  }: {
    now: Date;
  },
): Promise<ProcessRechecksSummary> {
  const summary = emptySummary();
  const rechecksToActivate = await tx.eventRecheck.findMany({
    where: {
      status: {
        in: [RecheckStatus.SCHEDULED, RecheckStatus.PENDING],
      },
      startsAt: {
        lte: now,
      },
      expiresAt: {
        gt: now,
      },
      submittedAt: null,
      tokenHash: null,
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
              id: true,
              locationName: true,
            },
          },
        },
      },
    },
  });

  for (const recheck of rechecksToActivate) {
    const rawToken = generateRecheckToken();
    const tokenHash = hashRecheckToken(rawToken);
    const updateResult = await tx.eventRecheck.updateMany({
      where: {
        id: recheck.id,
        status: {
          in: [RecheckStatus.SCHEDULED, RecheckStatus.PENDING],
        },
        startsAt: {
          lte: now,
        },
        expiresAt: {
          gt: now,
        },
        submittedAt: null,
        tokenHash: null,
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

    const notificationResult = await sendRecheckNotification({
      tx,
      userId: recheck.employeeId,
      eventId: recheck.assignment.event.id,
      eventName: recheck.assignment.event.title,
      locationName: recheck.assignment.event.locationName,
      expiresAt: recheck.expiresAt,
      now,
    });

    if (notificationResult.inAppCreated) {
      summary.notifications.inAppCreatedCount += 1;
    }
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
      employeeId: true,
      assignment: {
        select: {
          eventId: true,
        },
      },
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
      await notifyEmployeeMissedRecheck(tx, {
        userId: recheck.employeeId,
        eventId: recheck.assignment.eventId,
        now,
      });
      summary.notifications.inAppCreatedCount += 1;
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
