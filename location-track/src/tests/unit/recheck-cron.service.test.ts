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
  employeeEmails = new Map<string, string>(),
}: {
  activationCandidates?: Array<{
    id: string;
    employeeId: string;
    expiresAt: Date;
    eventName: string;
    locationName: string | null;
  }>;
  expiredCandidates?: Array<{
    id: string;
    assignmentId: string;
  }>;
  employeeEmails?: Map<string, string>;
} = {}) {
  const recheckUpdateManyCalls: unknown[] = [];
  const notificationCreateCalls: unknown[] = [];
  const assignmentUpdateManyCalls: unknown[] = [];
  let eventRecheckFindManyCalls = 0;

  const tx = {
    eventRecheck: {
      findMany: async () => {
        eventRecheckFindManyCalls += 1;

        if (eventRecheckFindManyCalls === 1) {
          return activationCandidates.map((candidate) => ({
            id: candidate.id,
            employeeId: candidate.employeeId,
            expiresAt: candidate.expiresAt,
            assignment: {
              event: {
                title: candidate.eventName,
                locationName: candidate.locationName,
              },
            },
          }));
        }

        return expiredCandidates;
      },
      updateMany: async (args: unknown) => {
        recheckUpdateManyCalls.push(args);

        return {
          count: 1,
        };
      },
    },
    user: {
      findMany: async () =>
        [...employeeEmails.entries()].map(([id, email]) => ({
          id,
          email,
        })),
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
    recheckUpdateManyCalls,
    notificationCreateCalls,
    assignmentUpdateManyCalls,
  };
}

test("in-app notification is created when a recheck becomes pending", async () => {
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
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
    appUrl: "https://app.example.com",
  });

  assert.equal(result.activatedCount, 1);
  assert.equal(result.notifications.inAppCreatedCount, 1);
  assert.equal(notificationCreateCalls.length, 1);
  assert.deepEqual(
    (notificationCreateCalls[0] as { data: { userId: string; link: string } })
      .data.userId,
    "employee_1",
  );
  assert.match(
    (notificationCreateCalls[0] as { data: { link: string } }).data.link,
    /^https:\/\/app\.example\.com\/recheck\/.+/,
  );
});

test("email is sent when Resend env vars exist", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const sentEmails: unknown[] = [];
  const { tx } = createCronTx({
    activationCandidates: [
      {
        id: "recheck_1",
        employeeId: "employee_1",
        expiresAt: new Date("2026-07-10T12:15:00.000Z"),
        eventName: "Site Visit",
        locationName: "Amman Office",
      },
    ],
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
    appUrl: "https://app.example.com",
    resendApiKey: "resend_key",
    resendFromEmail: "Attendance <attendance@example.com>",
    sendEmail: async (email) => {
      sentEmails.push(email);
    },
  });

  assert.equal(result.notifications.emailSentCount, 1);
  assert.equal(result.notifications.emailSkippedCount, 0);
  assert.equal(sentEmails.length, 1);
});

test("missing Resend env vars do not crash cron", async () => {
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
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
    appUrl: "https://app.example.com",
  });

  assert.equal(result.activatedCount, 1);
  assert.equal(result.notifications.inAppCreatedCount, 1);
  assert.equal(result.notifications.emailSkippedCount, 1);
  assert.equal(notificationCreateCalls.length, 1);
  assert.equal(result.notifications.warnings[0].code, "EMAIL_NOT_CONFIGURED");
});

test("email is skipped safely when RESEND_FROM_EMAIL is empty", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const sentEmails: unknown[] = [];
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
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
    appUrl: "https://my-app.vercel.app",
    resendApiKey: "resend_key",
    resendFromEmail: "",
    sendEmail: async (email) => {
      sentEmails.push(email);
    },
  });

  assert.equal(result.activatedCount, 1);
  assert.equal(result.notifications.inAppCreatedCount, 1);
  assert.equal(result.notifications.emailSkippedCount, 1);
  assert.equal(notificationCreateCalls.length, 1);
  assert.equal(sentEmails.length, 0);
  assert.equal(result.notifications.warnings[0].code, "EMAIL_NOT_CONFIGURED");
});

test("email failure does not prevent pending state or notificationSentAt update", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls, notificationCreateCalls } = createCronTx({
    activationCandidates: [
      {
        id: "recheck_1",
        employeeId: "employee_1",
        expiresAt: new Date("2026-07-10T12:15:00.000Z"),
        eventName: "Site Visit",
        locationName: null,
      },
    ],
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
  });

  const result = await processScheduledRechecksInTransaction(tx as never, {
    now,
    appUrl: "https://app.example.com",
    resendApiKey: "resend_key",
    resendFromEmail: "Attendance <attendance@example.com>",
    sendEmail: async () => {
      throw new Error("Resend outage");
    },
  });

  const activationUpdate = recheckUpdateManyCalls[0] as {
    data: {
      status: RecheckStatus;
      notificationSentAt: Date;
    };
  };

  assert.equal(activationUpdate.data.status, RecheckStatus.PENDING);
  assert.equal(activationUpdate.data.notificationSentAt, now);
  assert.equal(notificationCreateCalls.length, 1);
  assert.equal(result.notifications.inAppCreatedCount, 1);
  assert.equal(result.notifications.emailSkippedCount, 1);
  assert.equal(result.notifications.warnings[0].code, "EMAIL_SEND_FAILED");
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
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
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

test("notificationSentAt and tokenHash are set while raw token is not stored", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const { tx, recheckUpdateManyCalls } = createCronTx({
    activationCandidates: [
      {
        id: "recheck_1",
        employeeId: "employee_1",
        expiresAt: new Date("2026-07-10T12:15:00.000Z"),
        eventName: "Site Visit",
        locationName: null,
      },
    ],
    employeeEmails: new Map([["employee_1", "employee@example.com"]]),
  });

  await processScheduledRechecksInTransaction(tx as never, { now });

  const activationUpdate = recheckUpdateManyCalls[0] as {
    data: {
      status: RecheckStatus;
      tokenHash: string;
      notificationSentAt: Date;
      rawToken?: string;
    };
  };

  assert.equal(activationUpdate.data.status, RecheckStatus.PENDING);
  assert.match(activationUpdate.data.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(activationUpdate.data.notificationSentAt, now);
  assert.equal(activationUpdate.data.rawToken, undefined);
});

test("expired scheduled and pending rechecks become missed", async () => {
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
          emailSentCount: 2,
          emailSkippedCount: 1,
          warnings: [],
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
        emailSentCount: 2,
        emailSkippedCount: 1,
        warnings: [],
      },
    },
  });
});
