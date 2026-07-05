import { createHash, randomBytes, timingSafeEqual } from "crypto";

import {
  AssignmentStatus,
  DeviceStatus,
  Prisma,
  ProofStatus,
  ProofType,
  RecheckStatus,
  UserRole,
} from "@prisma/client";

import {
  calculateHaversineDistanceMeters,
  checkGpsTimestampFreshness,
  DEFAULT_ACCEPTED_GPS_ACCURACY_METERS,
  DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS,
} from "../lib/geo.ts";
import type { AuthenticatedSession } from "../lib/permissions.ts";
import type { RecheckSubmitPayloadInput } from "../lib/validators.ts";
import {
  checkTrustedUserDeviceForAction,
  DeviceServiceError,
  type DeviceTrustRejection,
  requireTrustedUserDeviceForAction,
} from "./device.service.ts";

const RECHECK_TOKEN_BYTES = 32;

const OPEN_RECHECK_STATUSES = new Set<RecheckStatus>([
  RecheckStatus.SCHEDULED,
  RecheckStatus.PENDING,
  RecheckStatus.ACTIVE,
]);

const FINAL_RECHECK_STATUSES = new Set<RecheckStatus>([
  RecheckStatus.COMPLETED,
  RecheckStatus.PASSED,
  RecheckStatus.SUSPICIOUS,
  RecheckStatus.FAILED,
]);

export class RecheckServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RecheckServiceError";
    this.status = status;
    this.code = code;
  }
}

export type RecheckScheduleInput = {
  assignmentId: string;
  employeeId: string;
  checkInAt: Date;
  recheckSlots: RecheckScheduleSlotInput[];
};

export type RecheckScheduleSlotInput = {
  id: string;
  startsAt: Date;
  expiresAt: Date;
};

export type ScheduledRecheckToken = {
  slotId: string;
  startsAt: Date;
  expiresAt: Date;
  status: RecheckStatus;
};

export type RecheckTokenState = {
  tokenHash: string | null;
  status: RecheckStatus;
  startsAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
};

export type RecheckSubmissionState = RecheckTokenState & {
  employeeId: string;
  assignment: {
    employeeId: string;
    status: AssignmentStatus;
  };
};

export type RecheckDecision = {
  proofStatus: ProofStatus;
  recheckStatus: RecheckStatus;
  assignmentStatus: AssignmentStatus | null;
  rejectionCode: string | null;
  notes: string | null;
};

export type RecheckTokenInfoResult = {
  event: {
    name: string;
    locationName: string | null;
    photoRequired: boolean;
  };
  recheck: {
    startsAt: string;
    expiresAt: string;
  };
};

export type SubmitRecheckProofResult = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    failureReason: string | null;
  };
  recheck: {
    id: string;
    status: RecheckStatus;
    startsAt: string;
    expiresAt: string;
    submittedAt: string;
  };
  proof: {
    id: string;
    type: ProofType;
    status: ProofStatus;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    distanceMeters: number;
    gpsTimestamp: string;
    deviceId: string;
    photoUrl: string | null;
    rejectionCode: string | null;
    notes: string | null;
    createdAt: string;
  };
  verification: {
    distanceMeters: number;
    radiusMeters: number;
    gpsAgeMs: number;
  };
};

type RecheckProofTransactionArgs = {
  employeeId: string;
  input: RecheckSubmitPayloadInput;
  now: Date;
  persistDeviceRejection?: boolean;
  token: string;
  userAgent?: string | null;
};

type EmployeeRecheckSlotProofTransactionArgs = {
  employeeId: string;
  eventId: string;
  input: RecheckSubmitPayloadInput;
  now: Date;
  persistDeviceRejection?: boolean;
  slotId: string;
  userAgent?: string | null;
};

const recheckSubmitSelect = {
  id: true,
  assignmentId: true,
  employeeId: true,
  tokenHash: true,
  status: true,
  startsAt: true,
  expiresAt: true,
  submittedAt: true,
  completedAt: true,
  assignment: {
    select: {
      id: true,
      employeeId: true,
      status: true,
      failureReason: true,
      event: {
        select: {
          title: true,
          locationName: true,
          latitude: true,
          longitude: true,
          radiusMeters: true,
          photoRequired: true,
        },
      },
    },
  },
} satisfies Prisma.EventRecheckSelect;

