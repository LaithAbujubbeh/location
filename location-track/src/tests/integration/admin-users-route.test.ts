import assert from "node:assert/strict";
import test from "node:test";

import { UserRole } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const { PermissionError } = await import("../../lib/permissions.ts");
const { rateLimitPolicies } = await import("../../lib/rate-limit.ts");
const { UserServiceError } = await import("../../services/user.service.ts");
const { handleAdminCreateUserRequest, handleAdminListUsersRequest } =
  await import("../../app/api/admin/users/route.ts");
const { handleAdminUpdateUserRequest } = await import(
  "../../app/api/admin/users/[userId]/route.ts"
);

function jsonRequest(url: string, method: "PATCH" | "POST", body: unknown) {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const adminSession = {
  user: {
    id: "admin_1",
    role: UserRole.ADMIN,
  },
} as never;

test("admin can list users", async () => {
  const response = await handleAdminListUsersRequest(
    new Request(
      "http://localhost:3000/api/admin/users?page=2&pageSize=10&role=EMPLOYEE&isActive=true&search=laith",
    ),
    {
      requireAdminSession: async () => adminSession,
      listUsers: async ({ query }) => {
        assert.equal(query.page, 2);
        assert.equal(query.pageSize, 10);
        assert.equal(query.isActive, true);
        assert.equal(query.role, UserRole.EMPLOYEE);
        assert.equal(query.search, "laith");

        return {
          items: [
            {
              id: "employee_1",
              name: "Laith",
              email: "laith@example.com",
              isActive: true,
              role: UserRole.EMPLOYEE,
              createdAt: "2026-07-01T10:00:00.000Z",
              updatedAt: "2026-07-01T10:00:00.000Z",
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
  assert.equal(body.data.items[0].email, "laith@example.com");
  assert.equal(body.data.items[0].password, undefined);
});

test("non-admin cannot list users", async () => {
  const response = await handleAdminListUsersRequest(
    new Request("http://localhost:3000/api/admin/users"),
    {
      requireAdminSession: async () => {
        throw new PermissionError(
          403,
          "FORBIDDEN",
          "Administrator access is required.",
        );
      },
      listUsers: async () => {
        throw new Error("users should not be listed");
      },
    },
  );

  assert.equal(response.status, 403);
});

test("admin can create employee", async () => {
  const response = await handleAdminCreateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users", "POST", {
      name: "Employee One",
      email: "Employee@One.com",
      password: "temporary-password",
      role: "EMPLOYEE",
    }),
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async ({ policy, userId }) => {
        assert.equal(policy, rateLimitPolicies.adminUserMutation);
        assert.equal(userId, "admin_1");

        return {
          allowed: true,
          limit: 20,
          remaining: 19,
          resetAt: new Date("2026-07-10T13:00:00.000Z"),
          retryAfterMs: 0,
        };
      },
      createUser: async ({ input }) => {
        assert.equal(input.email, "employee@one.com");
        assert.equal(input.role, UserRole.EMPLOYEE);

        return {
          user: {
            id: "employee_1",
            name: input.name,
            email: input.email,
            isActive: input.isActive,
            role: input.role,
            createdAt: "2026-07-01T10:00:00.000Z",
            updatedAt: "2026-07-01T10:00:00.000Z",
          },
        };
      },
    },
  );

  assert.equal(response.status, 201);
  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.data.user.role, UserRole.EMPLOYEE);
  assert.equal(body.data.user.password, undefined);
  assert.equal(body.data.user.passwordHash, undefined);
});

test("admin can create admin", async () => {
  const response = await handleAdminCreateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users", "POST", {
      name: "Admin Two",
      email: "admin2@example.com",
      password: "temporary-password",
      role: "ADMIN",
    }),
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 0,
      }),
      createUser: async ({ input }) => ({
        user: {
          id: "admin_2",
          name: input.name,
          email: input.email,
          isActive: input.isActive,
          role: input.role,
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-01T10:00:00.000Z",
        },
      }),
    },
  );

  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.user.role, UserRole.ADMIN);
});

