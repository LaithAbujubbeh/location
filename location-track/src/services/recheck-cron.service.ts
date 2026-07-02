import { timingSafeEqual } from "crypto";

import { AssignmentStatus, RecheckStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type ProcessRechecksSummary = {
  activatedCount: number;
  missedCount: number;
};

export type CronAuthorizationInput = {
  authorizationHeader: string | null;
  querySecret: string | null;
  expectedSecret: string | null | undefined;
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
}: {
  now?: Date;
} = {}): Promise<ProcessRechecksSummary> {
  const { prisma } = await import("../lib/prisma.ts");

  return prisma.$transaction((tx) =>
    processScheduledRechecksInTransaction(tx, { now }),
  );
}

export async function processScheduledRechecksInTransaction(
  tx: Prisma.TransactionClient,
  {
    now,
  }: {
    now: Date;
  },
): Promise<ProcessRechecksSummary> {
  const activated = await tx.eventRecheck.updateMany({
    where: {
      status: RecheckStatus.SCHEDULED,
      startsAt: {
        lte: now,
      },
      expiresAt: {
        gt: now,
      },
      submittedAt: null,
    },
    data: {
      status: RecheckStatus.PENDING,
    },
  });

  const missed = await tx.eventRecheck.updateMany({
    where: {
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

  if (missed.count > 0) {
    const missedRechecks = await tx.eventRecheck.findMany({
      where: {
        status: RecheckStatus.MISSED,
        expiresAt: {
          lte: now,
        },
        submittedAt: null,
      },
      select: {
        assignmentId: true,
      },
    });
    const missedAssignmentIds = [
      ...new Set(missedRechecks.map((recheck) => recheck.assignmentId)),
    ];

    if (missedAssignmentIds.length > 0) {
      await tx.eventAssignment.updateMany({
        where: {
          id: {
            in: missedAssignmentIds,
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
            in: missedAssignmentIds,
          },
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.MISSED,
          failureReason: "RECHECK_MISSED",
        },
      });
    }
  }

  return {
    activatedCount: activated.count,
    missedCount: missed.count,
  };
}
