import assert from "node:assert/strict";
import test from "node:test";

import { DeviceStatus, UserRole } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const { PermissionError } = await import("../../lib/permissions.ts");
const { rateLimitPolicies } = await import("../../lib/rate-limit.ts");
const { handleAdminListDevicesRequest } = await import(
  "../../app/api/admin/devices/route.ts"
);
const { handleAdminApproveDeviceRequest } = await import(
  "../../app/api/admin/devices/[deviceId]/approve/route.ts"
);
const { handleAdminRejectDeviceRequest } = await import(
  "../../app/api/admin/devices/[deviceId]/reject/route.ts"
);

const adminSession = {
  user: {
    id: "admin_1",
    role: UserRole.ADMIN,
  },
} as never;

function deviceRecord(status: DeviceStatus) {
  const reviewed = status !== DeviceStatus.PENDING;

  return {
    id: `device_record_${status.toLowerCase()}`,
    userId: "employee_1",
    deviceId: `00000000-0000-4000-8000-00000000000${status.length}`,
    status,
    label: null,
    userAgent: "Test Browser",
    firstSeenAt: "2026-07-10T10:00:00.000Z",
    lastSeenAt: "2026-07-10T10:00:00.000Z",
    approvedAt:
      status === DeviceStatus.TRUSTED ? "2026-07-10T10:05:00.000Z" : null,
    rejectedAt:
      status === DeviceStatus.REJECTED ? "2026-07-10T10:05:00.000Z" : null,
    reviewedByUserId: reviewed ? "admin_1" : null,
    createdAt: "2026-07-10T10:00:00.000Z",
    updatedAt: "2026-07-10T10:05:00.000Z",
  };
}

function context(deviceId = "device_record_pending") {
  return {
    params: Promise.resolve({
      deviceId,
    }),
  };
}

function allowedRateLimit() {
  return {
    allowed: true,
    limit: 20,
    remaining: 19,
    resetAt: new Date("2026-07-10T11:00:00.000Z"),
    retryAfterMs: 0,
  };
}

test("admin can list pending, trusted, and rejected devices", async () => {
  const response = await handleAdminListDevicesRequest(
    new Request("http://localhost:3000/api/admin/devices?page=1&pageSize=20"),
    {
      requireAdminSession: async () => adminSession,
      listDevices: async ({ query }) => {
        assert.equal(query.status, undefined);

        const items = [
          deviceRecord(DeviceStatus.PENDING),
          deviceRecord(DeviceStatus.TRUSTED),
          deviceRecord(DeviceStatus.REJECTED),
        ];

        return {
          items: items.map((device) => ({
            ...device,
            user: {
              id: "employee_1",
              name: "Employee One",
              email: "employee@example.com",
              role: UserRole.EMPLOYEE,
            },
          })),
          pagination: {
            page: 1,
            pageSize: 20,
            total: items.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
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
  assert.deepEqual(
    body.data.items.map((item: { status: DeviceStatus }) => item.status),
    [DeviceStatus.PENDING, DeviceStatus.TRUSTED, DeviceStatus.REJECTED],
  );
});

test("admin can filter pending devices", async () => {
  const response = await handleAdminListDevicesRequest(
    new Request("http://localhost:3000/api/admin/devices?status=PENDING"),
    {
      requireAdminSession: async () => adminSession,
      listDevices: async ({ query }) => {
        assert.equal(query.status, DeviceStatus.PENDING);

        return {
          items: [
            {
              ...deviceRecord(DeviceStatus.PENDING),
              user: null,
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.items[0].status, DeviceStatus.PENDING);
});

test("admin can approve device", async () => {
  const response = await handleAdminApproveDeviceRequest(
    new Request("http://localhost:3000/api/admin/devices/device_1/approve", {
      method: "POST",
    }),
    context("device_1"),
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async ({ policy, userId }) => {
        assert.equal(policy, rateLimitPolicies.adminDeviceReview);
        assert.equal(userId, "admin_1");

        return allowedRateLimit();
      },
      approveDevice: async ({ reviewedByUserId, userDeviceId }) => {
        assert.equal(reviewedByUserId, "admin_1");
        assert.equal(userDeviceId, "device_1");

        return deviceRecord(DeviceStatus.TRUSTED);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.device.status, DeviceStatus.TRUSTED);
});

test("admin can reject device", async () => {
  const response = await handleAdminRejectDeviceRequest(
    new Request("http://localhost:3000/api/admin/devices/device_1/reject", {
      method: "POST",
    }),
    context("device_1"),
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async ({ policy, userId }) => {
        assert.equal(policy, rateLimitPolicies.adminDeviceReview);
        assert.equal(userId, "admin_1");

        return allowedRateLimit();
      },
      rejectDevice: async ({ reviewedByUserId, userDeviceId }) => {
        assert.equal(reviewedByUserId, "admin_1");
        assert.equal(userDeviceId, "device_1");

        return deviceRecord(DeviceStatus.REJECTED);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.device.status, DeviceStatus.REJECTED);
});

test("non-admin cannot approve or reject devices", async () => {
  const permissionError = new PermissionError(
    403,
    "FORBIDDEN",
    "Administrator access is required.",
  );
  const approveResponse = await handleAdminApproveDeviceRequest(
    new Request("http://localhost:3000/api/admin/devices/device_1/approve", {
      method: "POST",
    }),
    context("device_1"),
    {
      requireAdminSession: async () => {
        throw permissionError;
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run for non-admins");
      },
      approveDevice: async () => {
        throw new Error("device should not be approved");
      },
    },
  );
  const rejectResponse = await handleAdminRejectDeviceRequest(
    new Request("http://localhost:3000/api/admin/devices/device_1/reject", {
      method: "POST",
    }),
    context("device_1"),
    {
      requireAdminSession: async () => {
        throw permissionError;
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run for non-admins");
      },
      rejectDevice: async () => {
        throw new Error("device should not be rejected");
      },
    },
  );

  assert.equal(approveResponse.status, 403);
  assert.equal(rejectResponse.status, 403);
});
