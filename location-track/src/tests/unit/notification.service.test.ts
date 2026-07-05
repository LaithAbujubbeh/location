import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NotificationChannel, NotificationType } from "@prisma/client";

import {
  deleteAllNotificationsForUserWithClient,
  deleteNotificationForUserWithClient,
  listNotificationsForEmployeeWithClient,
  markNotificationReadForEmployeeWithClient,
  notifyAdminsOfPendingDevice,
  notifyEmployeeDeviceApproved,
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

        return Promise.resolve(calls.length === 1 ? 1 : 1);
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
        unread: undefined,
      },
    },
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.unreadCount, 1);
  assert.equal(result.items[0].userId, "employee_1");
  assert.deepEqual((calls[0] as { where: { userId: string } }).where, {
    userId: "employee_1",
  });
  assert.deepEqual((calls[1] as { where: { userId: string } }).where, {
    userId: "employee_1",
    readAt: null,
  });
  assert.deepEqual((calls[2] as { where: { userId: string } }).where, {
    userId: "employee_1",
  });
});

test("employee can filter unread notifications", async () => {
  const calls: unknown[] = [];
  const client = {
    notification: {
      count: (args: unknown) => {
        calls.push(args);

        return Promise.resolve(0);
      },
      findMany: (args: unknown) => {
        calls.push(args);

        return Promise.resolve([]);
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };

  await listNotificationsForEmployeeWithClient(client as never, {
    userId: "employee_1",
    query: {
      page: 1,
      pageSize: 20,
      unread: true,
    },
  });

  assert.deepEqual(
    (calls[0] as { where: { userId: string; readAt: null } }).where,
    {
      userId: "employee_1",
      readAt: null,
    },
  );
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
    eventId: "event_1",
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
  assert.equal(createCall.data.link, "/employee/events/event_1/recheck");
  assert.doesNotMatch(createCall.data.title, /[\r\n]/);
  assert.match(createCall.data.message, /Amman Office/);
});

test("new pending device creates admin notifications", async () => {
  const createManyCalls: unknown[] = [];
  const client = {
    user: {
      findMany: async () => [
        {
          id: "admin_1",
        },
        {
          id: "admin_2",
        },
      ],
    },
    notification: {
      createMany: async (args: unknown) => {
        createManyCalls.push(args);

        return {
          count: 2,
        };
      },
    },
  };

  const result = await notifyAdminsOfPendingDevice(client as never, {
    now: new Date("2026-07-10T12:00:00.000Z"),
  });

  assert.equal(result, 2);
  assert.equal(createManyCalls.length, 1);
  assert.deepEqual(
    (createManyCalls[0] as { data: Array<{ userId: string; type: NotificationType; link: string }> }).data.map((item) => ({
      userId: item.userId,
      type: item.type,
      link: item.link,
    })),
    [
      {
        userId: "admin_1",
        type: NotificationType.DEVICE,
        link: "/admin/devices",
      },
      {
        userId: "admin_2",
        type: NotificationType.DEVICE,
        link: "/admin/devices",
      },
    ],
  );
});

test("device approval creates employee notification", async () => {
  const createCalls: unknown[] = [];
  const client = {
    notification: {
      create: async (args: unknown) => {
        createCalls.push(args);

        return {
          id: "notification_1",
        };
      },
    },
  };

  await notifyEmployeeDeviceApproved(client as never, {
    userId: "employee_1",
    now: new Date("2026-07-10T12:00:00.000Z"),
  });

  assert.equal(createCalls.length, 1);
  assert.deepEqual(
    (createCalls[0] as { data: { userId: string; type: NotificationType; link: string } }).data,
    {
      userId: "employee_1",
      title: "Your device was approved",
      message: "You can now use this device for attendance actions.",
      type: NotificationType.DEVICE,
      channel: NotificationChannel.IN_APP,
      link: "/employee/events",
      createdAt: new Date("2026-07-10T12:00:00.000Z"),
    },
  );
});

test("unread count updates after mark-as-read", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  let readAt: Date | null = null;
  const client = {
    notification: {
      updateMany: async () => {
        readAt = now;

        return {
          count: 1,
        };
      },
      findFirst: async () =>
        notificationRecord({
          id: "notification_1",
          userId: "employee_1",
          readAt,
        }),
      count: async (args: { where: { readAt?: null } }) =>
        args.where.readAt === null && readAt ? 0 : 1,
      findMany: async () => [],
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };

  const notification = await markNotificationReadForEmployeeWithClient(
    client as never,
    {
      userId: "employee_1",
      notificationId: "notification_1",
      now,
    },
  );
  const list = await listNotificationsForEmployeeWithClient(client as never, {
    userId: "employee_1",
    query: {
      page: 1,
      pageSize: 20,
      unread: undefined,
    },
  });

  assert.equal(notification.readAt, now.toISOString());
  assert.equal(list.unreadCount, 0);
});

test("employee can delete only their own notification", async () => {
  const deleteCalls: unknown[] = [];
  const client = {
    notification: {
      deleteMany: async (args: unknown) => {
        deleteCalls.push(args);

        return {
          count: 1,
        };
      },
    },
  };

  const result = await deleteNotificationForUserWithClient(client as never, {
    userId: "employee_1",
    notificationId: "notification_1",
  });

  assert.deepEqual(deleteCalls[0], {
    where: {
      id: "notification_1",
      userId: "employee_1",
    },
  });
  assert.deepEqual(result, {
    deleted: true,
  });
});

test("employee cannot delete another user's notification", async () => {
  const client = {
    notification: {
      deleteMany: async () => ({
        count: 0,
      }),
    },
  };

  await assert.rejects(
    () =>
      deleteNotificationForUserWithClient(client as never, {
        userId: "employee_1",
        notificationId: "notification_for_employee_2",
      }),
    (error) =>
      error instanceof NotificationServiceError &&
      error.code === "NOTIFICATION_NOT_FOUND",
  );
});

test("delete all notifications is scoped to current user", async () => {
  const deleteCalls: unknown[] = [];
  const client = {
    notification: {
      deleteMany: async (args: unknown) => {
        deleteCalls.push(args);

        return {
          count: 3,
        };
      },
    },
  };

  const result = await deleteAllNotificationsForUserWithClient(
    client as never,
    {
      userId: "employee_1",
    },
  );

  assert.deepEqual(deleteCalls[0], {
    where: {
      userId: "employee_1",
    },
  });
  assert.deepEqual(result, {
    deletedCount: 3,
  });
});

test("env example does not require Resend settings", () => {
  const envExample = readFileSync(".env.example", "utf8");

  assert.doesNotMatch(envExample, /RESEND_API_KEY/);
  assert.doesNotMatch(envExample, /RESEND_FROM_EMAIL/);
  assert.doesNotMatch(envExample, /TWILIO|WHATSAPP|FIREBASE/i);
});
