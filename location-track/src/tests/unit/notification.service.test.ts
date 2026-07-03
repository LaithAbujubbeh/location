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
    link: "https://app.example.com/recheck/token",
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

test(".vercel.app sender is skipped and in-app notification still succeeds", async () => {
  const notificationCreateCalls: unknown[] = [];
  const sentEmails: unknown[] = [];
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
    userEmail: "employee@example.com",
    eventName: "Site Visit",
    locationName: null,
    expiresAt: new Date("2026-07-10T12:15:00.000Z"),
    recheckLink: "https://my-app.vercel.app/recheck/raw-token",
    now: new Date("2026-07-10T12:00:00.000Z"),
    resendApiKey: "resend_key",
    resendFromEmail: "Attendance <notify@my-app.vercel.app>",
    sendEmail: async (email) => {
      sentEmails.push(email);
    },
  });

  assert.equal(result.inAppCreated, true);
  assert.equal(notificationCreateCalls.length, 1);
  assert.equal(result.emailSkipped, true);
  assert.equal(sentEmails.length, 0);
  assert.equal(result.warnings[0].code, "EMAIL_SENDER_DOMAIN_NOT_ALLOWED");
});

test("recheck email HTML escapes event text and link attributes", async () => {
  const sentEmails: Array<{ subject: string; text: string; html: string }> = [];
  const tx = {
    notification: {
      create: async () => ({
        id: "notification_1",
      }),
    },
  };

  const result = await sendRecheckNotification({
    tx: tx as never,
    userId: "employee_1",
    userEmail: "employee@example.com",
    eventName: `Site <script>alert("x")</script>\r\nBcc: attacker@example.com`,
    locationName: `Office "A"`,
    expiresAt: new Date("2026-07-10T12:15:00.000Z"),
    recheckLink: `https://app.example.com/recheck/token" onclick="alert(1)`,
    now: new Date("2026-07-10T12:00:00.000Z"),
    resendApiKey: "resend_key",
    resendFromEmail: "Attendance <attendance@example.com>",
    sendEmail: async (email) => {
      sentEmails.push(email);
    },
  });

  assert.equal(result.emailSent, true);
  assert.equal(sentEmails.length, 1);
  assert.doesNotMatch(sentEmails[0].subject, /[\r\n]/);
  assert.match(sentEmails[0].html, /&lt;script&gt;alert/);
  assert.match(sentEmails[0].html, /&quot; onclick=&quot;alert\(1\)/);
  assert.doesNotMatch(sentEmails[0].html, /<script>/);
});

test("env example does not hardcode a .vercel.app or fake sender email", () => {
  const envExample = readFileSync(".env.example", "utf8");

  assert.match(envExample, /RESEND_FROM_EMAIL=""/);
  assert.doesNotMatch(envExample, /notify@/);
  assert.doesNotMatch(envExample, /noreply@/);
  assert.doesNotMatch(envExample, /\.vercel\.app.*RESEND_FROM_EMAIL/);
});
