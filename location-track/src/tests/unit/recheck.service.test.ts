import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  DeviceStatus,
  ProofStatus,
  ProofType,
  RecheckStatus,
} from "@prisma/client";

import {
  buildScheduledRecheckTokensFromSlots,
  compareRecheckToken,
  decideRecheckProof,
  hashRecheckToken,
  RecheckServiceError,
  scheduleRechecksForAssignment,
  submitEmployeeRecheckSlotProofInTransaction,
  validateRecheckSubmissionAccess,
  validateRecheckTokenState,
} from "../../services/recheck.service.ts";

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}

test("hashes tokens and compares them without storing the raw token", () => {
  const rawToken = "raw-token-for-test";
  const tokenHash = hashRecheckToken(rawToken);

  assert.notEqual(tokenHash, rawToken);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(compareRecheckToken(rawToken, tokenHash), true);
  assert.equal(compareRecheckToken("different-token", tokenHash), false);
});

test("builds employee rechecks from fixed slots", () => {
  const result = buildScheduledRecheckTokensFromSlots({
    assignmentId: "assignment_1",
    employeeId: "employee_1",
    checkInAt: new Date("2026-07-10T10:00:00.000Z"),
    recheckSlots: [
      {
        id: "expired_slot",
        startsAt: new Date("2026-07-10T09:00:00.000Z"),
        expiresAt: new Date("2026-07-10T09:15:00.000Z"),
      },
      {
        id: "active_slot",
        startsAt: new Date("2026-07-10T09:55:00.000Z"),
        expiresAt: new Date("2026-07-10T10:10:00.000Z"),
      },
      {
        id: "future_slot",
        startsAt: new Date("2026-07-10T11:00:00.000Z"),
        expiresAt: new Date("2026-07-10T11:15:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    result.map((record) => ({
      slotId: record.slotId,
      status: record.status,
    })),
    [
      {
        slotId: "active_slot",
        status: RecheckStatus.PENDING,
      },
      {
        slotId: "future_slot",
        status: RecheckStatus.SCHEDULED,
      },
    ],
  );
});

test("does not create duplicate rechecks for the same assignment", async () => {
  let createCalls = 0;
  const tx = {
    eventRecheck: {
      findMany: async () => [
        {
          slotId: "slot_1",
        },
      ],
      createMany: async () => {
        createCalls += 1;

        return { count: 0 };
      },
    },
  };

  const result = await scheduleRechecksForAssignment(tx as never, {
    assignmentId: "assignment_1",
    employeeId: "employee_1",
    checkInAt: new Date("2026-07-02T09:10:00.000Z"),
    recheckSlots: [
      {
        id: "slot_1",
        startsAt: new Date("2026-07-02T10:00:00.000Z"),
        expiresAt: new Date("2026-07-02T10:15:00.000Z"),
      },
    ],
  });

  assert.deepEqual(result, []);
  assert.equal(createCalls, 0);
});

test("creates scheduled recheck records without raw tokens or token hashes", async () => {
  const createdRecords: Array<{
    assignmentId: string;
    employeeId: string;
    slotId: string;
    tokenHash?: string;
    startsAt: Date;
    expiresAt: Date;
    status: RecheckStatus;
  }> = [];
  const tx = {
    eventRecheck: {
      findMany: async () => [],
      createMany: async ({
        data,
      }: {
        data: Array<(typeof createdRecords)[number]>;
      }) => {
        createdRecords.push(...data);

        return { count: data.length };
      },
    },
  };

  const result = await scheduleRechecksForAssignment(tx as never, {
    assignmentId: "assignment_1",
    employeeId: "employee_1",
    checkInAt: new Date("2026-07-02T09:10:00.000Z"),
    recheckSlots: [
      {
        id: "slot_1",
        startsAt: new Date("2026-07-02T10:00:00.000Z"),
        expiresAt: new Date("2026-07-02T10:15:00.000Z"),
      },
      {
        id: "slot_2",
        startsAt: new Date("2026-07-02T10:30:00.000Z"),
        expiresAt: new Date("2026-07-02T10:45:00.000Z"),
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.equal(createdRecords.length, 2);

  for (const [index, record] of createdRecords.entries()) {
    assert.equal(record.assignmentId, "assignment_1");
    assert.equal(record.employeeId, "employee_1");
    assert.equal(record.slotId, `slot_${index + 1}`);
    assert.equal(record.status, RecheckStatus.SCHEDULED);
    assert.equal(record.tokenHash, undefined);
    assert.equal("rawToken" in result[index], false);
    assert.equal("tokenHash" in result[index], false);
    assert.ok(
      record.expiresAt.getTime() <=
        new Date("2026-07-02T11:00:00.000Z").getTime(),
    );
  }
});

function assertRecheckError(code: string) {
  return (error: unknown) =>
    error instanceof RecheckServiceError && error.code === code;
}

test("invalid recheck token fails validation", () => {
  assert.throws(
    () =>
      validateRecheckTokenState({
        rawToken: "wrong-token",
        now: new Date("2026-07-10T12:00:00.000Z"),
        recheck: {
          tokenHash: hashRecheckToken("correct-token"),
          status: RecheckStatus.ACTIVE,
          startsAt: new Date("2026-07-10T11:55:00.000Z"),
          expiresAt: new Date("2026-07-10T12:10:00.000Z"),
          submittedAt: null,
          completedAt: null,
        },
      }),
    assertRecheckError("INVALID_RECHECK_TOKEN"),
  );
});

test("expired recheck token fails validation", () => {
  const rawToken = "expired-token";

  assert.throws(
    () =>
      validateRecheckTokenState({
        rawToken,
        now: new Date("2026-07-10T12:00:00.000Z"),
        recheck: {
          tokenHash: hashRecheckToken(rawToken),
          status: RecheckStatus.ACTIVE,
          startsAt: new Date("2026-07-10T11:30:00.000Z"),
          expiresAt: new Date("2026-07-10T11:59:59.000Z"),
          submittedAt: null,
          completedAt: null,
        },
      }),
    assertRecheckError("RECHECK_EXPIRED"),
  );
});

test("reused recheck token fails validation", () => {
  const rawToken = "already-used-token";

  assert.throws(
    () =>
      validateRecheckTokenState({
        rawToken,
        now: new Date("2026-07-10T12:00:00.000Z"),
        recheck: {
          tokenHash: hashRecheckToken(rawToken),
          status: RecheckStatus.PASSED,
          startsAt: new Date("2026-07-10T11:30:00.000Z"),
          expiresAt: new Date("2026-07-10T12:30:00.000Z"),
          submittedAt: new Date("2026-07-10T11:45:00.000Z"),
          completedAt: new Date("2026-07-10T11:45:00.000Z"),
        },
      }),
    assertRecheckError("RECHECK_ALREADY_SUBMITTED"),
  );
});

test("employee cannot submit another employee's recheck", () => {
  const rawToken = "employee-owned-token";

  assert.throws(
    () =>
      validateRecheckSubmissionAccess({
        rawToken,
        employeeId: "employee_2",
        deviceStatus: DeviceStatus.TRUSTED,
        now: new Date("2026-07-10T12:00:00.000Z"),
        recheck: {
          tokenHash: hashRecheckToken(rawToken),
          status: RecheckStatus.ACTIVE,
          startsAt: new Date("2026-07-10T11:30:00.000Z"),
          expiresAt: new Date("2026-07-10T12:30:00.000Z"),
          submittedAt: null,
          completedAt: null,
          employeeId: "employee_1",
          assignment: {
            employeeId: "employee_1",
            status: AssignmentStatus.IN_PROGRESS,
          },
        },
      }),
    assertRecheckError("RECHECK_NOT_ASSIGNED"),
  );
});

test("trusted device is required for recheck submission", () => {
  const rawToken = "trusted-device-required-token";

  assert.throws(
    () =>
      validateRecheckSubmissionAccess({
        rawToken,
        employeeId: "employee_1",
        deviceStatus: DeviceStatus.PENDING,
        now: new Date("2026-07-10T12:00:00.000Z"),
        recheck: {
          tokenHash: hashRecheckToken(rawToken),
          status: RecheckStatus.ACTIVE,
          startsAt: new Date("2026-07-10T11:30:00.000Z"),
          expiresAt: new Date("2026-07-10T12:30:00.000Z"),
          submittedAt: null,
          completedAt: null,
          employeeId: "employee_1",
          assignment: {
            employeeId: "employee_1",
            status: AssignmentStatus.IN_PROGRESS,
          },
        },
      }),
    assertRecheckError("DEVICE_NOT_TRUSTED"),
  );
});

test("employee submits assigned recheck by event slot without a raw token", async () => {
  let findFirstWhere: unknown = null;
  let proofCreated = false;
  const now = new Date("2026-07-10T12:00:00.000Z");
  const recheck = {
    id: "recheck_1",
    assignmentId: "assignment_1",
    employeeId: "employee_1",
    tokenHash: null,
    status: RecheckStatus.ACTIVE,
    startsAt: new Date("2026-07-10T11:55:00.000Z"),
    expiresAt: new Date("2026-07-10T12:10:00.000Z"),
    submittedAt: null,
    completedAt: null,
    assignment: {
      id: "assignment_1",
      employeeId: "employee_1",
      status: AssignmentStatus.IN_PROGRESS,
      failureReason: null,
      event: {
        title: "Warehouse Audit",
        locationName: "Amman Warehouse",
        latitude: decimal(31.9711),
        longitude: decimal(35.9078),
        radiusMeters: 75,
        photoRequired: false,
      },
    },
  };
  const tx = {
    eventRecheck: {
      findFirst: async ({ where }: { where: unknown }) => {
        findFirstWhere = where;

        return recheck;
      },
      updateMany: async () => ({ count: 1 }),
    },
    userDevice: {
      findUnique: async () => ({
        id: "device_1",
        status: DeviceStatus.TRUSTED,
      }),
      update: async () => ({ id: "device_1" }),
    },
    eventProof: {
      create: async () => {
        proofCreated = true;

        return {
          id: "proof_1",
          type: ProofType.RECHECK,
          status: ProofStatus.ACCEPTED,
          latitude: decimal(31.9711),
          longitude: decimal(35.9078),
          accuracyMeters: 25,
          distanceMeters: 0,
          gpsTimestamp: now,
          deviceId: "00000000-0000-4000-8000-000000000001",
          photoUrl: null,
          rejectionCode: null,
          notes: null,
          createdAt: now,
        };
      },
    },
    eventAssignment: {
      findUniqueOrThrow: async () => ({
        id: "assignment_1",
        status: AssignmentStatus.IN_PROGRESS,
        failureReason: null,
      }),
    },
  };

  const result = await submitEmployeeRecheckSlotProofInTransaction(tx as never, {
    eventId: "event_1",
    slotId: "slot_1",
    employeeId: "employee_1",
    now,
    input: {
      latitude: 31.9711,
      longitude: 35.9078,
      accuracyMeters: 25,
      gpsTimestamp: now,
      deviceId: "00000000-0000-4000-8000-000000000001",
      photoUrl: null,
    },
  });

  assert.deepEqual(findFirstWhere, {
    employeeId: "employee_1",
    slotId: "slot_1",
    assignment: {
      employeeId: "employee_1",
      eventId: "event_1",
    },
  });
  assert.equal(proofCreated, true);
  assert.equal(result.recheck.status, RecheckStatus.PASSED);
  assert.equal(result.proof.status, ProofStatus.ACCEPTED);
});

test("inside radius with good accuracy passes recheck", () => {
  const decision = decideRecheckProof({
    photoRequired: false,
    hasPhoto: false,
    gpsFreshness: {
      fresh: true,
      ageMs: 1000,
    },
    accuracyMeters: 25,
    distanceMeters: 20,
    radiusMeters: 75,
  });

  assert.equal(decision.proofStatus, ProofStatus.ACCEPTED);
  assert.equal(decision.recheckStatus, RecheckStatus.PASSED);
  assert.equal(decision.assignmentStatus, null);
});

test("outside radius fails recheck", () => {
  const decision = decideRecheckProof({
    photoRequired: false,
    hasPhoto: false,
    gpsFreshness: {
      fresh: true,
      ageMs: 1000,
    },
    accuracyMeters: 25,
    distanceMeters: 250,
    radiusMeters: 75,
  });

  assert.equal(decision.proofStatus, ProofStatus.REJECTED);
  assert.equal(decision.recheckStatus, RecheckStatus.FAILED);
  assert.equal(decision.assignmentStatus, AssignmentStatus.FAILED);
  assert.equal(decision.rejectionCode, "OUTSIDE_RADIUS");
});

test("poor accuracy inside the uncertainty range marks recheck suspicious", () => {
  const decision = decideRecheckProof({
    photoRequired: false,
    hasPhoto: false,
    gpsFreshness: {
      fresh: true,
      ageMs: 1000,
    },
    accuracyMeters: 250,
    distanceMeters: 70,
    radiusMeters: 75,
  });

  assert.equal(decision.proofStatus, ProofStatus.SUSPICIOUS);
  assert.equal(decision.recheckStatus, RecheckStatus.SUSPICIOUS);
  assert.equal(decision.assignmentStatus, AssignmentStatus.SUSPICIOUS);
});
