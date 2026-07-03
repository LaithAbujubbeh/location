import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  ProofStatus,
  ProofType,
  UserRole,
} from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const { PermissionError } = await import("../../lib/permissions.ts");
const { rateLimitPolicies } = await import("../../lib/rate-limit.ts");
const { handleEmployeeCheckOutRequest } = await import(
  "../../app/api/employee/events/[eventId]/check-out/route.ts"
);

const validPayload = {
  latitude: 31.9711,
  longitude: 35.9078,
  accuracyMeters: 25,
  gpsTimestamp: "2026-07-10T13:59:45.000Z",
  deviceId: "00000000-0000-4000-8000-000000000001",
  photoUrl: "https://example.com/checkout.jpg",
};

function checkoutRequest(body: unknown) {
  return new Request("http://localhost:3000/api/employee/events/event_1/check-out", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function context(eventId = "event_1") {
  return {
    params: Promise.resolve({
      eventId,
    }),
  };
}

function checkoutResult() {
  return {
    assignment: {
      id: "assignment_1",
      status: AssignmentStatus.COMPLETED,
      checkedInAt: "2026-07-10T13:15:00.000Z",
      checkedOutAt: "2026-07-10T14:00:00.000Z",
      completedAt: "2026-07-10T14:00:00.000Z",
      failureReason: null,
    },
    proof: {
      id: "proof_1",
      type: ProofType.CHECK_OUT,
      status: ProofStatus.ACCEPTED,
      latitude: validPayload.latitude,
      longitude: validPayload.longitude,
      accuracyMeters: validPayload.accuracyMeters,
      distanceMeters: 0,
      gpsTimestamp: validPayload.gpsTimestamp,
      deviceId: validPayload.deviceId,
      photoUrl: validPayload.photoUrl,
      rejectionCode: null,
      notes: null,
      createdAt: "2026-07-10T14:00:00.000Z",
    },
    verification: {
      distanceMeters: 0,
      radiusMeters: 75,
      gpsAgeMs: 15_000,
    },
  };
}

test("missing checkout session returns 401", async () => {
  let checkoutCalled = false;
  const response = await handleEmployeeCheckOutRequest(
    checkoutRequest(validPayload),
    context(),
    {
      requireEmployeeSession: async () => {
        throw new PermissionError(401, "UNAUTHORIZED", "Authentication is required.");
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run without a session");
      },
      checkOut: async () => {
        checkoutCalled = true;
        throw new Error("checkout should not run without a session");
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(checkoutCalled, false);
  assert.equal(response.headers.get("Cache-Control"), PRIVATE_NO_STORE_HEADER_VALUE);
});

test("wrong role cannot checkout through the employee route", async () => {
  let checkoutCalled = false;
  const response = await handleEmployeeCheckOutRequest(
    checkoutRequest(validPayload),
    context(),
    {
      requireEmployeeSession: async () => {
        throw new PermissionError(403, "FORBIDDEN", "Employee access is required.");
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run for the wrong role");
      },
      checkOut: async () => {
        checkoutCalled = true;
        throw new Error("checkout should not run for the wrong role");
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(checkoutCalled, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Employee access is required.",
    },
  });
});

test("checkout route ignores employeeId spoofing from the request body", async () => {
  let sawSessionUserId: string | null = null;
  let sawClientEmployeeId = false;
  const response = await handleEmployeeCheckOutRequest(
    checkoutRequest({
      ...validPayload,
      employeeId: "employee_2",
    }),
    context(),
    {
      requireEmployeeSession: async () =>
        ({
          user: {
            id: "employee_1",
            role: UserRole.EMPLOYEE,
          },
        }) as never,
      consumeRateLimit: async ({ policy, userId }) => {
        assert.equal(policy, rateLimitPolicies.checkOutSubmit);
        assert.equal(userId, "employee_1");

        return {
          allowed: true,
          limit: 5,
          remaining: 4,
          resetAt: new Date("2026-07-10T14:05:00.000Z"),
          retryAfterMs: 0,
        };
      },
      checkOut: async ({ session, input }) => {
        sawSessionUserId = session.user.id;
        sawClientEmployeeId = "employeeId" in input;

        return checkoutResult();
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal(sawSessionUserId, "employee_1");
  assert.equal(sawClientEmployeeId, false);
});

test("rate-limited checkout returns 429 before processing", async () => {
  let checkoutCalled = false;
  const response = await handleEmployeeCheckOutRequest(
    checkoutRequest(validPayload),
    context(),
    {
      requireEmployeeSession: async () =>
        ({
          user: {
            id: "employee_1",
            role: UserRole.EMPLOYEE,
          },
        }) as never,
      consumeRateLimit: async () => ({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: new Date("2026-07-10T14:05:00.000Z"),
        retryAfterMs: 60_000,
      }),
      checkOut: async () => {
        checkoutCalled = true;
        throw new Error("checkout should not run after rate limiting");
      },
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(checkoutCalled, false);
});
