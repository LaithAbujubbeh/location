import { expect, test } from "@playwright/test";
import {
  AssignmentStatus,
  DeviceStatus,
  EventStatus,
  ProofStatus,
  ProofType,
  RecheckStatus,
  UserRole,
} from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:3100";

const eventId = "event_e2e_1";
const assignmentId = "assignment_e2e_1";
const employeeId = "employee_e2e_1";
const adminId = "admin_e2e_1";
const deviceId = "00000000-0000-4000-8000-0000000000e2";
const rawRecheckToken = "raw-e2e-recheck-token-value";

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createAttendanceFlowTx() {
  const event = {
    id: eventId,
    title: "E2E Warehouse Audit",
    locationName: "Amman Warehouse",
    latitude: decimal(31.9711),
    longitude: decimal(35.9078),
    radiusMeters: 75,
    startsAt: new Date("2026-07-10T09:00:00.000Z"),
    endsAt: new Date("2026-07-10T12:00:00.000Z"),
    status: EventStatus.ACTIVE,
    photoRequired: false,
    checkoutRequired: true,
    rechecksEnabled: true,
    recheckCount: 1,
    recheckWindowMinutes: 15,
    createdByUserId: adminId,
    createdAt: new Date("2026-07-10T08:00:00.000Z"),
  };
  const assignment = {
    id: assignmentId,
    eventId,
    employeeId,
    status: AssignmentStatus.PENDING,
    checkedInAt: null as Date | null,
    checkedOutAt: null as Date | null,
    completedAt: null as Date | null,
    failureReason: null as string | null,
    createdAt: new Date("2026-07-10T08:00:00.000Z"),
    event,
  };
  const employee = {
    id: employeeId,
    name: "Maya Haddad",
    email: "maya.e2e@example.com",
  };
  const proofs: Array<{
    id: string;
    assignmentId: string;
    recheckId: string | null;
    type: ProofType;
    status: ProofStatus;
    latitude: ReturnType<typeof decimal>;
    longitude: ReturnType<typeof decimal>;
    accuracyMeters: number;
    distanceMeters: number;
    gpsTimestamp: Date;
    deviceId: string;
    photoUrl: string | null;
    rejectionCode: string | null;
    notes: string | null;
    createdAt: Date;
  }> = [];
  const rechecks: Array<{
    id: string;
    assignmentId: string;
    employeeId: string;
    tokenHash: string | null;
    status: RecheckStatus;
    startsAt: Date;
    expiresAt: Date;
    submittedAt: Date | null;
    completedAt: Date | null;
    notificationSentAt: Date | null;
    proofs: Array<{
      rejectionCode: string | null;
      notes: string | null;
      createdAt: Date;
    }>;
  }> = [];

  const tx = {
    event: {
      findUnique: async () => event,
    },
    eventAssignment: {
      count: async () => 1,
      findUnique: async () => assignment,
      findMany: async () => [assignment],
      updateMany: async ({ data }: { data: Partial<typeof assignment> }) => {
        Object.assign(assignment, data);

        return {
          count: 1,
        };
      },
      update: async ({ data }: { data: Partial<typeof assignment> }) => {
        Object.assign(assignment, data);

        return assignment;
      },
      findUniqueOrThrow: async () => assignment,
    },
    user: {
      findMany: async () => [employee],
    },
    userDevice: {
      findUnique: async () => ({
        id: "trusted_device_e2e_1",
        status: DeviceStatus.TRUSTED,
      }),
      update: async () => ({
        id: "trusted_device_e2e_1",
      }),
    },
    eventProof: {
      create: async ({
        data,
      }: {
        data: {
          assignmentId: string;
          recheckId?: string | null;
          type: ProofType;
          status: ProofStatus;
          latitude: { toString: () => string } | number;
          longitude: { toString: () => string } | number;
          accuracyMeters: number;
          distanceMeters: number;
          gpsTimestamp: Date;
          deviceId: string;
          photoUrl: string | null;
          rejectionCode: string | null;
          notes: string | null;
        };
      }) => {
        const createdAtByType = {
          [ProofType.CHECK_IN]: new Date("2026-07-10T10:00:00.000Z"),
          [ProofType.RECHECK]: new Date("2026-07-10T10:10:00.000Z"),
          [ProofType.CHECK_OUT]: new Date("2026-07-10T10:30:00.000Z"),
        };
        const proof = {
          id: `proof_${proofs.length + 1}`,
          assignmentId: data.assignmentId,
          recheckId: data.recheckId ?? null,
          type: data.type,
          status: data.status,
          latitude: decimal(Number(data.latitude.toString())),
          longitude: decimal(Number(data.longitude.toString())),
          accuracyMeters: data.accuracyMeters,
          distanceMeters: data.distanceMeters,
          gpsTimestamp: data.gpsTimestamp,
          deviceId: data.deviceId,
          photoUrl: data.photoUrl,
          rejectionCode: data.rejectionCode,
          notes: data.notes,
          createdAt: createdAtByType[data.type],
        };

        proofs.push(proof);

        const recheck = rechecks.find((record) => record.id === proof.recheckId);

        if (recheck) {
          recheck.proofs.push({
            rejectionCode: proof.rejectionCode,
            notes: proof.notes,
            createdAt: proof.createdAt,
          });
        }

        return proof;
      },
      findMany: async () => proofs,
    },
    eventRecheck: {
      count: async () => rechecks.length,
      createMany: async ({
        data,
      }: {
        data: Array<{
          assignmentId: string;
          employeeId: string;
          startsAt: Date;
          expiresAt: Date;
          status: RecheckStatus;
        }>;
      }) => {
        for (const record of data) {
          rechecks.push({
            id: `recheck_${rechecks.length + 1}`,
            assignmentId: record.assignmentId,
            employeeId: record.employeeId,
            tokenHash: null,
            status: record.status,
            startsAt: record.startsAt,
            expiresAt: record.expiresAt,
            submittedAt: null,
            completedAt: null,
            notificationSentAt: null,
            proofs: [],
          });
        }

        return {
          count: data.length,
        };
      },
      findUnique: async ({
        where,
      }: {
        where: { tokenHash: string };
      }) => {
        const recheck = rechecks.find(
          (record) => record.tokenHash === where.tokenHash,
        );

        if (!recheck) {
          return null;
        }

        return {
          ...recheck,
          assignment,
        };
      },
      findMany: async () => rechecks,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<(typeof rechecks)[number]>;
      }) => {
        const recheck = rechecks.find((record) => record.id === where.id);

        if (!recheck || recheck.submittedAt) {
          return {
            count: 0,
          };
        }

        Object.assign(recheck, data);

        return {
          count: 1,
        };
      },
    },
  };

  return {
    tx,
    event,
    assignment,
    proofs,
    rechecks,
  };
}

