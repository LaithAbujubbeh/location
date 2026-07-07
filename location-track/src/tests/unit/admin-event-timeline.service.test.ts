import assert from "node:assert/strict";
import test from "node:test";

import {
  AssignmentStatus,
  EventStatus,
  ProofStatus,
  ProofType,
  RecheckStatus,
} from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const {
  EventServiceError,
  getAdminEventTimelineInTransaction,
  listAdminEventEmployeesInTransaction,
} = await import("../../services/event.service.ts");
const { PermissionError } = await import("../../lib/permissions.ts");
const { handleAdminEventTimelineRequest } = await import(
  "../../app/api/admin/events/[eventId]/timeline/route.ts"
);

type DecimalMock = ReturnType<typeof decimal>;

type TimelineEventRecord = {
  id: string;
  title: string;
  locationName: string | null;
  latitude: DecimalMock;
  longitude: DecimalMock;
  radiusMeters: number;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  photoRequired: boolean;
  checkoutRequired: boolean;
  recheckSlots: Array<{
    id: string;
    startsAt: Date;
    expiresAt: Date;
  }>;
};

type AssignmentRecord = {
  id: string;
  employeeId: string;
  status: AssignmentStatus;
  instructions: string | null;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
};

type ProofRecord = {
  id: string;
  assignmentId: string;
  type: ProofType;
  status: ProofStatus;
  latitude: DecimalMock;
  longitude: DecimalMock;
  accuracyMeters: number;
  distanceMeters: number;
  gpsTimestamp: Date;
  photoUrl: string | null;
  rejectionCode: string | null;
  notes: string | null;
  createdAt: Date;
};

type RecheckRecord = {
  id: string;
  assignmentId: string;
  employeeId: string;
  status: RecheckStatus;
  startsAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  notificationSentAt: Date | null;
  tokenHash?: string;
  rawToken?: string;
  proofs: Array<{
    rejectionCode: string | null;
    notes: string | null;
    createdAt: Date;
  }>;
};

const event: TimelineEventRecord = {
  id: "event_1",
  title: "Warehouse Audit",
  locationName: "Amman Warehouse",
  latitude: decimal(31.9711),
  longitude: decimal(35.9078),
  radiusMeters: 90,
  startsAt: new Date("2026-07-10T08:00:00.000Z"),
  endsAt: new Date("2026-07-10T16:00:00.000Z"),
  status: EventStatus.ACTIVE,
  photoRequired: true,
  checkoutRequired: true,
  recheckSlots: [
    {
      id: "slot_1",
      startsAt: new Date("2026-07-10T11:15:00.000Z"),
      expiresAt: new Date("2026-07-10T11:45:00.000Z"),
    },
  ],
};

const assignmentOne: AssignmentRecord = {
  id: "assignment_1",
  employeeId: "employee_1",
  status: AssignmentStatus.COMPLETED,
  instructions: "Audit the loading bay.",
  checkedInAt: new Date("2026-07-10T08:15:00.000Z"),
  checkedOutAt: new Date("2026-07-10T15:45:00.000Z"),
  failureReason: null,
  createdAt: new Date("2026-07-09T12:00:00.000Z"),
};

const assignmentTwo: AssignmentRecord = {
  id: "assignment_2",
  employeeId: "employee_2",
  status: AssignmentStatus.PENDING,
  instructions: null,
  checkedInAt: null,
  checkedOutAt: null,
  failureReason: null,
  createdAt: new Date("2026-07-09T12:05:00.000Z"),
};

const employees = [
  {
    id: "employee_1",
    name: "Maya Haddad",
    email: "maya@example.com",
  },
  {
    id: "employee_2",
    name: "Omar Saleh",
    email: "omar@example.com",
  },
];

const checkInProof: ProofRecord = {
  id: "proof_check_in",
  assignmentId: "assignment_1",
  type: ProofType.CHECK_IN,
  status: ProofStatus.ACCEPTED,
  latitude: decimal(31.9711),
  longitude: decimal(35.9078),
  accuracyMeters: 20,
  distanceMeters: 5,
  gpsTimestamp: new Date("2026-07-10T08:14:50.000Z"),
  photoUrl: "https://example.com/check-in.jpg",
  rejectionCode: null,
  notes: null,
  createdAt: new Date("2026-07-10T08:15:00.000Z"),
};

