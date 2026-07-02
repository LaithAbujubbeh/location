import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const {
  PRIVATE_NO_STORE_HEADER_VALUE,
  clientQueryKeys,
  mutationInvalidationPlan,
  withPrivateNoStore,
} = await import("../../lib/cache.ts");
const adminTimelineRoute = await import(
  "../../app/api/admin/events/[eventId]/timeline/route.ts"
);

async function readRouteSource(routePath: string) {
  return readFile(new URL(routePath, import.meta.url), "utf8");
}

test("private no-store helper applies the shared cache policy", async () => {
  const response = withPrivateNoStore(Response.json({ ok: true }));

  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );
  assert.deepEqual(await response.json(), { ok: true });
});

test("private route handlers are forced dynamic", () => {
  assert.equal(adminTimelineRoute.dynamic, "force-dynamic");
});

test("employee event route is not cached", async () => {
  const source = await readRouteSource("../../app/api/employee/events/route.ts");

  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /headers: privateNoStoreHeaders/);
});

test("recheck token route is not cached", async () => {
  const source = await readRouteSource(
    "../../app/api/rechecks/[token]/route.ts",
  );

  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /headers: privateNoStoreHeaders/);
});

test("admin timeline responses with private employee data are not cached", async () => {
  const response = await adminTimelineRoute.handleAdminEventTimelineRequest(
    new Request("http://localhost:3000/api/admin/events/event_1/timeline"),
    {
      params: Promise.resolve({
        eventId: "event_1",
      }),
    },
    {
      requireAdminSession: async () => ({ user: { id: "admin_1" } }),
      getTimeline: async ({ eventId }) => ({
        event: {
          id: eventId,
          name: "Warehouse Audit",
          locationName: "Amman Warehouse",
          startsAt: "2026-07-10T08:00:00.000Z",
          endsAt: "2026-07-10T16:00:00.000Z",
          radiusMeters: 90,
          requirePhoto: true,
          requireCheckout: true,
        },
        assignments: [],
        timeline: [],
        rechecks: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );
});

test("client query keys describe private data without Next cache tags", () => {
  assert.deepEqual(clientQueryKeys.admin.events.list(), [
    "admin",
    "events",
    "list",
  ]);
  assert.deepEqual(clientQueryKeys.employee.events.list("employee_1"), [
    "employee",
    "employee_1",
    "events",
    "list",
  ]);
  assert.deepEqual(
    clientQueryKeys.employee.events.detail("employee_1", "event_1"),
    ["employee", "employee_1", "events", "event_1"],
  );
  assert.deepEqual(clientQueryKeys.admin.events.timeline("event_1"), [
    "admin",
    "events",
    "event_1",
    "timeline",
  ]);
  assert.deepEqual(clientQueryKeys.rechecks.detail("token_1"), [
    "rechecks",
    "detail",
    "token_1",
  ]);
});

test("mutation invalidation plan covers required private refreshes", () => {
  assert.deepEqual(mutationInvalidationPlan.adminCreateEvent, [
    "admin.events.list",
    "employee.events.list for each assigned employee",
  ]);
  assert.deepEqual(mutationInvalidationPlan.employeeCheckIn, [
    "employee.events.list",
    "employee.events.detail",
    "admin.events.timeline",
    "admin.events.employees",
  ]);
  assert.deepEqual(mutationInvalidationPlan.recheckSubmit, [
    "employee.events.detail",
    "rechecks.detail",
    "admin.events.timeline",
  ]);
  assert.deepEqual(mutationInvalidationPlan.employeeCheckOut, [
    "employee.events.list",
    "employee.events.detail",
    "admin.events.timeline",
    "admin.events.employees",
  ]);
  assert.deepEqual(mutationInvalidationPlan.adminReviewDevice, [
    "admin.devices.list",
    "employee.devices.status",
  ]);
  assert.deepEqual(mutationInvalidationPlan.employeeReadNotification, [
    "employee.notifications.list",
  ]);
});
