import assert from "node:assert/strict";
import test from "node:test";

import { AssignmentStatus, RecheckStatus } from "@prisma/client";

import { handleCronRechecksRequest } from "../../app/api/cron/rechecks/route.ts";
import {
  isCronRequestAuthorized,
  processScheduledRechecksInTransaction,
} from "../../services/recheck-cron.service.ts";

function createCronTx({
  activatedCount = 0,
  missedCount = 0,
  missedAssignmentIds = [],
}: {
  activatedCount?: number;
  missedCount?: number;
  missedAssignmentIds?: string[];
} = {}) {
  const recheckUpdateManyCalls: unknown[] = [];
  const assignmentUpdateManyCalls: unknown[] = [];
  let findManyCall: unknown = null;

  const tx = {
    eventRecheck: {
      updateMany: async (args: unknown) => {
        recheckUpdateManyCalls.push(args);

        return {
          count:
            recheckUpdateManyCalls.length === 1
              ? activatedCount
              : missedCount,
        };
      },
      findMany: async (args: unknown) => {
        findManyCall = args;

        return missedAssignmentIds.map((assignmentId) => ({
          assignmentId,
        }));
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
    recheckUpdateManyCalls,
    assignmentUpdateManyCalls,
    getFindManyCall: () => findManyCall,
  };
}

test("scheduled rechecks become pending when their window opens", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls } = createCronTx({
    activatedCount: 2,
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });

  assert.equal(result.activatedCount, 2);
  assert.deepEqual(recheckUpdateManyCalls[0], {
    where: {
      status: RecheckStatus.SCHEDULED,
      startsAt: {
        lte: now,
      },
      expiresAt: {
        gt: now,
      },
      submittedAt: null,
    },
    data: {
      status: RecheckStatus.PENDING,
    },
  });
});

test("expired scheduled and pending rechecks become missed", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls } = createCronTx({
    missedCount: 2,
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
  });

  assert.equal(result.missedCount, 2);
  assert.deepEqual(recheckUpdateManyCalls[1], {
    where: {
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

test("submitted rechecks are not marked missed", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls } = createCronTx({
    missedCount: 1,
  });

  await processScheduledRechecksInTransaction(tx as never, { now });

  assert.equal(
    (recheckUpdateManyCalls[1] as { where: { submittedAt: null } }).where
      .submittedAt,
    null,
  );
});

test("missed rechecks mark active assignments suspicious and pending assignments missed", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const {
    tx,
    assignmentUpdateManyCalls,
    getFindManyCall,
  } = createCronTx({
    missedCount: 2,
    missedAssignmentIds: ["assignment_1", "assignment_2", "assignment_1"],
  });

  await processScheduledRechecksInTransaction(tx as never, { now });

  assert.deepEqual(getFindManyCall(), {
    where: {
      status: RecheckStatus.MISSED,
      expiresAt: {
        lte: now,
      },
      submittedAt: null,
    },
    select: {
      assignmentId: true,
    },
  });
  assert.deepEqual(assignmentUpdateManyCalls[0], {
    where: {
      id: {
        in: ["assignment_1", "assignment_2"],
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
        in: ["assignment_1", "assignment_2"],
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
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      activatedCount: 3,
      missedCount: 1,
    },
  });
});
