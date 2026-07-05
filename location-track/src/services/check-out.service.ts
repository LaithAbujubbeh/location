import {
  AssignmentStatus,
  DeviceStatus,
  EventStatus,
  Prisma,
  ProofStatus,
  ProofType,
  UserRole,
} from "@prisma/client";

import {
  calculateHaversineDistanceMeters,
  checkGpsTimestampFreshness,
  DEFAULT_ACCEPTED_GPS_ACCURACY_METERS,
  DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS,
} from "../lib/geo.ts";
import type { AuthenticatedSession } from "../lib/permissions.ts";
import type { CheckOutPayloadInput } from "../lib/validators.ts";
import {
  checkTrustedUserDeviceForAction,
  DeviceServiceError,
  type DeviceTrustRejection,
  requireTrustedUserDeviceForAction,
} from "./device.service.ts";

export class CheckOutServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CheckOutServiceError";
    this.status = status;
    this.code = code;
  }
}

type CheckOutDecision = {
  proofStatus: ProofStatus;
  assignmentStatus: AssignmentStatus;
  rejectionCode: string | null;
  notes: string | null;
};

type CheckOutAssignmentState = {
  status: AssignmentStatus;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  event: {
    status: EventStatus;
    startsAt: Date;
    endsAt: Date;
    checkoutRequired: boolean;
  };
};

type CheckOutTransactionArgs = {
  eventId: string;
  employeeId: string;
  input: CheckOutPayloadInput;
  now: Date;
  persistDeviceRejection?: boolean;
  userAgent?: string | null;
};

function assertEmployeeSession(session: AuthenticatedSession) {
  if (session.user.role !== UserRole.EMPLOYEE) {
    throw new CheckOutServiceError(
      403,
      "FORBIDDEN",
      "Employee access is required.",
    );
  }

  return session.user.id;
}

export type CheckOutResult = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    checkedInAt: string | null;
    checkedOutAt: string;
    completedAt: string | null;
    failureReason: string | null;
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

function isEventOpenForCheckOut({
  status,
  startsAt,
  endsAt,
  now,
}: {
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
  now: Date;
}) {
  return (
    (status === EventStatus.SCHEDULED || status === EventStatus.ACTIVE) &&
    startsAt <= now &&
    endsAt >= now
  );
}

export function validateCheckOutAccess({
  assignment,
  deviceStatus,
  now,
}: {
  assignment: CheckOutAssignmentState;
  deviceStatus: DeviceStatus | null;
  now: Date;
}) {
  if (!assignment.event.checkoutRequired) {
    throw new CheckOutServiceError(
      409,
      "CHECKOUT_NOT_ALLOWED",
      "Checkout is not required for this event.",
    );
  }

  if (!assignment.checkedInAt) {
    throw new CheckOutServiceError(
      409,
      "CHECK_IN_REQUIRED",
      "This assignment must be checked in before checkout.",
    );
  }

  if (assignment.checkedOutAt) {
    throw new CheckOutServiceError(
      409,
      "ALREADY_CHECKED_OUT",
      "This assignment has already been checked out.",
    );
  }

  if (
    assignment.status !== AssignmentStatus.IN_PROGRESS &&
    assignment.status !== AssignmentStatus.SUSPICIOUS
  ) {
    throw new CheckOutServiceError(
      409,
      "ASSIGNMENT_NOT_IN_PROGRESS",
      "This assignment is not eligible for checkout.",
    );
  }

  if (
    !isEventOpenForCheckOut({
      status: assignment.event.status,
      startsAt: assignment.event.startsAt,
      endsAt: assignment.event.endsAt,
      now,
    })
  ) {
    throw new CheckOutServiceError(
      409,
      "EVENT_NOT_OPEN_FOR_CHECK_OUT",
      "Event is not currently open for checkout.",
    );
  }

  if (deviceStatus !== DeviceStatus.TRUSTED) {
    throw new CheckOutServiceError(
      403,
      "DEVICE_NOT_TRUSTED",
      "This device is not trusted for checkout.",
    );
  }
}

export function decideCheckOutProof({
  gpsFreshness,
  accuracyMeters,
  distanceMeters,
  radiusMeters,
}: {
  gpsFreshness: ReturnType<typeof checkGpsTimestampFreshness>;
  accuracyMeters: number;
  distanceMeters: number;
  radiusMeters: number;
}): CheckOutDecision {
  if (!gpsFreshness.fresh) {
    return {
      proofStatus: ProofStatus.REJECTED,
      assignmentStatus: AssignmentStatus.FAILED,
      rejectionCode: gpsFreshness.reason,
      notes: "GPS timestamp is outside the accepted freshness window.",
    };
  }

  if (accuracyMeters > DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS) {
    return {
      proofStatus: ProofStatus.REJECTED,
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
      assignmentStatus: AssignmentStatus.COMPLETED,
      rejectionCode: null,
      notes: null,
    };
  }

  if (distanceMeters <= radiusMeters + accuracyMeters) {
    return {
      proofStatus: ProofStatus.SUSPICIOUS,
      assignmentStatus: AssignmentStatus.SUSPICIOUS,
      rejectionCode: null,
      notes: "Location is within the GPS uncertainty range or has low accuracy.",
    };
  }

  return {
    proofStatus: ProofStatus.REJECTED,
    assignmentStatus: AssignmentStatus.FAILED,
    rejectionCode: "OUTSIDE_RADIUS",
    notes: "Location is outside the allowed event radius.",
  };
}

