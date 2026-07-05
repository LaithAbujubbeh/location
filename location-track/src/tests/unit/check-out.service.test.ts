import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  DeviceStatus,
  EventStatus,
  ProofStatus,
  ProofType,
} from "@prisma/client";

import {
  checkOutFromEventInTransaction,
  CheckOutServiceError,
  decideCheckOutProof,
} from "../../services/check-out.service.ts";

const now = new Date("2026-07-10T14:00:00.000Z");
const checkedInAt = new Date("2026-07-10T13:15:00.000Z");
const deviceId = "00000000-0000-4000-8000-000000000001";

const baseInput = {
  latitude: 31.9711,
  longitude: 35.9078,
  accuracyMeters: 35,
  gpsTimestamp: new Date("2026-07-10T13:59:45.000Z"),
  deviceId,
  photoUrl: "https://example.com/checkout-photo.jpg",
};

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}

function assertCheckOutError(code: string) {
  return (error: unknown) =>
    error instanceof CheckOutServiceError && error.code === code;
}

function createCheckOutTx({
  assignmentOverrides = {},
  eventOverrides = {},
  deviceStatus = DeviceStatus.TRUSTED,
  updateCount = 1,
}: {
  assignmentOverrides?: Partial<{
    status: AssignmentStatus;
    checkedInAt: Date | null;
    checkedOutAt: Date | null;
    completedAt: Date | null;
    failureReason: string | null;
  }>;
  eventOverrides?: Partial<{
    status: EventStatus;
    latitude: ReturnType<typeof decimal>;
    longitude: ReturnType<typeof decimal>;
    radiusMeters: number;
    startsAt: Date;
    endsAt: Date;
    checkoutRequired: boolean;
  }>;
  deviceStatus?: DeviceStatus | null;
  updateCount?: number;
} = {}) {
  const assignment = {
    id: "assignment_1",
    status: AssignmentStatus.IN_PROGRESS,
    checkedInAt,
    checkedOutAt: null,
    completedAt: null,
    failureReason: null,
    ...assignmentOverrides,
    event: {
      id: "event_1",
      status: EventStatus.ACTIVE,
      latitude: decimal(31.9711),
      longitude: decimal(35.9078),
      radiusMeters: 75,
      startsAt: new Date("2026-07-10T13:00:00.000Z"),
      endsAt: new Date("2026-07-10T15:00:00.000Z"),
      checkoutRequired: true,
      ...eventOverrides,
    },
  };
  let assignmentUpdateData: {
    status: AssignmentStatus;
    checkedOutAt: Date;
    completedAt: Date;
    failureReason: string | null;
  } | null = null;
  let proofCreateData: {
    type: ProofType;
    status: ProofStatus;
    rejectionCode: string | null;
  } | null = null;

  const tx = {
    eventAssignment: {
      findUnique: async () => assignment,
      updateMany: async ({ data }: { data: typeof assignmentUpdateData }) => {
        assignmentUpdateData = data;

        return {
          count: updateCount,
        };
      },
      findUniqueOrThrow: async () => ({
        id: assignment.id,
        status: assignmentUpdateData?.status ?? assignment.status,
        checkedInAt: assignment.checkedInAt,
        checkedOutAt: assignmentUpdateData?.checkedOutAt ?? assignment.checkedOutAt,
        completedAt: assignmentUpdateData?.completedAt ?? assignment.completedAt,
        failureReason:
          assignmentUpdateData?.failureReason ?? assignment.failureReason,
      }),
    },
    userDevice: {
      findUnique: async () =>
        deviceStatus
          ? {
              id: "user_device_1",
              status: deviceStatus,
            }
          : null,
      update: async () => ({
        id: "user_device_1",
      }),
    },
    eventProof: {
      create: async ({
        data,
      }: {
        data: {
          type: ProofType;
          status: ProofStatus;
          rejectionCode: string | null;
        };
      }) => {
        proofCreateData = data;

        return {
          id: "proof_1",
          type: data.type,
          status: data.status,
          latitude: decimal(baseInput.latitude),
          longitude: decimal(baseInput.longitude),
          accuracyMeters: baseInput.accuracyMeters,
          distanceMeters: 0,
          gpsTimestamp: baseInput.gpsTimestamp,
          deviceId,
          photoUrl: baseInput.photoUrl,
          rejectionCode: data.rejectionCode,
          notes: null,
          createdAt: now,
        };
      },
    },
    user: {
      findMany: async () => [],
    },
    notification: {
      createMany: async () => ({
        count: 0,
      }),
    },
  };

  return {
    tx,
    getAssignmentUpdateData: () => assignmentUpdateData,
    getProofCreateData: () => proofCreateData,
  };
}