test("admin can update user role", async () => {
  const response = await handleAdminUpdateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users/employee_1", "PATCH", {
      isActive: true,
      name: "Employee Promoted",
      role: "ADMIN",
    }),
    {
      params: Promise.resolve({
        userId: "employee_1",
      }),
    },
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async ({ policy, userId }) => {
        assert.equal(policy, rateLimitPolicies.adminUserMutation);
        assert.equal(userId, "admin_1");

        return {
          allowed: true,
          limit: 20,
          remaining: 19,
          resetAt: new Date("2026-07-10T13:00:00.000Z"),
          retryAfterMs: 0,
        };
      },
      updateUser: async ({ currentAdminId, input, userId }) => {
        assert.equal(currentAdminId, "admin_1");
        assert.equal(userId, "employee_1");
        assert.equal(input.role, UserRole.ADMIN);

        return {
          user: {
            id: userId,
            name: input.name,
            email: "employee@example.com",
            isActive: input.isActive,
            role: input.role,
            createdAt: "2026-07-01T10:00:00.000Z",
            updatedAt: "2026-07-02T10:00:00.000Z",
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.user.role, UserRole.ADMIN);
});

test("admin can deactivate an employee", async () => {
  const response = await handleAdminUpdateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users/employee_1", "PATCH", {
      isActive: false,
      name: "Employee Inactive",
      role: "EMPLOYEE",
    }),
    {
      params: Promise.resolve({
        userId: "employee_1",
      }),
    },
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 0,
      }),
      updateUser: async ({ input, userId }) => ({
        user: {
          id: userId,
          name: input.name,
          email: "employee@example.com",
          isActive: input.isActive,
          role: input.role,
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.user.isActive, false);
});

test("non-admin cannot update roles", async () => {
  const response = await handleAdminUpdateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users/employee_1", "PATCH", {
      isActive: true,
      name: "Employee",
      role: "ADMIN",
    }),
    {
      params: Promise.resolve({
        userId: "employee_1",
      }),
    },
    {
      requireAdminSession: async () => {
        throw new PermissionError(
          403,
          "FORBIDDEN",
          "Administrator access is required.",
        );
      },
      consumeRateLimit: async () => {
        throw new Error("rate limit should not run");
      },
      updateUser: async () => {
        throw new Error("user should not be updated");
      },
    },
  );

  assert.equal(response.status, 403);
});

test("last admin cannot be demoted", async () => {
  const response = await handleAdminUpdateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users/admin_1", "PATCH", {
      isActive: true,
      name: "Only Admin",
      role: "EMPLOYEE",
    }),
    {
      params: Promise.resolve({
        userId: "admin_1",
      }),
    },
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 0,
      }),
      updateUser: async () => {
        throw new UserServiceError(
          400,
          "LAST_ADMIN_DEMOTION_NOT_ALLOWED",
          "The last administrator cannot be demoted.",
        );
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "LAST_ADMIN_DEMOTION_NOT_ALLOWED",
  );
});

test("last active admin cannot be deactivated", async () => {
  const response = await handleAdminUpdateUserRequest(
    jsonRequest("http://localhost:3000/api/admin/users/admin_1", "PATCH", {
      isActive: false,
      name: "Only Admin",
      role: "ADMIN",
    }),
    {
      params: Promise.resolve({
        userId: "admin_1",
      }),
    },
    {
      requireAdminSession: async () => adminSession,
      consumeRateLimit: async () => ({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetAt: new Date("2026-07-10T13:00:00.000Z"),
        retryAfterMs: 0,
      }),
      updateUser: async () => {
        throw new UserServiceError(
          400,
          "LAST_ACTIVE_ADMIN_REQUIRED",
          "At least one active administrator is required.",
        );
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "LAST_ACTIVE_ADMIN_REQUIRED",
  );
});
