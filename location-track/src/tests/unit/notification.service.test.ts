import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NotificationChannel, NotificationType } from "@prisma/client";

import {
  listNotificationsForEmployeeWithClient,
  markNotificationReadForEmployeeWithClient,
  NotificationServiceError,
  sendRecheckNotification,
} from "../../services/notification.service.ts";

function notificationRecord({
  id,
  userId,
  readAt = null,
}: {
  id: string;
  userId: string;
  readAt?: Date | null;
}) {
  return {
    id,
    userId,
    title: "Recheck required",
    message: "Please confirm your location.",
    type: NotificationType.RECHECK,
    channel: NotificationChannel.IN_APP,
    link: null,
    readAt,
    createdAt: new Date("2026-07-10T12:00:00.000Z"),
  };
}

test("employee can list only their own notifications", async () => {
  const calls: unknown[] = [];
  const client = {
    notification: {
      count: (args: unknown) => {
        calls.push(args);

        return Promise.resolve(1);
      },
      findMany: (args: unknown) => {
        calls.push(args);

        return Promise.resolve([
          notificationRecord({
            id: "notification_1",
            userId: "employee_1",
          }),
        ]);
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };

  const result = await listNotificationsForEmployeeWithClient(
    client as never,
    {
      userId: "employee_1",
      query: {
        page: 1,
        pageSize: 20,
      },
    },
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].userId, "employee_1");
  assert.deepEqual((calls[0] as { where: { userId: string } }).where, {
    userId: "employee_1",
  });
  assert.deepEqual((calls[1] as { where: { userId: string } }).where, {
    userId: "employee_1",
  });
});

test("employee cannot mark another employee's notification as read", async () => {
  const client = {
    notification: {
      updateMany: async () => ({
        count: 0,
      }),
      findFirst: async () => null,
    },
  };

  await assert.rejects(
    () =>
      markNotificationReadForEmployeeWithClient(client as never, {
        userId: "employee_1",
        notificationId: "notification_for_employee_2",
        now: new Date("2026-07-10T12:00:00.000Z"),
      }),
    (error) =>
      error instanceof NotificationServiceError &&
      error.code === "NOTIFICATION_NOT_FOUND",
  );
});

test("recheck notification creates only an in-app record", async () => {
  const notificationCreateCalls: unknown[] = [];
  const tx = {
    notification: {
      create: async (args: unknown) => {
        notificationCreateCalls.push(args);

        return {
          id: "notification_1",
        };
      },
    },
  };

  const result = await sendRecheckNotification({
    tx: tx as never,
    userId: "employee_1",
    eventName: `Site Visit\r\nBcc: attacker@example.com`,
    locationName: "Amman Office",
    expiresAt: new Date("2026-07-10T12:15:00.000Z"),
    now: new Date("2026-07-10T12:00:00.000Z"),
  });
  const createCall = notificationCreateCalls[0] as {
    data: {
      title: string;
      message: string;
      channel: NotificationChannel;
      link: string | null;
    };
  };

  assert.equal(result.inAppCreated, true);
  assert.equal(notificationCreateCalls.length, 1);
  assert.equal(createCall.data.channel, NotificationChannel.IN_APP);
  assert.equal(createCall.data.link, null);
  assert.doesNotMatch(createCall.data.title, /[\r\n]/);
  assert.match(createCall.data.message, /Amman Office/);
});

test("env example does not require Resend settings", () => {
  const envExample = readFileSync(".env.example", "utf8");

  assert.doesNotMatch(envExample, /RESEND_API_KEY/);
  assert.doesNotMatch(envExample, /RESEND_FROM_EMAIL/);
  assert.doesNotMatch(envExample, /TWILIO|WHATSAPP|FIREBASE/i);
});