test("checkout succeeds after valid check-in", async () => {
  const { tx, getAssignmentUpdateData, getProofCreateData } = createCheckOutTx();

  const result = await checkOutFromEventInTransaction(tx as never, {
    eventId: "event_1",
    employeeId: "employee_1",
    input: baseInput,
    now,
  });

  assert.equal(result.assignment.status, AssignmentStatus.COMPLETED);
  assert.equal(result.assignment.checkedOutAt, now.toISOString());
  assert.equal(result.proof.type, ProofType.CHECK_OUT);
  assert.equal(result.proof.status, ProofStatus.ACCEPTED);
  assert.equal(getAssignmentUpdateData()?.status, AssignmentStatus.COMPLETED);
  assert.equal(getAssignmentUpdateData()?.failureReason, null);
  assert.equal(getProofCreateData()?.type, ProofType.CHECK_OUT);
});

test("checkout fails if user is not assigned", async () => {
  const tx = {
    eventAssignment: {
      findUnique: async () => null,
    },
  };

  await assert.rejects(
    () =>
      checkOutFromEventInTransaction(tx as never, {
        eventId: "event_1",
        employeeId: "employee_1",
        input: baseInput,
        now,
      }),
    assertCheckOutError("ASSIGNMENT_NOT_FOUND"),
  );
});

test("checkout fails before check-in", async () => {
  const { tx } = createCheckOutTx({
    assignmentOverrides: {
      checkedInAt: null,
    },
  });

  await assert.rejects(
    () =>
      checkOutFromEventInTransaction(tx as never, {
        eventId: "event_1",
        employeeId: "employee_1",
        input: baseInput,
        now,
      }),
    assertCheckOutError("CHECK_IN_REQUIRED"),
  );
});

test("duplicate checkout fails", async () => {
  const { tx } = createCheckOutTx({
    assignmentOverrides: {
      checkedOutAt: new Date("2026-07-10T13:45:00.000Z"),
    },
  });

  await assert.rejects(
    () =>
      checkOutFromEventInTransaction(tx as never, {
        eventId: "event_1",
        employeeId: "employee_1",
        input: baseInput,
        now,
      }),
    assertCheckOutError("ALREADY_CHECKED_OUT"),
  );
});

test("untrusted device fails checkout", async () => {
  const { tx } = createCheckOutTx({
    deviceStatus: DeviceStatus.PENDING,
  });

  await assert.rejects(
    () =>
      checkOutFromEventInTransaction(tx as never, {
        eventId: "event_1",
        employeeId: "employee_1",
        input: baseInput,
        now,
      }),
    assertCheckOutError("DEVICE_NOT_TRUSTED"),
  );
});

test("outside radius fails checkout based on existing location rules", async () => {
  const { tx } = createCheckOutTx();

  const result = await checkOutFromEventInTransaction(tx as never, {
    eventId: "event_1",
    employeeId: "employee_1",
    input: {
      ...baseInput,
      latitude: 31.98,
      longitude: 35.9078,
      accuracyMeters: 25,
    },
    now,
  });

  assert.equal(result.assignment.status, AssignmentStatus.FAILED);
  assert.equal(result.assignment.failureReason, "OUTSIDE_RADIUS");
  assert.equal(result.proof.status, ProofStatus.REJECTED);
  assert.equal(result.proof.rejectionCode, "OUTSIDE_RADIUS");
});

test("poor GPS accuracy marks checkout suspicious", async () => {
  const { tx } = createCheckOutTx();

  const result = await checkOutFromEventInTransaction(tx as never, {
    eventId: "event_1",
    employeeId: "employee_1",
    input: {
      ...baseInput,
      accuracyMeters: 250,
    },
    now,
  });

  assert.equal(result.assignment.status, AssignmentStatus.SUSPICIOUS);
  assert.equal(result.proof.status, ProofStatus.SUSPICIOUS);
});

test("employee cannot checkout for another employee from request body", async () => {
  const tx = {
    eventAssignment: {
      findUnique: async ({
        where,
      }: {
        where: { eventId_employeeId: { employeeId: string } };
      }) => {
        if (where.eventId_employeeId.employeeId === "employee_2") {
          throw new Error("client employeeId was trusted");
        }

        return null;
      },
    },
  };

  await assert.rejects(
    () =>
      checkOutFromEventInTransaction(tx as never, {
        eventId: "event_1",
        employeeId: "employee_1",
        input: {
          ...baseInput,
          employeeId: "employee_2",
        } as never,
        now,
      }),
    assertCheckOutError("ASSIGNMENT_NOT_FOUND"),
  );
});

test("stale GPS fails checkout", () => {
  const decision = decideCheckOutProof({
    gpsFreshness: {
      fresh: false,
      ageMs: 60_000,
      reason: "GPS_TOO_OLD",
    },
    accuracyMeters: 25,
    distanceMeters: 10,
    radiusMeters: 75,
  });

  assert.equal(decision.proofStatus, ProofStatus.REJECTED);
  assert.equal(decision.assignmentStatus, AssignmentStatus.FAILED);
  assert.equal(decision.rejectionCode, "GPS_TOO_OLD");
});
