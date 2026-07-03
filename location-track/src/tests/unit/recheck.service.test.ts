import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  DeviceStatus,
  ProofStatus,
  RecheckStatus,
} from "@prisma/client";

import {
  calculateRecheckExpiry,
  compareRecheckToken,
  decideRecheckProof,
  generateRandomRecheckTimes,
  hashRecheckToken,
  RecheckServiceError,
  scheduleRechecksForAssignment,
  validateRecheckSubmissionAccess,
  validateRecheckTokenState,
} from "../../services/recheck.service.ts";

test("generates sorted random recheck times after check-in with a full expiration window", () => {
  const eventStartsAt = new Date("2026-07-02T09:00:00.000Z");
  const checkInAt = new Date("2026-07-02T10:00:00.000Z");
  const eventEndsAt = new Date("2026-07-02T12:00:00.000Z");

  const times = generateRandomRecheckTimes({
    recheckCount: 3,
    recheckWindowMinutes: 15,
    eventStartsAt,
    eventEndsAt,
    checkInAt,
    randomInt: (maxExclusive) => Math.max(0, maxExclusive - 1),
  });

  assert.equal(times.length, 3);

  for (const startsAt of times) {
    assert.ok(startsAt.getTime() >= checkInAt.getTime());
    assert.ok(
      startsAt.getTime() + 15 * 60_000 <= eventEndsAt.getTime(),
      "recheck must leave room for the configured expiration window",
    );
  }

  assert.deepEqual(
    times.map((time) => time.getTime()),
    [...times].sort((left, right) => left.getTime() - right.getTime()).map(
      (time) => time.getTime(),
    ),
  );
});

test("hashes tokens and compares them without storing the raw token", () => {
  const rawToken = "raw-token-for-test";
  const tokenHash = hashRecheckToken(rawToken);

  assert.notEqual(tokenHash, rawToken);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(compareRecheckToken(rawToken, tokenHash), true);
  assert.equal(compareRecheckToken("different-token", tokenHash), false);
});

test("calculates expiration from the configured window without passing event end", () => {
  const startsAt = new Date("2026-07-02T10:50:00.000Z");
  const eventEndsAt = new Date("2026-07-02T11:00:00.000Z");

  const expiresAt = calculateRecheckExpiry({
    startsAt,
    eventEndsAt,
    recheckWindowMinutes: 20,
  });

  assert.equal(expiresAt.toISOString(), eventEndsAt.toISOString());
});

test("does not create recheck times when recheckCount is zero", () => {
  const times = generateRandomRecheckTimes({
    recheckCount: 0,
    recheckWindowMinutes: 15,
    eventStartsAt: new Date("2026-07-02T09:00:00.000Z"),
    checkInAt: new Date("2026-07-02T09:05:00.000Z"),
    eventEndsAt: new Date("2026-07-02T11:00:00.000Z"),
  });

  assert.deepEqual(times, []);
});

test("does not schedule rechecks when there is no full window before event end", () => {
  const times = generateRandomRecheckTimes({
    recheckCount: 2,
    recheckWindowMinutes: 15,
    eventStartsAt: new Date("2026-07-02T09:00:00.000Z"),
    checkInAt: new Date("2026-07-02T10:50:01.000Z"),
    eventEndsAt: new Date("2026-07-02T11:00:00.000Z"),
  });

  assert.deepEqual(times, []);
});

test("does not create duplicate rechecks for the same assignment", async () => {
  let createCalls = 0;
  const tx = {
    eventRecheck: {
      count: async () => 1,
      createMany: async () => {
        createCalls += 1;

        return { count: 0 };
      },
    },
  };

  const result = await scheduleRechecksForAssignment(tx as never, {
    assignmentId: "assignment_1",
    employeeId: "employee_1",
    eventStartsAt: new Date("2026-07-02T09:00:00.000Z"),
    checkInAt: new Date("2026-07-02T09:10:00.000Z"),
    eventEndsAt: new Date("2026-07-02T11:00:00.000Z"),
    recheckCount: 2,
    recheckWindowMinutes: 15,
  });

  assert.deepEqual(result, []);
  assert.equal(createCalls, 0);
});

test("creates scheduled recheck records without raw tokens or token hashes", async () => {
  const createdRecords: Array<{
    assignmentId: string;
    employeeId: string;
    tokenHash?: string;
    startsAt: Date;
    expiresAt: Date;
    status: RecheckStatus;
  }> = [];
  const tx = {
    eventRecheck: {
      count: async () => 0,
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
    eventStartsAt: new Date("2026-07-02T09:00:00.000Z"),
    checkInAt: new Date("2026-07-02T09:10:00.000Z"),
    eventEndsAt: new Date("2026-07-02T11:00:00.000Z"),
    recheckCount: 2,
    recheckWindowMinutes: 15,
  });

  assert.equal(result.length, 2);
  assert.equal(createdRecords.length, 2);

  for (const [index, record] of createdRecords.entries()) {
    assert.equal(record.assignmentId, "assignment_1");
    assert.equal(record.employeeId, "employee_1");
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
