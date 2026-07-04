import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  EventStatus,
  RecheckStatus,
  UserRole,
} from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const {
  handleEmployeeEventsRequest,
} = await import("../../app/api/employee/events/route.ts");
const {
  handleEmployeeEventDetailRequest,
} = await import("../../app/api/employee/events/[eventId]/route.ts");
const {
  getAssignedEventForEmployeeInTransaction,
  listAssignedEventsForEmployeeInTransaction,
} = await import("../../services/event.service.ts");

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}

const assignedEvent = {
  id: "assignment_1",
  status: AssignmentStatus.PENDING,
  checkedInAt: null,
  checkedOutAt: null,
  completedAt: null,
  rechecks: [
    {
      slotId: "slot_1",
      status: RecheckStatus.PENDING,
      submittedAt: null,
      completedAt: null,
    },
  ],
  event: {
    id: "event_1",
    title: "Warehouse Audit",
    locationName: "Amman Warehouse",
    latitude: decimal(31.9711),
    longitude: decimal(35.9078),
    radiusMeters: 75,
    startsAt: new Date("2026-07-10T09:00:00.000Z"),
    endsAt: new Date("2026-07-10T12:00:00.000Z"),
    status: EventStatus.ACTIVE,
    photoRequired: true,
    checkoutRequired: true,
    recheckSlots: [
      {
        id: "slot_1",
        startsAt: new Date("2026-07-10T10:00:00.000Z"),
        expiresAt: new Date("2026-07-10T10:10:00.000Z"),
      },
    ],
  },
};

test("employee event list route uses the current session user only", async () => {
  let listedEmployeeId: string | null = null;

  const response = await handleEmployeeEventsRequest(
    new Request(
      "http://localhost:3000/api/employee/events?page=1&pageSize=20&employeeId=employee_2",
    ),
    {
      requireEmployeeSession: async () =>
        ({
          user: {
            id: "employee_1",
            role: UserRole.EMPLOYEE,
          },
        }) as never,
      listEvents: async ({ employeeId, query }) => {
        listedEmployeeId = employeeId;

        return {
          items: [
            {
              assignment: {
                id: "assignment_1",
                status: AssignmentStatus.PENDING,
                checkedInAt: null,
                checkedOutAt: null,
                completedAt: null,
              },
              event: {
                id: "event_1",
                name: "Warehouse Audit",
                locationName: "Amman Warehouse",
                latitude: 31.9711,
                longitude: 35.9078,
                radiusMeters: 75,
                startsAt: "2026-07-10T09:00:00.000Z",
                endsAt: "2026-07-10T12:00:00.000Z",
                status: EventStatus.ACTIVE,
                requirePhoto: true,
                requireCheckout: true,
                recheckSlots: [
                  {
                    id: "slot_1",
                    startsAt: "2026-07-10T10:00:00.000Z",
                    expiresAt: "2026-07-10T10:10:00.000Z",
                    status: null,
                    submittedAt: null,
                    completedAt: null,
                  },
                ],
              },
            },
          ],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
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
  assert.equal(listedEmployeeId, "employee_1");
  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].event.id, "event_1");
  assert.equal(body.data.items[0].event.recheckSlots.length, 1);
});

test("employee event detail route returns planned recheck slots for the current user", async () => {
  let loadedEmployeeId: string | null = null;

  const response = await handleEmployeeEventDetailRequest(
    new Request("http://localhost:3000/api/employee/events/event_1"),
    {
      params: Promise.resolve({
        eventId: "event_1",
      }),
    },
    {
      requireEmployeeSession: async () =>
        ({
          user: {
            id: "employee_1",
            role: UserRole.EMPLOYEE,
          },
        }) as never,
      getEvent: async ({ employeeId, eventId }) => {
        loadedEmployeeId = employeeId;

        return {
          assignment: {
            id: "assignment_1",
            status: AssignmentStatus.IN_PROGRESS,
            checkedInAt: "2026-07-10T09:05:00.000Z",
            checkedOutAt: null,
            completedAt: null,
          },
          event: {
            id: eventId,
            name: "Warehouse Audit",
            locationName: "Amman Warehouse",
            latitude: 31.9711,
            longitude: 35.9078,
            radiusMeters: 75,
            startsAt: "2026-07-10T09:00:00.000Z",
            endsAt: "2026-07-10T12:00:00.000Z",
            status: EventStatus.ACTIVE,
            requirePhoto: true,
            requireCheckout: true,
            recheckSlots: [
              {
                id: "slot_1",
                startsAt: "2026-07-10T10:00:00.000Z",
                expiresAt: "2026-07-10T10:10:00.000Z",
                status: null,
                submittedAt: null,
                completedAt: null,
              },
            ],
          },
        };
      },
    },
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(loadedEmployeeId, "employee_1");
  assert.equal(body.data.event.recheckSlots[0].startsAt, "2026-07-10T10:00:00.000Z");
});

test("employee service queries only assigned active or upcoming events", async () => {
  let countWhere: unknown = null;
  let findManyWhere: unknown = null;

  const tx = {
    eventAssignment: {
      count: async ({ where }: { where: unknown }) => {
        countWhere = where;

        return 1;
      },
      findMany: async ({ where }: { where: unknown }) => {
        findManyWhere = where;

        return [assignedEvent];
      },
    },
  };

  const result = await listAssignedEventsForEmployeeInTransaction(tx as never, {
    employeeId: "employee_1",
    query: {
      page: 1,
      pageSize: 20,
    },
    now: new Date("2026-07-10T08:00:00.000Z"),
  });

  assert.deepEqual(countWhere, {
    employeeId: "employee_1",
    event: {
      status: {
        in: [EventStatus.SCHEDULED, EventStatus.ACTIVE],
      },
      endsAt: {
        gte: new Date("2026-07-10T08:00:00.000Z"),
      },
    },
  });
  assert.deepEqual(findManyWhere, countWhere);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].assignment.id, "assignment_1");
  assert.equal(result.items[0].event.id, "event_1");
  assert.equal(result.items[0].event.recheckSlots[0].id, "slot_1");
});

test("employee event detail service includes employee-specific recheck status", async () => {
  const tx = {
    eventAssignment: {
      findFirst: async () => ({
        ...assignedEvent,
        status: AssignmentStatus.IN_PROGRESS,
        rechecks: [
          {
            slotId: "slot_1",
            status: RecheckStatus.SUSPICIOUS,
            submittedAt: new Date("2026-07-10T10:05:00.000Z"),
            completedAt: new Date("2026-07-10T10:05:00.000Z"),
          },
        ],
      }),
    },
  };

  const result = await getAssignedEventForEmployeeInTransaction(tx as never, {
    employeeId: "employee_1",
    eventId: "event_1",
    query: {
      includeEnded: false,
    },
    now: new Date("2026-07-10T08:00:00.000Z"),
  });

  assert.equal(result.event.recheckSlots[0].id, "slot_1");
  assert.equal(result.event.recheckSlots[0].status, RecheckStatus.SUSPICIOUS);
  assert.equal(
    result.event.recheckSlots[0].submittedAt,
    "2026-07-10T10:05:00.000Z",
  );
});
