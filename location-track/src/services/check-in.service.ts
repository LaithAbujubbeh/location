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
import { prisma } from "../lib/prisma.ts";
import type { AuthenticatedSession } from "../lib/permissions.ts";
import type { CheckInPayloadInput } from "../lib/validators.ts";
import { scheduleRechecksForAssignment } from "./recheck.service.ts";

export class CheckInServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CheckInServiceError";
    this.status = status;
    this.code = code;
  }
}

type CheckInToEventArgs = {
  eventId: string;
  session: AuthenticatedSession;
  input: CheckInPayloadInput;
  now?: Date;
};

type CheckInDecision = {
  proofStatus: ProofStatus;
  assignmentStatus: AssignmentStatus | null;
  rejectionCode: string | null;
  notes: string | null;
};

type CheckInAssignmentResponseState = {
  id: string;
  status: AssignmentStatus;
  checkedInAt: Date | null;
  failureReason: string | null;
};

export type CheckInResult = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    checkedInAt: string | null;
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

function assertEmployeeSession(session: AuthenticatedSession) {
  if (session.user.role !== UserRole.EMPLOYEE) {
    throw new CheckInServiceError(
      403,
      "FORBIDDEN",
      "Employee access is required.",
    );
  }

  return session.user.id;
}

function isEventOpenForCheckIn({
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

function decideCheckIn({
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
}): CheckInDecision {
  if (photoRequired && !hasPhoto) {
    return {
      proofStatus: ProofStatus.REJECTED,
      assignmentStatus: null,
      rejectionCode: "PHOTO_REQUIRED",
      notes: "Photo proof is required for this event.",
    };
  }

  if (!gpsFreshness.fresh) {
    return {
      proofStatus: ProofStatus.REJECTED,
      assignmentStatus: null,
      rejectionCode: gpsFreshness.reason,
      notes: "GPS timestamp is outside the accepted freshness window.",
    };
  }

  if (accuracyMeters > DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS) {
    return {
      proofStatus: ProofStatus.REJECTED,
      assignmentStatus: null,
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
      assignmentStatus: AssignmentStatus.IN_PROGRESS,
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
    assignmentStatus: null,
    rejectionCode: "OUTSIDE_RADIUS",
    notes: "Location is outside the allowed event radius.",
  };
}

export async function checkInToEvent({
  eventId,
  session,
  input,
  now = new Date(),
}: CheckInToEventArgs): Promise<CheckInResult> {
  const employeeId = assertEmployeeSession(session);

  return prisma.$transaction((tx) =>
    checkInToEventInTransaction(tx, {
      eventId,
      employeeId,
      input,
      now,
    }),
  );
}

export async function checkInToEventInTransaction(
  tx: Prisma.TransactionClient,
  {
    eventId,
    employeeId,
    input,
    now,
  }: {
    eventId: string;
    employeeId: string;
    input: CheckInPayloadInput;
    now: Date;
  },
): Promise<CheckInResult> {
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
          photoRequired: true,
          rechecksEnabled: true,
          recheckCount: true,
          recheckWindowMinutes: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new CheckInServiceError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Assigned event was not found.",
    );
  }

  if (assignment.checkedInAt || assignment.status !== AssignmentStatus.PENDING) {
    throw new CheckInServiceError(
      409,
      "ALREADY_CHECKED_IN",
      "This assignment is not eligible for check-in.",
    );
  }

  if (
    !isEventOpenForCheckIn({
      status: assignment.event.status,
      startsAt: assignment.event.startsAt,
      endsAt: assignment.event.endsAt,
      now,
    })
  ) {
    throw new CheckInServiceError(
      409,
      "EVENT_NOT_OPEN_FOR_CHECK_IN",
      "Event is not currently open for check-in.",
    );
  }

  const trustedDevice = await tx.userDevice.findUnique({
    where: {
      userId_deviceId: {
        userId: employeeId,
        deviceId: input.deviceId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!trustedDevice || trustedDevice.status !== DeviceStatus.TRUSTED) {
    throw new CheckInServiceError(
      403,
      "DEVICE_NOT_TRUSTED",
      "This device is not trusted for check-in.",
    );
  }

  await tx.userDevice.update({
    where: {
      id: trustedDevice.id,
    },
    data: {
      lastSeenAt: now,
    },
    select: {
      id: true,
    },
  });

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
  const decision = decideCheckIn({
    photoRequired: assignment.event.photoRequired,
    hasPhoto: Boolean(input.photoUrl),
    gpsFreshness,
    accuracyMeters: input.accuracyMeters,
    distanceMeters,
    radiusMeters: assignment.event.radiusMeters,
  });

  const proof = await tx.eventProof.create({
    data: {
      assignmentId: assignment.id,
      type: ProofType.CHECK_IN,
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

  let updatedAssignment: CheckInAssignmentResponseState = {
    id: assignment.id,
    status: assignment.status,
    checkedInAt: assignment.checkedInAt,
    failureReason: assignment.failureReason,
  };

  if (decision.assignmentStatus) {
    const updateResult = await tx.eventAssignment.updateMany({
      where: {
        id: assignment.id,
        status: AssignmentStatus.PENDING,
        checkedInAt: null,
      },
      data: {
        status: decision.assignmentStatus,
        checkedInAt: now,
        failureReason: null,
      },
    });

    if (updateResult.count !== 1) {
      throw new CheckInServiceError(
        409,
        "ALREADY_CHECKED_IN",
        "This assignment is not eligible for check-in.",
      );
    }

    if (assignment.event.rechecksEnabled) {
      await scheduleRechecksForAssignment(tx, {
        assignmentId: assignment.id,
        employeeId,
        eventStartsAt: assignment.event.startsAt,
        eventEndsAt: assignment.event.endsAt,
        checkInAt: now,
        recheckCount: assignment.event.recheckCount,
        recheckWindowMinutes: assignment.event.recheckWindowMinutes,
      });
    }

    updatedAssignment = {
      id: assignment.id,
      status: decision.assignmentStatus,
      checkedInAt: now,
      failureReason: null,
    };
  } else {
    const refetchedAssignment = await tx.eventAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        failureReason: decision.rejectionCode,
      },
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        failureReason: true,
      },
    });
    updatedAssignment = refetchedAssignment;
  }

  return {
    assignment: {
      id: updatedAssignment.id,
      status: updatedAssignment.status,
      checkedInAt: updatedAssignment.checkedInAt?.toISOString() ?? null,
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