test("admin to employee attendance flow covers check-in, recheck, checkout, and timeline", async () => {
  const { handleAdminCreateEventRequest } = await import(
    "../../app/api/admin/events/route.ts"
  );
  const { checkInToEventInTransaction } = await import(
    "../../services/check-in.service.ts"
  );
  const { getAdminEventTimelineInTransaction } = await import(
    "../../services/event.service.ts"
  );
  const { hashRecheckToken, submitRecheckProofInTransaction } = await import(
    "../../services/recheck.service.ts"
  );
  const { checkOutFromEventInTransaction } = await import(
    "../../services/check-out.service.ts"
  );
  const { tx, assignment, proofs, rechecks } = createAttendanceFlowTx();

  const createResponse = await handleAdminCreateEventRequest(
    jsonRequest("http://127.0.0.1:3100/api/admin/events", {
      name: "E2E Warehouse Audit",
      locationName: "Amman Warehouse",
      latitude: 31.9711,
      longitude: 35.9078,
      radiusMeters: 75,
      startsAt: "2026-07-10T09:00:00.000Z",
      endsAt: "2026-07-10T12:00:00.000Z",
      employeeIds: [employeeId],
      recheckCount: 1,
      recheckWindowMin: 15,
      requirePhoto: false,
      requireCheckout: true,
    }),
    {
      requireAdminSession: async () =>
        ({
          user: {
            id: adminId,
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
      createEvent: async ({ input, createdByUserId }) => ({
        event: {
          id: eventId,
          name: input.name,
          locationName: input.locationName,
          latitude: input.latitude,
          longitude: input.longitude,
          radiusMeters: input.radiusMeters,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          status: EventStatus.ACTIVE,
          requirePhoto: input.requirePhoto,
          requireCheckout: input.requireCheckout,
          recheckCount: input.recheckCount,
          recheckWindowMin: input.recheckWindowMin ?? null,
          createdByUserId,
          createdAt: "2026-07-10T08:00:00.000Z",
        },
        assignedEmployeesCount: input.employeeIds.length,
      }),
    },
  );

  expect(createResponse.status).toBe(201);
  expect((await createResponse.json()).data.assignedEmployeesCount).toBe(1);

  const checkIn = await checkInToEventInTransaction(tx as never, {
    eventId,
    employeeId,
    input: {
      latitude: 31.9711,
      longitude: 35.9078,
      accuracyMeters: 25,
      gpsTimestamp: new Date("2026-07-10T09:59:45.000Z"),
      deviceId,
      photoUrl: null,
    },
    now: new Date("2026-07-10T10:00:00.000Z"),
  });

  expect(checkIn.assignment.status).toBe(AssignmentStatus.IN_PROGRESS);
  expect(checkIn.proof.status).toBe(ProofStatus.ACCEPTED);
  expect(rechecks).toHaveLength(1);
  expect(rechecks[0]).not.toHaveProperty("rawToken");
  expect(rechecks[0].tokenHash).toBeNull();

  rechecks[0].tokenHash = hashRecheckToken(rawRecheckToken);
  rechecks[0].status = RecheckStatus.ACTIVE;
  rechecks[0].startsAt = new Date("2026-07-10T10:05:00.000Z");
  rechecks[0].expiresAt = new Date("2026-07-10T10:20:00.000Z");

  const recheck = await submitRecheckProofInTransaction(tx as never, {
    token: rawRecheckToken,
    employeeId,
    input: {
      latitude: 31.9711,
      longitude: 35.9078,
      accuracyMeters: 30,
      gpsTimestamp: new Date("2026-07-10T10:09:45.000Z"),
      deviceId,
      photoUrl: null,
    },
    now: new Date("2026-07-10T10:10:00.000Z"),
  });

  expect(recheck.recheck.status).toBe(RecheckStatus.PASSED);
  expect(recheck.proof.type).toBe(ProofType.RECHECK);
  expect(rechecks[0].tokenHash).toBe(hashRecheckToken(rawRecheckToken));
  expect(rechecks[0]).not.toHaveProperty("rawToken");

  const checkout = await checkOutFromEventInTransaction(tx as never, {
    eventId,
    employeeId,
    input: {
      latitude: 31.9711,
      longitude: 35.9078,
      accuracyMeters: 25,
      gpsTimestamp: new Date("2026-07-10T10:29:45.000Z"),
      deviceId,
      photoUrl: null,
    },
    now: new Date("2026-07-10T10:30:00.000Z"),
  });

  expect(checkout.assignment.status).toBe(AssignmentStatus.COMPLETED);
  expect(assignment.checkedOutAt?.toISOString()).toBe(
    "2026-07-10T10:30:00.000Z",
  );

  const timeline = await getAdminEventTimelineInTransaction(tx as never, {
    eventId,
    query: {
      page: 1,
      pageSize: 20,
    },
  });

  expect(proofs.map((proof) => proof.type)).toEqual([
    ProofType.CHECK_IN,
    ProofType.RECHECK,
    ProofType.CHECK_OUT,
  ]);
  expect(timeline.assignments[0].status).toBe(AssignmentStatus.COMPLETED);
  expect(timeline.timeline.map((proof) => proof.type)).toEqual([
    ProofType.CHECK_IN,
    ProofType.RECHECK,
    ProofType.CHECK_OUT,
  ]);
  expect(JSON.stringify(timeline)).not.toContain(rawRecheckToken);
  expect(JSON.stringify(timeline)).not.toContain("tokenHash");
});
