import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  DeviceStatus,
  EventStatus,
  ProofStatus,
  ProofType,
  RecheckStatus,
} from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { checkInToEventInTransaction, CheckInServiceError } = await import(
  "../../services/check-in.service.ts"
);

const now = new Date("2026-07-10T10:00:00.000Z");
const deviceId = "00000000-0000-4000-8000-000000000001";

const baseInput = {
  latitude: 31.9711,
  longitude: 35.9078,
  accuracyMeters: 30,
  gpsTimestamp: new Date("2026-07-10T09:59:45.000Z"),
  deviceId,
  photoUrl: "https://example.com/check-in.jpg",
};

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}

function assertCheckInError(code: string) {
  return (error: unknown) =>
    error instanceof CheckInServiceError && error.code === code;
}

function createCheckInTx({
  deviceStatus = DeviceStatus.TRUSTED,
  updateCount = 1,
}: {
  deviceStatus?: DeviceStatus | null;
  updateCount?: number;
} = {}) {
  const assignment = {
    id: "assignment_1",
    status: AssignmentStatus.PENDING,
    checkedInAt: null,
    failureReason: null,
    event: {
      id: "event_1",
      status: EventStatus.ACTIVE,
      latitude: decimal(31.9711),
      longitude: decimal(35.9078),
      radiusMeters: 75,
      startsAt: new Date("2026-07-10T09:00:00.000Z"),
      endsAt: new Date("2026-07-10T12:00:00.000Z"),
      photoRequired: true,
      rechecksEnabled: true,
      recheckCount: 1,
      recheckWindowMinutes: 15,
    },
  };
  let proofCreateData: {
    type: ProofType;
    status: ProofStatus;
    rejectionCode: string | null;
  } | null = null;
  let assignmentUpdateData: {
    status?: AssignmentStatus;
    checkedInAt?: Date;
    failureReason?: string | null;
  } | null = null;
  let recheckCreateData: {
    assignmentId: string;
    employeeId: string;
    startsAt: Date;
    expiresAt: Date;
    status: RecheckStatus;
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
      update: async ({ data }: { data: typeof assignmentUpdateData }) => {
        assignmentUpdateData = data;

        return {
          ...assignment,
          failureReason: data?.failureReason ?? assignment.failureReason,
        };
      },
      findUniqueOrThrow: async () => ({
        ...assignment,
        status: assignmentUpdateData?.status ?? assignment.status,
        checkedInAt: assignmentUpdateData?.checkedInAt ?? assignment.checkedInAt,
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
    eventRecheck: {
      count: async () => 0,
      create: async ({
        data,
      }: {
        data: {
          assignmentId: string;
          employeeId: string;
          startsAt: Date;
          expiresAt: Date;
          status: RecheckStatus;
        };
      }) => {
        recheckCreateData = data;

        return {
          id: "recheck_1",
        };
      },
    },
  };

  return {
    tx,
    getAssignmentUpdateData: () => assignmentUpdateData,
    getProofCreateData: () => proofCreateData,
    getRecheckCreateData: () => recheckCreateData,
  };
}

test("employee check-in succeeds inside radius and schedules rechecks", async () => {
  const {
    tx,
    getAssignmentUpdateData,
    getProofCreateData,
    getRecheckCreateData,
  } = createCheckInTx();

  const result = await checkInToEventInTransaction(tx as never, {
    eventId: "event_1",
    employeeId: "employee_1",
    input: baseInput,
    now,
  });

  assert.equal(result.assignment.status, AssignmentStatus.IN_PROGRESS);
  assert.equal(result.assignment.checkedInAt, now.toISOString());
  assert.equal(result.proof.type, ProofType.CHECK_IN);
  assert.equal(result.proof.status, ProofStatus.ACCEPTED);
  assert.equal(getAssignmentUpdateData()?.status, AssignmentStatus.IN_PROGRESS);
  assert.equal(getProofCreateData()?.rejectionCode, null);
  assert.equal(getRecheckCreateData()?.assignmentId, "assignment_1");
  assert.equal(getRecheckCreateData()?.employeeId, "employee_1");
  assert.equal(getRecheckCreateData()?.status, RecheckStatus.SCHEDULED);
});

test("employee check-in outside radius is rejected without starting attendance", async () => {
  const { tx, getAssignmentUpdateData, getProofCreateData } = createCheckInTx();

  const result = await checkInToEventInTransaction(tx as never, {
    eventId: "event_1",
    employeeId: "employee_1",
    input: {
      ...baseInput,
      latitude: 31.98,
      longitude: 35.9078,
    },
    now,
  });

  assert.equal(result.assignment.status, AssignmentStatus.PENDING);
  assert.equal(result.assignment.checkedInAt, null);
  assert.equal(result.assignment.failureReason, "OUTSIDE_RADIUS");
  assert.equal(result.proof.status, ProofStatus.REJECTED);
  assert.equal(result.proof.rejectionCode, "OUTSIDE_RADIUS");
  assert.equal(getAssignmentUpdateData()?.failureReason, "OUTSIDE_RADIUS");
  assert.equal(getProofCreateData()?.status, ProofStatus.REJECTED);
});

test("untrusted device blocks check-in before proof creation", async () => {
  const { tx, getProofCreateData } = createCheckInTx({
    deviceStatus: DeviceStatus.PENDING,
  });

  await assert.rejects(
    () =>
      checkInToEventInTransaction(tx as never, {
        eventId: "event_1",
        employeeId: "employee_1",
        input: baseInput,
        now,
      }),
    assertCheckInError("DEVICE_NOT_TRUSTED"),
  );

  assert.equal(getProofCreateData(), null);
});
