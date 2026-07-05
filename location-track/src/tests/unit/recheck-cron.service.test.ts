import assert from "node:assert/strict";
import test from "node:test";

import { AssignmentStatus, RecheckStatus } from "@prisma/client";

import { handleCronRechecksRequest } from "../../app/api/cron/rechecks/route.ts";
import {
  isCronRequestAuthorized,
  processScheduledRechecksInTransaction,
} from "../../services/recheck-cron.service.ts";

function createCronTx({
  activationCandidates = [],
  expiredCandidates = [],
}: {
  activationCandidates?: Array<{
    id: string;
    eventId?: string;
    employeeId: string;
    expiresAt: Date;
    eventName: string;
    locationName: string | null;
  }>;
  expiredCandidates?: Array<{
    id: string;
    assignmentId: string;
    employeeId?: string;
    eventId?: string;
  }>;
} = {}) {
  const recheckFindManyCalls: unknown[] = [];
  const recheckUpdateManyCalls: unknown[] = [];
  const notificationCreateCalls: unknown[] = [];
  const assignmentUpdateManyCalls: unknown[] = [];
  let eventRecheckFindManyCalls = 0;

  const tx = {
    eventRecheck: {
      findMany: async (args: unknown) => {
        recheckFindManyCalls.push(args);
        eventRecheckFindManyCalls += 1;

        if (eventRecheckFindManyCalls === 1) {
          return activationCandidates.map((candidate) => ({
            id: candidate.id,
            employeeId: candidate.employeeId,
            expiresAt: candidate.expiresAt,
            assignment: {
              event: {
                id: candidate.eventId ?? "event_1",
                title: candidate.eventName,
                locationName: candidate.locationName,
              },
            },
          }));
        }

        return expiredCandidates.map((candidate) => ({
          id: candidate.id,
          assignmentId: candidate.assignmentId,
          employeeId: candidate.employeeId ?? "employee_1",
          assignment: {
            eventId: candidate.eventId ?? "event_1",
          },
        }));
      },
      updateMany: async (args: unknown) => {
        recheckUpdateManyCalls.push(args);

        return {
          count: 1,
        };
      },
    },
    notification: {
      create: async (args: unknown) => {
        notificationCreateCalls.push(args);

        return {
          id: `notification_${notificationCreateCalls.length}`,
        };
      },
    },
    eventAssignment: {
      updateMany: async (args: unknown) => {
        assignmentUpdateManyCalls.push(args);

        return {
          count: 0,
        };
      },
    },
  };

  return {
    tx,
    recheckFindManyCalls,
    recheckUpdateManyCalls,
    notificationCreateCalls,
    assignmentUpdateManyCalls,
  };
}

test("in-app notification is created when a fixed recheck becomes pending", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const expiresAt = new Date("2026-07-10T12:15:00.000Z");
  const { tx, notificationCreateCalls } = createCronTx({
    activationCandidates: [
      {
        id: "recheck_1",
        employeeId: "employee_1",
        expiresAt,
        eventName: "Site Visit",
        locationName: "Amman Office",
      },
    ],
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });

  assert.equal(result.activatedCount, 1);
  assert.equal(result.notifications.inAppCreatedCount, 1);
  assert.equal(notificationCreateCalls.length, 1);
  assert.equal(
    (notificationCreateCalls[0] as { data: { userId: string } }).data.userId,
    "employee_1",
  );
  assert.equal(
    (notificationCreateCalls[0] as { data: { link: string | null } }).data.link,
    "/employee/events/event_1/recheck",
  );
});

test("cron activates scheduled or pending fixed rechecks without email env vars", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckFindManyCalls, recheckUpdateManyCalls } = createCronTx({
    activationCandidates: [
      {
        id: "recheck_1",
        employeeId: "employee_1",
        expiresAt: new Date("2026-07-10T12:15:00.000Z"),
        eventName: "Site Visit",
        locationName: null,
      },
    ],
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });
  const activationQuery = recheckFindManyCalls[0] as {
    where: {
      status: { in: RecheckStatus[] };
      tokenHash: null;
      notificationSentAt: null;
    };
  };
  const activationUpdate = recheckUpdateManyCalls[0] as {
    where: {
      status: { in: RecheckStatus[] };
      tokenHash: null;
      notificationSentAt: null;
    };
    data: {
      status: RecheckStatus;
      tokenHash: string;
      notificationSentAt: Date;
      rawToken?: string;
    };
  };

  assert.equal(result.activatedCount, 1);
  assert.deepEqual(activationQuery.where.status.in, [
    RecheckStatus.SCHEDULED,
    RecheckStatus.PENDING,
  ]);
  assert.equal(activationQuery.where.tokenHash, null);
  assert.equal(activationQuery.where.notificationSentAt, null);
  assert.deepEqual(activationUpdate.where.status.in, [
    RecheckStatus.SCHEDULED,
    RecheckStatus.PENDING,
  ]);
  assert.equal(activationUpdate.where.tokenHash, null);
  assert.equal(activationUpdate.data.status, RecheckStatus.PENDING);
  assert.match(activationUpdate.data.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(activationUpdate.data.notificationSentAt, now);
  assert.equal(activationUpdate.data.rawToken, undefined);
});

