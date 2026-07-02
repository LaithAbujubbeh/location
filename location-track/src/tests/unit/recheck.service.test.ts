import assert from "node:assert/strict";
import test from "node:test";

import { RecheckStatus } from "@prisma/client";

import {
  calculateRecheckExpiry,
  compareRecheckToken,
  generateRandomRecheckTimes,
  hashRecheckToken,
  scheduleRechecksForAssignment,
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
      create: async () => {
        createCalls += 1;

        return { id: "should-not-create" };
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

test("creates scheduled recheck records with hashed tokens only", async () => {
  const createdRecords: Array<{
    assignmentId: string;
    employeeId: string;
    tokenHash: string;
    startsAt: Date;
    expiresAt: Date;
    status: RecheckStatus;
  }> = [];
  const tx = {
    eventRecheck: {
      count: async () => 0,
      create: async ({ data }: { data: (typeof createdRecords)[number] }) => {
        createdRecords.push(data);

        return { id: `recheck_${createdRecords.length}` };
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
    assert.match(record.tokenHash, /^[a-f0-9]{64}$/);
    assert.notEqual(record.tokenHash, result[index].rawToken);
    assert.equal(
      compareRecheckToken(result[index].rawToken, record.tokenHash),
      true,
    );
    assert.ok(
      record.expiresAt.getTime() <=
        new Date("2026-07-02T11:00:00.000Z").getTime(),
    );
  }
});