type SelectedRecheckForSubmit = Prisma.EventRecheckGetPayload<{
  select: typeof recheckSubmitSelect;
}>;

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

function assertEmployeeSession(session: AuthenticatedSession) {
  if (session.user.role !== UserRole.EMPLOYEE) {
    throw new RecheckServiceError(
      403,
      "FORBIDDEN",
      "Employee access is required.",
    );
  }

  return session.user.id;
}

function isRecheckAlreadySubmitted(recheck: RecheckTokenState) {
  return (
    Boolean(recheck.submittedAt) ||
    Boolean(recheck.completedAt) ||
    FINAL_RECHECK_STATUSES.has(recheck.status)
  );
}

export function validateRecheckTokenState({
  rawToken,
  recheck,
  now,
}: {
  rawToken: string;
  recheck: RecheckTokenState;
  now: Date;
}) {
  if (!recheck.tokenHash || !compareRecheckToken(rawToken, recheck.tokenHash)) {
    throw new RecheckServiceError(
      404,
      "INVALID_RECHECK_TOKEN",
      "Recheck token was not found.",
    );
  }

  validateRecheckOpenState({ recheck, now });
}

function validateRecheckOpenState({
  recheck,
  now,
}: {
  recheck: RecheckTokenState;
  now: Date;
}) {
  if (isRecheckAlreadySubmitted(recheck)) {
    throw new RecheckServiceError(
      409,
      "RECHECK_ALREADY_SUBMITTED",
      "This recheck token has already been submitted.",
    );
  }

  if (recheck.expiresAt <= now) {
    throw new RecheckServiceError(
      410,
      "RECHECK_EXPIRED",
      "This recheck token has expired.",
    );
  }

  if (recheck.startsAt > now || !OPEN_RECHECK_STATUSES.has(recheck.status)) {
    throw new RecheckServiceError(
      409,
      "RECHECK_NOT_ACTIVE",
      "This recheck is not active.",
    );
  }
}

function validateAuthenticatedRecheckSubmissionAccess({
  recheck,
  employeeId,
  deviceStatus,
  now,
}: {
  recheck: RecheckSubmissionState;
  employeeId: string;
  deviceStatus: DeviceStatus | null;
  now: Date;
}) {
  validateRecheckOpenState({ recheck, now });

  if (
    recheck.employeeId !== employeeId ||
    recheck.assignment.employeeId !== employeeId
  ) {
    throw new RecheckServiceError(
      403,
      "RECHECK_NOT_ASSIGNED",
      "This recheck does not belong to the current employee.",
    );
  }

  if (
    recheck.assignment.status !== AssignmentStatus.IN_PROGRESS &&
    recheck.assignment.status !== AssignmentStatus.SUSPICIOUS
  ) {
    throw new RecheckServiceError(
      409,
      "ASSIGNMENT_NOT_IN_PROGRESS",
      "This assignment is not eligible for recheck submission.",
    );
  }

  if (deviceStatus !== DeviceStatus.TRUSTED) {
    throw new RecheckServiceError(
      403,
      "DEVICE_NOT_TRUSTED",
      "This device is not trusted for recheck submission.",
    );
  }
}

export function validateRecheckSubmissionAccess({
  rawToken,
  recheck,
  employeeId,
  deviceStatus,
  now,
}: {
  rawToken: string;
  recheck: RecheckSubmissionState;
  employeeId: string;
  deviceStatus: DeviceStatus | null;
  now: Date;
}) {
  validateRecheckTokenState({ rawToken, recheck, now });
  validateAuthenticatedRecheckSubmissionAccess({
    recheck,
    employeeId,
    deviceStatus,
    now,
  });
}

