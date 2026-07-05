import assert from "node:assert/strict";
import test from "node:test";

import { EventStatus, UserRole } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const { PermissionError } = await import("../../lib/permissions.ts");
const { rateLimitPolicies } = await import("../../lib/rate-limit.ts");
const { handleAdminCreateEventRequest, handleAdminListEventsRequest } = await import(
  "../../app/api/admin/events/route.ts"
);

const validCreateEventBody = {
  name: "Warehouse Audit",
  locationName: "Amman Warehouse",
  latitude: 31.9711,
  longitude: 35.9078,
  radiusMeters: 75,
  startsAt: "2026-07-10T09:00:00.000Z",
  endsAt: "2026-07-10T12:00:00.000Z",
  employeeIds: ["employee_1"],
  recheckSlots: [
    {
      startsAt: "2026-07-10T10:00:00.000Z",
      expiresAt: "2026-07-10T10:10:00.000Z",
    },
  ],
  requirePhoto: true,
  requireCheckout: true,
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost:3000/api/admin/events", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

test("admin can create event through the route handler", async () => {
  let createdByUserId: string | null = null;
  let sawParsedDate = false;

  const response = await handleAdminCreateEventRequest(
    jsonRequest(validCreateEventBody),
    {
      requireAdminSession: async () =>
        ({
          user: {
            id: "admin_1",
            role: UserRole.ADMIN,
          },
        }) as never,
      consumeRateLimit: async ({ policy, userId }) => {
        assert.equal(policy, rateLimitPolicies.adminCreateEvent);
        assert.equal(userId, "admin_1");

        return {
          allowed: true,
          limit: 20,
          remaining: 19,
          resetAt: new Date("2026-07-10T13:00:00.000Z"),
          retryAfterMs: 0,
        };
      },
      createEvent: async ({ input, createdByUserId: userId }) => {
        createdByUserId = userId;
        sawParsedDate = input.startsAt instanceof Date;

        return {
          event: {
            id: "event_1",
            name: input.name,
            locationName: input.locationName,
            latitude: input.latitude,
            longitude: input.longitude,
            radiusMeters: input.radiusMeters,
            startsAt: input.startsAt.toISOString(),
            endsAt: input.endsAt.toISOString(),
            status: EventStatus.SCHEDULED,
            requirePhoto: input.requirePhoto,
            requireCheckout: input.requireCheckout,
            recheckSlots: input.recheckSlots.map((slot, index) => ({
              id: `slot_${index + 1}`,
              startsAt: slot.startsAt.toISOString(),
              expiresAt: slot.expiresAt.toISOString(),
            })),
            createdByUserId: userId,
            createdAt: "2026-07-10T08:00:00.000Z",
          },
          assignedEmployeesCount: input.employeeIds.length,
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.data.event.id, "event_1");
  assert.equal(body.data.event.recheckSlots[0].startsAt, "2026-07-10T10:00:00.000Z");
  assert.equal(body.data.assignedEmployeesCount, 1);
  assert.equal(createdByUserId, "admin_1");
  assert.equal(sawParsedDate, true);
});

test("admin can list events through the route handler", async () => {
  const response = await handleAdminListEventsRequest(
    new Request("http://localhost:3000/api/admin/events?page=2&pageSize=10"),
    {
      requireAdminSession: async () =>
        ({
          user: {
            id: "admin_1",
            role: UserRole.ADMIN,
          },
        }) as never,
      listEvents: async ({ query }) => {
        assert.equal(query.page, 2);
        assert.equal(query.pageSize, 10);

        return {
          items: [
            {
              id: "event_1",
              name: "Warehouse Audit",
              locationName: "Amman Warehouse",
              startsAt: "2026-07-10T09:00:00.000Z",
              endsAt: "2026-07-10T12:00:00.000Z",
              status: EventStatus.SCHEDULED,
              radiusMeters: 75,
              requirePhoto: true,
              requireCheckout: true,
              recheckSlots: [],
              createdAt: "2026-07-10T08:00:00.000Z",
              assignedEmployeesCount: 3,
            },
          ],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total: 11,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true,
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.data.items[0].assignedEmployeesCount, 3);
  assert.equal(body.data.pagination.page, 2);
});

test("admin create event rejects a recheck slot outside the event window", async () => {
  const response = await handleAdminCreateEventRequest(
    jsonRequest({
      ...validCreateEventBody,
      recheckSlots: [
        {
          startsAt: "2026-07-10T12:30:00.000Z",
          expiresAt: "2026-07-10T12:40:00.000Z",
        },
      ],
    }),
    {
      requireAdminSession: async () =>
        ({
          user: {
            id: "admin_1",
            role: UserRole.ADMIN,
          },
        }) as never,
      consumeRateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 0,
      }),
      createEvent: async () => {
        throw new Error("invalid event should not be created");
      },
    },
  );

  assert.equal(response.status, 400);
  assert.match((await response.json()).error.message, /inside the event time window/);
});

test("admin create event rejects duplicate recheck slot startsAt values", async () => {
  const response = await handleAdminCreateEventRequest(
    jsonRequest({
      ...validCreateEventBody,
      recheckSlots: [
        {
          startsAt: "2026-07-10T10:00:00.000Z",
          expiresAt: "2026-07-10T10:10:00.000Z",
        },
        {
          startsAt: "2026-07-10T10:00:00.000Z",
          expiresAt: "2026-07-10T10:20:00.000Z",
        },
      ],
    }),
    {
      requireAdminSession: async () =>
        ({
          user: {
            id: "admin_1",
            role: UserRole.ADMIN,
          },
        }) as never,
      consumeRateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 0,
      }),
      createEvent: async () => {
        throw new Error("invalid event should not be created");
      },
    },
  );

  assert.equal(response.status, 400);
  assert.match((await response.json()).error.message, /duplicate startsAt/);
});

test("non-admin cannot create event", async () => {
  let createCalled = false;

  const response = await handleAdminCreateEventRequest(
    jsonRequest(validCreateEventBody),
    {
      requireAdminSession: async () => {
        throw new PermissionError(
          403,
          "FORBIDDEN",
          "Administrator access is required.",
        );
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run without admin session");
      },
      createEvent: async () => {
        createCalled = true;
        throw new Error("event should not be created");
      },
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    },
  });
  assert.equal(createCalled, false);
});

test("missing admin session returns 401", async () => {
  let createCalled = false;

  const response = await handleAdminCreateEventRequest(
    jsonRequest(validCreateEventBody),
    {
      requireAdminSession: async () => {
        throw new PermissionError(
          401,
          "UNAUTHORIZED",
          "Authentication is required.",
        );
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run without a session");
      },
      createEvent: async () => {
        createCalled = true;
        throw new Error("event should not be created");
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(createCalled, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication is required.",
    },
  });
});

test("rate-limited admin create event request returns 429", async () => {
  const response = await handleAdminCreateEventRequest(
    jsonRequest(validCreateEventBody),
    {
      requireAdminSession: async () =>
        ({
          user: {
            id: "admin_1",
            role: UserRole.ADMIN,
          },
        }) as never,
      consumeRateLimit: async () => ({
        allowed: false,
        limit: 20,
        remaining: 0,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 60_000,
      }),
      createEvent: async () => {
        throw new Error("event should not be created after rate limit");
      },
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );
  assert.deepEqual(await response.json(), {
    message: "Too many requests. Please try again later.",
  });
});
