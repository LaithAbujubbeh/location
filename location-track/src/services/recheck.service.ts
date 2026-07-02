import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

import { RecheckStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const RECHECK_TOKEN_BYTES = 32;
const MINUTE_IN_MS = 60_000;

type RandomInt = (maxExclusive: number) => number;

export type GenerateRandomRecheckTimesArgs = {
  recheckCount: number;
  recheckWindowMinutes: number | null;
  eventStartsAt: Date;
  eventEndsAt: Date;
  checkInAt: Date;
  randomInt?: RandomInt;
};

export type RecheckScheduleInput = {
  assignmentId: string;
  employeeId: string;
  eventStartsAt: Date;
  eventEndsAt: Date;
  checkInAt: Date;
  recheckCount: number;
  recheckWindowMinutes: number | null;
};

export type ScheduledRecheckToken = {
  rawToken: string;
  tokenHash: string;
  startsAt: Date;
  expiresAt: Date;
};

export function generateRecheckToken() {
  return randomBytes(RECHECK_TOKEN_BYTES).toString("base64url");
}

export function hashRecheckToken(rawToken: string) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function compareRecheckToken(rawToken: string, tokenHash: string) {
  const rawHash = Buffer.from(hashRecheckToken(rawToken), "hex");
  const storedHash = Buffer.from(tokenHash, "hex");

  if (rawHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(rawHash, storedHash);
}

export function calculateRecheckExpiry({
  startsAt,
  eventEndsAt,
  recheckWindowMinutes,
}: {
  startsAt: Date;
  eventEndsAt: Date;
  recheckWindowMinutes: number;
}) {
  const expiresAtMs = startsAt.getTime() + recheckWindowMinutes * MINUTE_IN_MS;

  return new Date(Math.min(expiresAtMs, eventEndsAt.getTime()));
}

export function generateRandomRecheckTimes({
  recheckCount,
  recheckWindowMinutes,
  eventStartsAt,
  eventEndsAt,
  checkInAt,
  randomInt: getRandomInt = randomInt,
}: GenerateRandomRecheckTimesArgs) {
  if (recheckCount <= 0 || !recheckWindowMinutes) {
    return [];
  }

  const windowMs = recheckWindowMinutes * MINUTE_IN_MS;
  const earliestStartMs = Math.max(
    eventStartsAt.getTime(),
    checkInAt.getTime(),
  );
  const latestStartMs = eventEndsAt.getTime() - windowMs;

  if (latestStartMs < earliestStartMs) {
    return [];
  }

  const availableSlots = latestStartMs - earliestStartMs + 1;
  const count = Math.min(recheckCount, availableSlots);

  return Array.from({ length: count }, (_, index) => {
    const bucketStart =
      earliestStartMs + Math.floor((index * availableSlots) / count);
    const bucketEndExclusive =
      earliestStartMs + Math.floor(((index + 1) * availableSlots) / count);
    const bucketSize = Math.max(1, bucketEndExclusive - bucketStart);

    return new Date(bucketStart + getRandomInt(bucketSize));
  }).sort((left, right) => left.getTime() - right.getTime());
}

export function buildScheduledRecheckTokens(
  input: RecheckScheduleInput,
): ScheduledRecheckToken[] {
  const recheckWindowMinutes = input.recheckWindowMinutes;

  if (!recheckWindowMinutes) {
    return [];
  }

  return generateRandomRecheckTimes({
    recheckCount: input.recheckCount,
    recheckWindowMinutes,
    eventStartsAt: input.eventStartsAt,
    eventEndsAt: input.eventEndsAt,
    checkInAt: input.checkInAt,
  }).map((startsAt) => {
    const rawToken = generateRecheckToken();

    return {
      rawToken,
      tokenHash: hashRecheckToken(rawToken),
      startsAt,
      expiresAt: calculateRecheckExpiry({
        startsAt,
        eventEndsAt: input.eventEndsAt,
        recheckWindowMinutes,
      }),
    };
  });
}

export async function scheduleRechecksForAssignment(
  tx: Prisma.TransactionClient,
  input: RecheckScheduleInput,
) {
  if (input.recheckCount <= 0) {
    return [];
  }

  const existingRechecks = await tx.eventRecheck.count({
    where: {
      assignmentId: input.assignmentId,
    },
  });

  if (existingRechecks > 0) {
    return [];
  }

  const scheduledTokens = buildScheduledRecheckTokens(input);

  for (const scheduledToken of scheduledTokens) {
    await tx.eventRecheck.create({
      data: {
        assignmentId: input.assignmentId,
        employeeId: input.employeeId,
        tokenHash: scheduledToken.tokenHash,
        startsAt: scheduledToken.startsAt,
        expiresAt: scheduledToken.expiresAt,
        status: RecheckStatus.SCHEDULED,
      },
      select: {
        id: true,
      },
    });
  }

  return scheduledTokens;
}