export function decideRecheckProof({
  photoRequired,
  hasPhoto,
  gpsFreshness,
  accuracyMeters,
  distanceMeters,
  radiusMeters,
}: {
  photoRequired: boolean;
  hasPhoto: boolean;
  gpsFreshness: ReturnType<typeof checkGpsTimestampFreshness>;
  accuracyMeters: number;
  distanceMeters: number;
  radiusMeters: number;
}): RecheckDecision {
  if (photoRequired && !hasPhoto) {
    return {
      proofStatus: ProofStatus.REJECTED,
      recheckStatus: RecheckStatus.FAILED,
      assignmentStatus: AssignmentStatus.FAILED,
      rejectionCode: "PHOTO_REQUIRED",
      notes: "Photo proof is required for this recheck.",
    };
  }

  if (!gpsFreshness.fresh) {
    return {
      proofStatus: ProofStatus.REJECTED,
      recheckStatus: RecheckStatus.FAILED,
      assignmentStatus: AssignmentStatus.FAILED,
      rejectionCode: gpsFreshness.reason,
      notes: "GPS timestamp is outside the accepted freshness window.",
    };
  }

  if (accuracyMeters > DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS) {
    return {
      proofStatus: ProofStatus.REJECTED,
      recheckStatus: RecheckStatus.FAILED,
      assignmentStatus: AssignmentStatus.FAILED,
      rejectionCode: "GPS_ACCURACY_UNUSABLE",
      notes: "GPS accuracy is too poor to review.",
    };
  }

  if (
    distanceMeters <= radiusMeters &&
    accuracyMeters <= DEFAULT_ACCEPTED_GPS_ACCURACY_METERS
  ) {
    return {
      proofStatus: ProofStatus.ACCEPTED,
      recheckStatus: RecheckStatus.PASSED,
      assignmentStatus: null,
      rejectionCode: null,
      notes: null,
    };
  }

  if (distanceMeters <= radiusMeters + accuracyMeters) {
    return {
      proofStatus: ProofStatus.SUSPICIOUS,
      recheckStatus: RecheckStatus.SUSPICIOUS,
      assignmentStatus: AssignmentStatus.SUSPICIOUS,
      rejectionCode: null,
      notes: "Location is within the GPS uncertainty range or has low accuracy.",
    };
  }

  return {
    proofStatus: ProofStatus.REJECTED,
    recheckStatus: RecheckStatus.FAILED,
    assignmentStatus: AssignmentStatus.FAILED,
    rejectionCode: "OUTSIDE_RADIUS",
    notes: "Location is outside the allowed event radius.",
  };
}

export function buildScheduledRecheckTokensFromSlots(
  input: RecheckScheduleInput,
): ScheduledRecheckToken[] {
  return input.recheckSlots
    .filter((slot) => slot.expiresAt > input.checkInAt)
    .map((slot) => ({
      slotId: slot.id,
      startsAt: slot.startsAt,
      expiresAt: slot.expiresAt,
      status:
        slot.startsAt <= input.checkInAt
          ? RecheckStatus.PENDING
          : RecheckStatus.SCHEDULED,
    }));
}

export async function scheduleRechecksForAssignment(
  tx: Prisma.TransactionClient,
  input: RecheckScheduleInput,
) {
  if (input.recheckSlots.length === 0) {
    return [];
  }

  const scheduledTokens = buildScheduledRecheckTokensFromSlots(input);

  if (scheduledTokens.length === 0) {
    return [];
  }

  const existingRechecks = await tx.eventRecheck.findMany({
    where: {
      assignmentId: input.assignmentId,
      slotId: {
        in: scheduledTokens.map((scheduledToken) => scheduledToken.slotId),
      },
    },
    select: {
      slotId: true,
    },
  });
  const existingSlotIds = new Set(
    existingRechecks.flatMap((recheck) =>
      recheck.slotId ? [recheck.slotId] : [],
    ),
  );
  const missingScheduledTokens = scheduledTokens.filter(
    (scheduledToken) => !existingSlotIds.has(scheduledToken.slotId),
  );

  if (missingScheduledTokens.length === 0) {
    return [];
  }

  await tx.eventRecheck.createMany({
    data: missingScheduledTokens.map((scheduledToken) => ({
      assignmentId: input.assignmentId,
      slotId: scheduledToken.slotId,
      employeeId: input.employeeId,
      startsAt: scheduledToken.startsAt,
      expiresAt: scheduledToken.expiresAt,
      status: scheduledToken.status,
    })),
    skipDuplicates: true,
  });

  return missingScheduledTokens;
}