export async function checkOutFromEvent({
  eventId,
  session,
  input,
  userAgent,
  now = new Date(),
}: {
  eventId: string;
  session: AuthenticatedSession;
  input: CheckOutPayloadInput;
  userAgent?: string | null;
  now?: Date;
}): Promise<CheckOutResult> {
  const { prisma } = await import("../lib/prisma.ts");
  const employeeId = assertEmployeeSession(session);

  const result = await prisma.$transaction((tx) =>
    checkOutFromEventInTransaction(tx, {
      eventId,
      employeeId,
      input,
      persistDeviceRejection: true,
      userAgent,
      now,
    }),
  );

  if ("trusted" in result) {
    throw new CheckOutServiceError(result.status, result.code, result.message);
  }

  return result;
}

export async function checkOutFromEventInTransaction(
  tx: Prisma.TransactionClient,
  args: CheckOutTransactionArgs & { persistDeviceRejection: true },
): Promise<CheckOutResult | DeviceTrustRejection>;

export async function checkOutFromEventInTransaction(
  tx: Prisma.TransactionClient,
  args: CheckOutTransactionArgs,
): Promise<CheckOutResult>;

export async function checkOutFromEventInTransaction(
  tx: Prisma.TransactionClient,
  {
    eventId,
    employeeId,
    input,
    persistDeviceRejection = false,
    userAgent,
    now,
  }: CheckOutTransactionArgs,
): Promise<CheckOutResult | DeviceTrustRejection> {
  const assignment = await tx.eventAssignment.findUnique({
    where: {
      eventId_employeeId: {
        eventId,
        employeeId,
      },
    },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      checkedOutAt: true,
      completedAt: true,
      failureReason: true,
      event: {
        select: {
          id: true,
          status: true,
          latitude: true,
          longitude: true,
          radiusMeters: true,
          startsAt: true,
          endsAt: true,
          checkoutRequired: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new CheckOutServiceError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Assigned event was not found.",
    );
  }

  validateCheckOutAccess({
    assignment,
    deviceStatus: DeviceStatus.TRUSTED,
    now,
  });

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
        throw new CheckOutServiceError(error.status, error.code, error.message);
      }

      throw error;
    }
  }

  const eventPoint = {
    latitude: assignment.event.latitude.toNumber(),
    longitude: assignment.event.longitude.toNumber(),
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
  const decision = decideCheckOutProof({
    gpsFreshness,
    accuracyMeters: input.accuracyMeters,
    distanceMeters,
    radiusMeters: assignment.event.radiusMeters,
  });

  const proof = await tx.eventProof.create({
    data: {
      assignmentId: assignment.id,
      type: ProofType.CHECK_OUT,
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

  const assignmentUpdate = await tx.eventAssignment.updateMany({
    where: {
      id: assignment.id,
      checkedOutAt: null,
      status: {
        in: [AssignmentStatus.IN_PROGRESS, AssignmentStatus.SUSPICIOUS],
      },
    },
    data: {
      status: decision.assignmentStatus,
      checkedOutAt: now,
      completedAt: now,
      failureReason: decision.rejectionCode,
    },
  });

  if (assignmentUpdate.count !== 1) {
    throw new CheckOutServiceError(
      409,
      "ALREADY_CHECKED_OUT",
      "This assignment has already been checked out.",
    );
  }

  const updatedAssignment = {
    id: assignment.id,
    status: decision.assignmentStatus,
    checkedInAt: assignment.checkedInAt,
    checkedOutAt: now,
    completedAt: now,
    failureReason: decision.rejectionCode,
  };

  return {
    assignment: {
      id: updatedAssignment.id,
      status: updatedAssignment.status,
      checkedInAt: updatedAssignment.checkedInAt?.toISOString() ?? null,
      checkedOutAt: updatedAssignment.checkedOutAt.toISOString(),
      completedAt: updatedAssignment.completedAt?.toISOString() ?? null,
      failureReason: updatedAssignment.failureReason,
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
      radiusMeters: assignment.event.radiusMeters,
      gpsAgeMs: gpsFreshness.ageMs,
    },
  };
}