test("notification is not sent twice when activation update does not win", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, notificationCreateCalls } = createCronTx({
    activationCandidates: [
      {
        id: "recheck_1",
        employeeId: "employee_1",
        expiresAt: new Date("2026-07-10T12:15:00.000Z"),
        eventName: "Site Visit",
        locationName: null,
      },
    ],
  });
  tx.eventRecheck.updateMany = async () => ({
    count: 0,
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });

  assert.equal(result.activatedCount, 0);
  assert.equal(notificationCreateCalls.length, 0);
});

test("expired scheduled and pending fixed rechecks become missed", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls } = createCronTx({
    expiredCandidates: [
      {
        id: "recheck_1",
        assignmentId: "assignment_1",
      },
    ],
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });

  assert.equal(result.missedCount, 1);
  assert.deepEqual(recheckUpdateManyCalls[0], {
    where: {
      id: "recheck_1",
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
});

test("missed recheck creates employee notification", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, notificationCreateCalls } = createCronTx({
    expiredCandidates: [
      {
        id: "recheck_1",
        assignmentId: "assignment_1",
        employeeId: "employee_1",
        eventId: "event_1",
      },
    ],
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });

  assert.equal(result.missedCount, 1);
  assert.equal(result.notifications.inAppCreatedCount, 1);
  assert.equal(
    (notificationCreateCalls[0] as { data: { userId: string } }).data.userId,
    "employee_1",
  );
  assert.equal(
    (notificationCreateCalls[0] as { data: { link: string } }).data.link,
    "/employee/events/event_1",
  );
});

test("submitted rechecks are not marked missed", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls } = createCronTx({
    expiredCandidates: [
      {
        id: "recheck_1",
        assignmentId: "assignment_1",
      },
    ],
  });

  await processScheduledRechecksInTransaction(tx as never, { now });

  assert.equal(
    (recheckUpdateManyCalls[0] as { where: { submittedAt: null } }).where
      .submittedAt,
    null,
  );
});

test("missed rechecks mark active assignments suspicious and pending assignments missed", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, assignmentUpdateManyCalls } = createCronTx({
    expiredCandidates: [
      {
        id: "recheck_1",
        assignmentId: "assignment_1",
      },
      {
        id: "recheck_2",
        assignmentId: "assignment_1",
      },
    ],
  });

  await processScheduledRechecksInTransaction(tx as never, { now });

  assert.deepEqual(assignmentUpdateManyCalls[0], {
    where: {
      id: {
        in: ["assignment_1"],
      },
      status: AssignmentStatus.IN_PROGRESS,
    },
    data: {
      status: AssignmentStatus.SUSPICIOUS,
      failureReason: "RECHECK_MISSED",
    },
  });
  assert.deepEqual(assignmentUpdateManyCalls[1], {
    where: {
      id: {
        in: ["assignment_1"],
      },
      status: AssignmentStatus.PENDING,
    },
    data: {
      status: AssignmentStatus.MISSED,
      failureReason: "RECHECK_MISSED",
    },
  });
});

test("cron secret is required", () => {
  assert.equal(
    isCronRequestAuthorized({
      authorizationHeader: "Bearer test-secret",
      querySecret: null,
      expectedSecret: undefined,
    }),
    false,
  );
  assert.equal(
    isCronRequestAuthorized({
      authorizationHeader: "Bearer wrong-secret",
      querySecret: null,
      expectedSecret: "test-secret",
    }),
    false,
  );
  assert.equal(
    isCronRequestAuthorized({
      authorizationHeader: "Bearer test-secret",
      querySecret: null,
      expectedSecret: "test-secret",
    }),
    true,
  );
  assert.equal(
    isCronRequestAuthorized({
      authorizationHeader: null,
      querySecret: "test-secret",
      expectedSecret: "test-secret",
    }),
    true,
  );
});

test("cron route rejects an invalid secret", async () => {
  let processed = false;
  const response = await handleCronRechecksRequest(
    new Request("http://localhost:3000/api/cron/rechecks", {
      headers: {
        Authorization: "Bearer wrong-secret",
      },
    }),
    {
      cronSecret: "test-secret",
      processRechecks: async () => {
        processed = true;

        return {
          activatedCount: 0,
          missedCount: 0,
          notifications: {
            inAppCreatedCount: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(processed, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Cron authorization failed.",
    },
  });
});

test("cron route returns the processing summary", async () => {
  const response = await handleCronRechecksRequest(
    new Request("http://localhost:3000/api/cron/rechecks", {
      headers: {
        Authorization: "Bearer test-secret",
      },
    }),
    {
      cronSecret: "test-secret",
      processRechecks: async () => ({
        activatedCount: 3,
        missedCount: 1,
        notifications: {
          inAppCreatedCount: 3,
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      activatedCount: 3,
      missedCount: 1,
      notifications: {
        inAppCreatedCount: 3,
      },
    },
  });
});