export async function getRecheckTokenInfo({
  token,
  now = new Date(),
}: {
  token: string;
  now?: Date;
}): Promise<RecheckTokenInfoResult> {
  const { prisma } = await import("../lib/prisma.ts");
  const tokenHash = hashRecheckToken(token);
  const recheck = await prisma.eventRecheck.findUnique({
    where: {
      tokenHash,
    },
    select: {
      tokenHash: true,
      status: true,
      startsAt: true,
      expiresAt: true,
      submittedAt: true,
      completedAt: true,
      assignment: {
        select: {
          event: {
            select: {
              title: true,
              locationName: true,
              photoRequired: true,
            },
          },
        },
      },
    },
  });

  if (!recheck) {
    throw new RecheckServiceError(
      404,
      "INVALID_RECHECK_TOKEN",
      "Recheck token was not found.",
    );
  }

  validateRecheckTokenState({ rawToken: token, recheck, now });

  return {
    event: {
      name: recheck.assignment.event.title,
      locationName: recheck.assignment.event.locationName,
      photoRequired: recheck.assignment.event.photoRequired,
    },
    recheck: {
      startsAt: recheck.startsAt.toISOString(),
      expiresAt: recheck.expiresAt.toISOString(),
    },
  };
}

export async function submitRecheckProof({
  token,
  session,
  input,
  userAgent,
  now = new Date(),
}: {
  token: string;
  session: AuthenticatedSession;
  input: RecheckSubmitPayloadInput;
  userAgent?: string | null;
  now?: Date;
}): Promise<SubmitRecheckProofResult> {
  const { prisma } = await import("../lib/prisma.ts");
  const employeeId = assertEmployeeSession(session);

  const result = await prisma.$transaction((tx) =>
    submitRecheckProofInTransaction(tx, {
      token,
      employeeId,
      input,
      persistDeviceRejection: true,
      userAgent,
      now,
    }),
  );

  if ("trusted" in result) {
    throw new RecheckServiceError(result.status, result.code, result.message);
  }

  return result;
}

export async function submitEmployeeRecheckSlotProof({
  eventId,
  slotId,
  session,
  input,
  userAgent,
  now = new Date(),
}: {
  eventId: string;
  slotId: string;
  session: AuthenticatedSession;
  input: RecheckSubmitPayloadInput;
  userAgent?: string | null;
  now?: Date;
}): Promise<SubmitRecheckProofResult> {
  const { prisma } = await import("../lib/prisma.ts");
  const employeeId = assertEmployeeSession(session);

  const result = await prisma.$transaction((tx) =>
    submitEmployeeRecheckSlotProofInTransaction(tx, {
      eventId,
      slotId,
      employeeId,
      input,
      persistDeviceRejection: true,
      userAgent,
      now,
    }),
  );

  if ("trusted" in result) {
    throw new RecheckServiceError(result.status, result.code, result.message);
  }

  return result;
}

export async function submitRecheckProofInTransaction(
  tx: Prisma.TransactionClient,
  args: RecheckProofTransactionArgs & { persistDeviceRejection: true },
): Promise<SubmitRecheckProofResult | DeviceTrustRejection>;

export async function submitRecheckProofInTransaction(
  tx: Prisma.TransactionClient,
  args: RecheckProofTransactionArgs,
): Promise<SubmitRecheckProofResult>;