const recheckProof: ProofRecord = {
  id: "proof_recheck",
  assignmentId: "assignment_1",
  type: ProofType.RECHECK,
  status: ProofStatus.SUSPICIOUS,
  latitude: decimal(31.9715),
  longitude: decimal(35.9079),
  accuracyMeters: 140,
  distanceMeters: 42,
  gpsTimestamp: new Date("2026-07-10T11:29:50.000Z"),
  photoUrl: "https://example.com/recheck.jpg",
  rejectionCode: null,
  notes: "Location is within the GPS uncertainty range or has low accuracy.",
  createdAt: new Date("2026-07-10T11:30:00.000Z"),
};

const checkOutProof: ProofRecord = {
  id: "proof_check_out",
  assignmentId: "assignment_1",
  type: ProofType.CHECK_OUT,
  status: ProofStatus.ACCEPTED,
  latitude: decimal(31.9711),
  longitude: decimal(35.9078),
  accuracyMeters: 18,
  distanceMeters: 4,
  gpsTimestamp: new Date("2026-07-10T15:44:50.000Z"),
  photoUrl: "https://example.com/check-out.jpg",
  rejectionCode: null,
  notes: null,
  createdAt: new Date("2026-07-10T15:45:00.000Z"),
};

const privateProof: ProofRecord = {
  ...checkInProof,
  id: "proof_private",
  assignmentId: "assignment_2",
};

const recheck: RecheckRecord = {
  id: "recheck_1",
  assignmentId: "assignment_1",
  employeeId: "employee_1",
  status: RecheckStatus.SUSPICIOUS,
  startsAt: new Date("2026-07-10T11:15:00.000Z"),
  expiresAt: new Date("2026-07-10T11:45:00.000Z"),
  submittedAt: new Date("2026-07-10T11:30:00.000Z"),
  notificationSentAt: new Date("2026-07-10T11:15:05.000Z"),
  tokenHash: "should-not-leak",
  rawToken: "should-never-exist",
  proofs: [
    {
      rejectionCode: null,
      notes: "Location is within the GPS uncertainty range or has low accuracy.",
      createdAt: new Date("2026-07-10T11:30:00.000Z"),
    },
  ],
};

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}

function createTimelineTx({
  filteredAssignments = [assignmentOne],
  allProofs = [checkInProof, recheckProof, checkOutProof, privateProof],
  allRechecks = [recheck],
  eventRecord = event,
}: {
  filteredAssignments?: AssignmentRecord[];
  allProofs?: ProofRecord[];
  allRechecks?: RecheckRecord[];
  eventRecord?: TimelineEventRecord | null;
} = {}) {
  const calls: {
    assignmentFindManyWhere?: unknown;
    proofFindManyWhere?: unknown;
    recheckFindManyWhere?: unknown;
  } = {};

  const tx = {
    event: {
      findUnique: async () => eventRecord,
    },
    eventAssignment: {
      count: async () => filteredAssignments.length,
      findMany: async ({ where }: { where: { employeeId?: string } }) => {
        calls.assignmentFindManyWhere = where;

        return filteredAssignments;
      },
    },
    user: {
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] } };
      }) => employees.filter((employee) => where.id.in.includes(employee.id)),
    },
    eventProof: {
      findMany: async ({
        where,
      }: {
        where: { assignmentId: { in: string[] } };
      }) => {
        calls.proofFindManyWhere = where;

        return allProofs.filter((proof) =>
          where.assignmentId.in.includes(proof.assignmentId),
        );
      },
    },
    eventRecheck: {
      findMany: async ({
        where,
      }: {
        where: { assignmentId: { in: string[] } };
      }) => {
        calls.recheckFindManyWhere = where;

        return allRechecks.filter((record) =>
          where.assignmentId.in.includes(record.assignmentId),
        );
      },
    },
  };

  return {
    tx,
    calls,
  };
}

test("admin can view event timeline through the route handler", async () => {
  const response = await handleAdminEventTimelineRequest(
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
          latitude: 31.9539,
          longitude: 35.9106,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          radiusMeters: 90,
          requirePhoto: true,
          requireCheckout: true,
          recheckSlots: [
            {
              id: "slot_1",
              startsAt: "2026-07-10T11:15:00.000Z",
              expiresAt: "2026-07-10T11:45:00.000Z",
            },
          ],
        },
        recheckSlots: [
          {
            id: "slot_1",
            startsAt: "2026-07-10T11:15:00.000Z",
            expiresAt: "2026-07-10T11:45:00.000Z",
          },
        ],
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
  assert.equal((await response.json()).data.event.id, "event_1");
});