export async function submitRecheckProofInTransaction(
  tx: Prisma.TransactionClient,
  {
    token,
    employeeId,
    input,
    persistDeviceRejection = false,
    userAgent,
    now,
  }: RecheckProofTransactionArgs,
): Promise<SubmitRecheckProofResult | DeviceTrustRejection> {
  const tokenHash = hashRecheckToken(token);
  const recheck = await tx.eventRecheck.findUnique({
    where: {
      tokenHash,
    },
    select: recheckSubmitSelect,
  });

  if (!recheck) {
    throw new RecheckServiceError(
      404,
      "INVALID_RECHECK_TOKEN",
      "Recheck token was not found.",
    );
  }

  return submitSelectedRecheckProofInTransaction(tx, {
    recheck,
    employeeId,
    input,
    persistDeviceRejection,
    userAgent,
    now,
    rawToken: token,
  });
}

export async function submitEmployeeRecheckSlotProofInTransaction(
  tx: Prisma.TransactionClient,
  args: EmployeeRecheckSlotProofTransactionArgs & {
    persistDeviceRejection: true;
  },
): Promise<SubmitRecheckProofResult | DeviceTrustRejection>;

export async function submitEmployeeRecheckSlotProofInTransaction(
  tx: Prisma.TransactionClient,
  args: EmployeeRecheckSlotProofTransactionArgs,
): Promise<SubmitRecheckProofResult>;

export async function submitEmployeeRecheckSlotProofInTransaction(
  tx: Prisma.TransactionClient,
  {
    eventId,
    slotId,
    employeeId,
    input,
    persistDeviceRejection = false,
    userAgent,
    now,
  }: EmployeeRecheckSlotProofTransactionArgs,
): Promise<SubmitRecheckProofResult | DeviceTrustRejection> {
  const recheck = await tx.eventRecheck.findFirst({
    where: {
      employeeId,
      slotId,
      assignment: {
        employeeId,
        eventId,
      },
    },
    select: recheckSubmitSelect,
  });

  if (!recheck) {
    throw new RecheckServiceError(
      404,
      "RECHECK_NOT_FOUND",
      "Recheck was not found for this employee event.",
    );
  }

  return submitSelectedRecheckProofInTransaction(tx, {
    recheck,
    employeeId,
    input,
    persistDeviceRejection,
    userAgent,
    now,
  });
}

async function submitSelectedRecheckProofInTransaction(
  tx: Prisma.TransactionClient,
  {
    recheck,
    employeeId,
    input,
    persistDeviceRejection,
    userAgent,
    now,
    rawToken,
  }: {
    recheck: SelectedRecheckForSubmit;
    employeeId: string;
    input: RecheckSubmitPayloadInput;
    persistDeviceRejection?: boolean;
    userAgent?: string | null;
    now: Date;
    rawToken?: string;
  },
): Promise<SubmitRecheckProofResult | DeviceTrustRejection> {
  if (rawToken) {
    validateRecheckSubmissionAccess({
      rawToken,
      recheck,
      employeeId,
      deviceStatus: DeviceStatus.TRUSTED,
      now,
    });
  } else {
    validateAuthenticatedRecheckSubmissionAccess({
      recheck,
      employeeId,
      deviceStatus: DeviceStatus.TRUSTED,
      now,
    });
  }

  if (persistDeviceRejection) {
    const deviceResult = await checkTrustedUserDeviceForAction(tx, {
      userId: employeeId,
      deviceId: input.deviceId,
      userAgent,
      now,
    });

    if (!deviceResult.trusted) {
      return deviceResult;
    }
  } else {
    try {
      await requireTrustedUserDeviceForAction(tx, {
        userId: employeeId,
        deviceId: input.deviceId,
        userAgent,
        now,
      });
    } catch (error) {
      if (error instanceof DeviceServiceError) {
        throw new RecheckServiceError(error.status, error.code, error.message);
      }

      throw error;
    }
  }

  const eventPoint = {
    latitude: recheck.assignment.event.latitude.toNumber(),
    longitude: recheck.assignment.event.longitude.toNumber(),
  };
  const submittedPoint = {
    latitude: input.latitude,
    longitude: input.longitude,
  };
  const distanceMeters = calculateHaversineDistanceMeters(
    eventPoint,
    submittedPoint,
  );
  const gpsFreshness = checkGpsTimestampFreshness({
    gpsTimestamp: input.gpsTimestamp,
    now,
  });
  const decision = decideRecheckProof({
    photoRequired: recheck.assignment.event.photoRequired,
    hasPhoto: Boolean(input.photoUrl),
    gpsFreshness,
    accuracyMeters: input.accuracyMeters,
    distanceMeters,
    radiusMeters: recheck.assignment.event.radiusMeters,
  });

  const proof = await tx.eventProof.create({
    data: {
      assignmentId: recheck.assignmentId,
      recheckId: recheck.id,
      type: ProofType.RECHECK,
      status: decision.proofStatus,
      latitude: new Prisma.Decimal(input.latitude),
      longitude: new Prisma.Decimal(input.longitude),
      accuracyMeters: input.accuracyMeters,
      distanceMeters,
      gpsTimestamp: input.gpsTimestamp,
      deviceId: input.deviceId,
      photoUrl: input.photoUrl,
      rejectionCode: decision.rejectionCode,
      notes: decision.notes,
    },
    select: {
      id: true,
      type: true,
      status: true,
      latitude: true,
      longitude: true,
      accuracyMeters: true,
      distanceMeters: true,
      gpsTimestamp: true,
      deviceId: true,
      photoUrl: true,
      rejectionCode: true,
      notes: true,
      createdAt: true,
    },
  });

  const recheckUpdate = await tx.eventRecheck.updateMany({
    where: {
      id: recheck.id,
      submittedAt: null,
      status: {
        in: [
          RecheckStatus.SCHEDULED,
          RecheckStatus.PENDING,
          RecheckStatus.ACTIVE,
        ],
      },
    },
    data: {
      status: decision.recheckStatus,
      submittedAt: now,
      completedAt: now,
    },
  });

  if (recheckUpdate.count !== 1) {
    throw new RecheckServiceError(
      409,
      "RECHECK_ALREADY_SUBMITTED",
      "This recheck token has already been submitted.",
    );
  }

  if (decision.assignmentStatus === AssignmentStatus.SUSPICIOUS) {
    await tx.eventAssignment.updateMany({
      where: {
        id: recheck.assignmentId,
        status: {
          in: [AssignmentStatus.IN_PROGRESS, AssignmentStatus.SUSPICIOUS],
        },
      },
      data: {
        status: AssignmentStatus.SUSPICIOUS,
        failureReason: null,
      },
    });
  }

  if (decision.assignmentStatus === AssignmentStatus.FAILED) {
    await tx.eventAssignment.updateMany({
      where: {
        id: recheck.assignmentId,
        status: {
          in: [AssignmentStatus.IN_PROGRESS, AssignmentStatus.SUSPICIOUS],
        },
      },
      data: {
        status: AssignmentStatus.FAILED,
        failureReason: decision.rejectionCode,
      },
    });
  }

  const updatedAssignment = await tx.eventAssignment.findUniqueOrThrow({
    where: {
      id: recheck.assignmentId,
    },
    select: {
      id: true,
      status: true,
      failureReason: true,
    },
  });

  return {
    assignment: {
      id: updatedAssignment.id,
      status: updatedAssignment.status,
      failureReason: updatedAssignment.failureReason,
    },
    recheck: {
      id: recheck.id,
      status: decision.recheckStatus,
      startsAt: recheck.startsAt.toISOString(),
      expiresAt: recheck.expiresAt.toISOString(),
      submittedAt: now.toISOString(),
    },
    proof: {
      id: proof.id,
      type: proof.type,
      status: proof.status,
      latitude: proof.latitude.toNumber(),
      longitude: proof.longitude.toNumber(),
      accuracyMeters: proof.accuracyMeters,
      distanceMeters: proof.distanceMeters,
      gpsTimestamp: proof.gpsTimestamp.toISOString(),
      deviceId: proof.deviceId,
      photoUrl: proof.photoUrl,
      rejectionCode: proof.rejectionCode,
      notes: proof.notes,
      createdAt: proof.createdAt.toISOString(),
    },
    verification: {
      distanceMeters,
      radiusMeters: recheck.assignment.event.radiusMeters,
      gpsAgeMs: gpsFreshness.ageMs,
    },
  };
}