test("non-admin cannot view event timeline", async () => {
  const response = await handleAdminEventTimelineRequest(
    new Request("http://localhost:3000/api/admin/events/event_1/timeline"),
    {
      params: Promise.resolve({
        eventId: "event_1",
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
      getTimeline: async () => {
        throw new Error("timeline should not be loaded");
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
});

test("timeline returns check-in, recheck, and checkout proofs with recheck status", async () => {
  const { tx } = createTimelineTx();

  const result = await getAdminEventTimelineInTransaction(tx as never, {
    eventId: "event_1",
    query: {
      page: 1,
      pageSize: 20,
    },
  });

  assert.equal(result.event.id, "event_1");
  assert.equal(result.event.name, "Warehouse Audit");
  assert.equal(result.recheckSlots[0].id, "slot_1");
  assert.equal(result.event.recheckSlots[0].startsAt, "2026-07-10T11:15:00.000Z");
  assert.equal(result.assignments[0].employee?.email, "maya@example.com");
  assert.equal(result.assignments[0].instructions, "Audit the loading bay.");
  assert.deepEqual(
    result.timeline.map((proof) => proof.type),
    [ProofType.CHECK_IN, ProofType.RECHECK, ProofType.CHECK_OUT],
  );
  assert.equal(result.timeline[0].status, ProofStatus.ACCEPTED);
  assert.equal(result.timeline[1].status, ProofStatus.SUSPICIOUS);
  assert.equal(result.timeline[2].status, ProofStatus.ACCEPTED);
  assert.equal(result.rechecks[0].status, RecheckStatus.SUSPICIOUS);
  assert.equal(
    result.rechecks[0].reason,
    "Location is within the GPS uncertainty range or has low accuracy.",
  );
});

test("timeline filters by employeeId and does not leak other assignments", async () => {
  const { tx, calls } = createTimelineTx({
    filteredAssignments: [assignmentOne],
  });

  const result = await getAdminEventTimelineInTransaction(tx as never, {
    eventId: "event_1",
    query: {
      page: 1,
      pageSize: 20,
      employeeId: "employee_1",
    },
  });

  assert.deepEqual(calls.assignmentFindManyWhere, {
    eventId: "event_1",
    employeeId: "employee_1",
  });
  assert.deepEqual(calls.proofFindManyWhere, {
    assignmentId: {
      in: ["assignment_1"],
    },
  });
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].employeeId, "employee_1");
  assert.equal(result.timeline.some((proof) => proof.id === "proof_private"), false);
  assert.equal(result.timeline.every((proof) => proof.employeeId === "employee_1"), true);
});

test("timeline filters by assignment status", async () => {
  const { tx, calls } = createTimelineTx({
    filteredAssignments: [assignmentTwo],
    allProofs: [],
    allRechecks: [],
  });

  const result = await getAdminEventTimelineInTransaction(tx as never, {
    eventId: "event_1",
    query: {
      page: 1,
      pageSize: 20,
      status: AssignmentStatus.PENDING,
    },
  });

  assert.deepEqual(calls.assignmentFindManyWhere, {
    eventId: "event_1",
    status: AssignmentStatus.PENDING,
  });
  assert.equal(result.assignments[0].status, AssignmentStatus.PENDING);
});

test("raw recheck token and token hash are never returned", async () => {
  const { tx } = createTimelineTx();

  const result = await getAdminEventTimelineInTransaction(tx as never, {
    eventId: "event_1",
    query: {
      page: 1,
      pageSize: 20,
    },
  });
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("should-not-leak"), false);
  assert.equal(serialized.includes("should-never-exist"), false);
  assert.equal(serialized.includes("tokenHash"), false);
  assert.equal(serialized.includes("rawToken"), false);
});

test("employees route service returns assignment summaries only", async () => {
  const { tx } = createTimelineTx({
    filteredAssignments: [assignmentOne, assignmentTwo],
  });

  const result = await listAdminEventEmployeesInTransaction(tx as never, {
    eventId: "event_1",
    query: {
      page: 1,
      pageSize: 20,
    },
  });

  assert.equal(result.assignments.length, 2);
  assert.equal(result.assignments[0].assignmentId, "assignment_1");
  assert.equal(result.event.recheckSlots.length, 1);
  assert.equal("proofs" in result.assignments[0], false);
  assert.equal("rechecks" in result.assignments[0], false);
});

test("missing event returns not found", async () => {
  const { tx } = createTimelineTx({
    eventRecord: null,
  });

  await assert.rejects(
    () =>
      getAdminEventTimelineInTransaction(tx as never, {
        eventId: "missing_event",
        query: {
          page: 1,
          pageSize: 20,
        },
      }),
    (error: unknown) =>
      error instanceof EventServiceError && error.code === "EVENT_NOT_FOUND",
  );
});
