import {
  AssignmentStatus,
  EventStatus,
  Prisma,
  ProofStatus,
  ProofType,
  RecheckStatus,
  UserRole,
} from "@prisma/client";

import { prisma } from "../lib/prisma.ts";
import type {
  AdminEventTimelineQueryInput,
  CreateEventInput,
  EmployeeEventListQueryInput,
} from "../lib/validators.ts";

export class EventServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "EventServiceError";
    this.status = status;
    this.code = code;
  }
}

export type CreateEventResult = {
  event: {
    id: string;
    name: string;
    locationName: string | null;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    startsAt: string;
    endsAt: string;
    status: EventStatus;
    requirePhoto: boolean;
    requireCheckout: boolean;
    recheckCount: number;
    recheckWindowMin: number | null;
    createdByUserId: string;
    createdAt: string;
  };
  assignedEmployeesCount: number;
};

type CreateEventForAdminArgs = {
  input: CreateEventInput;
  createdByUserId: string;
};

export type EmployeeEventListItem = {
  assignment: {
    id: string;
    status: AssignmentStatus;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    completedAt: string | null;
  };
  event: {
    id: string;
    name: string;
    locationName: string | null;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    startsAt: string;
    endsAt: string;
    status: EventStatus;
    requirePhoto: boolean;
    requireCheckout: boolean;
  };
};

export type EmployeeEventListResult = {
  items: EmployeeEventListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type ListAssignedEventsForEmployeeArgs = {
  employeeId: string;
  query: EmployeeEventListQueryInput;
  now?: Date;
};

export type AdminEventSummary = {
  id: string;
  name: string;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  radiusMeters: number;
  requirePhoto: boolean;
  requireCheckout: boolean;
};

export type AdminAssignmentSummary = {
  assignmentId: string;
  employeeId: string;
  employee: {
    name: string;
    email: string;
  } | null;
  status: AssignmentStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  finalReason: string | null;
};

export type AdminProofTimelineRecord = {
  id: string;
  assignmentId: string;
  employeeId: string;
  type: ProofType;
  status: ProofStatus;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceMeters: number;
  gpsTimestamp: string;
  photoUrl: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdminRecheckTimelineRecord = {
  id: string;
  assignmentId: string;
  employeeId: string;
  status: RecheckStatus;
  startsAt: string;
  expiresAt: string;
  submittedAt: string | null;
  notificationSentAt: string | null;
  reason: string | null;
};

export type AdminEventTimelineAssignment = AdminAssignmentSummary & {
  proofs: AdminProofTimelineRecord[];
  rechecks: AdminRecheckTimelineRecord[];
};

export type AdminEventTimelineResult = {
  event: AdminEventSummary;
  assignments: AdminEventTimelineAssignment[];
  timeline: AdminProofTimelineRecord[];
  rechecks: AdminRecheckTimelineRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type AdminEventEmployeesResult = {
  event: AdminEventSummary;
  assignments: AdminAssignmentSummary[];
  pagination: AdminEventTimelineResult["pagination"];
};

type GetAdminEventTimelineArgs = {
  eventId: string;
  query: AdminEventTimelineQueryInput;
};

const adminEventSummarySelect = {
  id: true,
  title: true,
  locationName: true,
  startsAt: true,
  endsAt: true,
  radiusMeters: true,
  photoRequired: true,
  checkoutRequired: true,
} satisfies Prisma.EventSelect;

const adminAssignmentSelect = {
  id: true,
  employeeId: true,
  status: true,
  checkedInAt: true,
  checkedOutAt: true,
  failureReason: true,
} satisfies Prisma.EventAssignmentSelect;

const adminProofSelect = {
  id: true,
  assignmentId: true,
  type: true,
  status: true,
  latitude: true,
  longitude: true,
  accuracyMeters: true,
  distanceMeters: true,
  gpsTimestamp: true,
  photoUrl: true,
  rejectionCode: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.EventProofSelect;

const adminRecheckSelect = {
  id: true,
  assignmentId: true,
  employeeId: true,
  status: true,
  startsAt: true,
  expiresAt: true,
  submittedAt: true,
  notificationSentAt: true,
  proofs: {
    select: {
      rejectionCode: true,
      notes: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
  },
} satisfies Prisma.EventRecheckSelect;

type SelectedAdminEventSummary = Prisma.EventGetPayload<{
  select: typeof adminEventSummarySelect;
}>;

type SelectedAdminAssignment = Prisma.EventAssignmentGetPayload<{
  select: typeof adminAssignmentSelect;
}>;

type SelectedAdminProof = Prisma.EventProofGetPayload<{
  select: typeof adminProofSelect;
}>;

type SelectedAdminRecheck = Prisma.EventRecheckGetPayload<{
  select: typeof adminRecheckSelect;
}>;

type SelectedAdminEmployee = {
  id: string;
  name: string;
  email: string;
};

function toPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function toAdminEventSummary(event: SelectedAdminEventSummary): AdminEventSummary {
  return {
    id: event.id,
    name: event.title,
    locationName: event.locationName,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    radiusMeters: event.radiusMeters,
    requirePhoto: event.photoRequired,
    requireCheckout: event.checkoutRequired,
  };
}

function proofReason(proof: {
  rejectionCode: string | null;
  notes: string | null;
}) {
  return proof.rejectionCode ?? proof.notes;
}

function recheckReason(recheck: SelectedAdminRecheck) {
  const proof = recheck.proofs[0];

  if (proof) {
    return proofReason(proof);
  }

  if (
    recheck.status === RecheckStatus.MISSED ||
    recheck.status === RecheckStatus.EXPIRED
  ) {
    return "RECHECK_MISSED";
  }

  return null;
}

function toAssignmentSummary(
  assignment: SelectedAdminAssignment,
  employeeById: Map<string, SelectedAdminEmployee>,
): AdminAssignmentSummary {
  const employee = employeeById.get(assignment.employeeId);

  return {
    assignmentId: assignment.id,
    employeeId: assignment.employeeId,
    employee: employee
      ? {
          name: employee.name,
          email: employee.email,
        }
      : null,
    status: assignment.status,
    checkedInAt: assignment.checkedInAt?.toISOString() ?? null,
    checkedOutAt: assignment.checkedOutAt?.toISOString() ?? null,
    finalReason: assignment.failureReason,
  };
}

function toProofTimelineRecord(
  proof: SelectedAdminProof,
  employeeIdByAssignmentId: Map<string, string>,
): AdminProofTimelineRecord {
  return {
    id: proof.id,
    assignmentId: proof.assignmentId,
    employeeId: employeeIdByAssignmentId.get(proof.assignmentId) ?? "",
    type: proof.type,
    status: proof.status,
    latitude: proof.latitude.toNumber(),
    longitude: proof.longitude.toNumber(),
    accuracyMeters: proof.accuracyMeters,
    distanceMeters: proof.distanceMeters,
    gpsTimestamp: proof.gpsTimestamp.toISOString(),
    photoUrl: proof.photoUrl,
    reason: proofReason(proof),
    createdAt: proof.createdAt.toISOString(),
  };
}

function toRecheckTimelineRecord(
  recheck: SelectedAdminRecheck,
): AdminRecheckTimelineRecord {
  return {
    id: recheck.id,
    assignmentId: recheck.assignmentId,
    employeeId: recheck.employeeId,
    status: recheck.status,
    startsAt: recheck.startsAt.toISOString(),
    expiresAt: recheck.expiresAt.toISOString(),
    submittedAt: recheck.submittedAt?.toISOString() ?? null,
    notificationSentAt: recheck.notificationSentAt?.toISOString() ?? null,
    reason: recheckReason(recheck),
  };
}

function assignmentWhere({
  eventId,
  query,
}: GetAdminEventTimelineArgs): Prisma.EventAssignmentWhereInput {
  return {
    eventId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
  };
}

export async function buildAdminEventTimelineResult({
  event,
  assignments,
  proofs,
  rechecks,
  employees,
  query,
  total,
}: {
  event: SelectedAdminEventSummary;
  assignments: SelectedAdminAssignment[];
  proofs: SelectedAdminProof[];
  rechecks: SelectedAdminRecheck[];
  employees: SelectedAdminEmployee[];
  query: AdminEventTimelineQueryInput;
  total: number;
}): Promise<AdminEventTimelineResult> {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const employeeIdByAssignmentId = new Map(
    assignments.map((assignment) => [assignment.id, assignment.employeeId]),
  );
  const proofsByAssignmentId = new Map<string, AdminProofTimelineRecord[]>();
  const rechecksByAssignmentId = new Map<string, AdminRecheckTimelineRecord[]>();
  const timeline = proofs.map((proof) =>
    toProofTimelineRecord(proof, employeeIdByAssignmentId),
  );
  const recheckRecords = rechecks.map(toRecheckTimelineRecord);

  for (const proof of timeline) {
    const assignmentProofs = proofsByAssignmentId.get(proof.assignmentId) ?? [];
    assignmentProofs.push(proof);
    proofsByAssignmentId.set(proof.assignmentId, assignmentProofs);
  }

  for (const recheck of recheckRecords) {
    const assignmentRechecks =
      rechecksByAssignmentId.get(recheck.assignmentId) ?? [];
    assignmentRechecks.push(recheck);
    rechecksByAssignmentId.set(recheck.assignmentId, assignmentRechecks);
  }

  return {
    event: toAdminEventSummary(event),
    assignments: assignments.map((assignment) => ({
      ...toAssignmentSummary(assignment, employeeById),
      proofs: proofsByAssignmentId.get(assignment.id) ?? [],
      rechecks: rechecksByAssignmentId.get(assignment.id) ?? [],
    })),
    timeline,
    rechecks: recheckRecords,
    pagination: toPagination({
      page: query.page,
      pageSize: query.pageSize,
      total,
    }),
  };
}

export async function createEventForAdmin({
  input,
  createdByUserId,
}: CreateEventForAdminArgs): Promise<CreateEventResult> {
  return prisma.$transaction(async (tx) => {
    const employeeCount = await tx.user.count({
      where: {
        id: {
          in: input.employeeIds,
        },
        role: UserRole.EMPLOYEE,
      },
    });

    if (employeeCount !== input.employeeIds.length) {
      throw new EventServiceError(
        400,
        "INVALID_EMPLOYEES",
        "One or more employeeIds do not belong to an employee user.",
      );
    }

    const recheckWindowMinutes =
      input.recheckCount > 0 ? input.recheckWindowMin ?? null : null;

    const event = await tx.event.create({
      data: {
        title: input.name,
        locationName: input.locationName,
        latitude: new Prisma.Decimal(input.latitude),
        longitude: new Prisma.Decimal(input.longitude),
        radiusMeters: input.radiusMeters,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        photoRequired: input.requirePhoto,
        checkoutRequired: input.requireCheckout,
        rechecksEnabled: input.recheckCount > 0,
        recheckCount: input.recheckCount,
        recheckWindowMinutes,
        createdByUserId,
      },
      select: {
        id: true,
        title: true,
        locationName: true,
        latitude: true,
        longitude: true,
        radiusMeters: true,
        startsAt: true,
        endsAt: true,
        status: true,
        photoRequired: true,
        checkoutRequired: true,
        recheckCount: true,
        recheckWindowMinutes: true,
        createdByUserId: true,
        createdAt: true,
      },
    });

    const assignments = await tx.eventAssignment.createMany({
      data: input.employeeIds.map((employeeId) => ({
        eventId: event.id,
        employeeId,
      })),
    });

    return {
      event: {
        id: event.id,
        name: event.title,
        locationName: event.locationName,
        latitude: event.latitude.toNumber(),
        longitude: event.longitude.toNumber(),
        radiusMeters: event.radiusMeters,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        status: event.status,
        requirePhoto: event.photoRequired,
        requireCheckout: event.checkoutRequired,
        recheckCount: event.recheckCount,
        recheckWindowMin: event.recheckWindowMinutes,
        createdByUserId: event.createdByUserId,
        createdAt: event.createdAt.toISOString(),
      },
      assignedEmployeesCount: assignments.count,
    };
  });
}

export async function listAssignedEventsForEmployee({
  employeeId,
  query,
  now = new Date(),
}: ListAssignedEventsForEmployeeArgs): Promise<EmployeeEventListResult> {
  return prisma.$transaction((tx) =>
    listAssignedEventsForEmployeeInTransaction(tx, {
      employeeId,
      query,
      now,
    }),
  );
}

export async function listAssignedEventsForEmployeeInTransaction(
  tx: Prisma.TransactionClient,
  {
    employeeId,
    query,
    now = new Date(),
  }: ListAssignedEventsForEmployeeArgs,
): Promise<EmployeeEventListResult> {
  const where: Prisma.EventAssignmentWhereInput = {
    employeeId,
    event: {
      status: {
        in: [EventStatus.SCHEDULED, EventStatus.ACTIVE],
      },
      endsAt: {
        gte: now,
      },
    },
  };

  const skip = (query.page - 1) * query.pageSize;

  const [total, assignments] = await Promise.all([
    tx.eventAssignment.count({ where }),
    tx.eventAssignment.findMany({
      where,
      orderBy: [
        {
          event: {
            startsAt: "asc",
          },
        },
        {
          createdAt: "asc",
        },
      ],
      skip,
      take: query.pageSize,
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        checkedOutAt: true,
        completedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            locationName: true,
            latitude: true,
            longitude: true,
            radiusMeters: true,
            startsAt: true,
            endsAt: true,
            status: true,
            photoRequired: true,
            checkoutRequired: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / query.pageSize);

  return {
    items: assignments.map((assignment) => ({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        checkedInAt: assignment.checkedInAt?.toISOString() ?? null,
        checkedOutAt: assignment.checkedOutAt?.toISOString() ?? null,
        completedAt: assignment.completedAt?.toISOString() ?? null,
      },
      event: {
        id: assignment.event.id,
        name: assignment.event.title,
        locationName: assignment.event.locationName,
        latitude: assignment.event.latitude.toNumber(),
        longitude: assignment.event.longitude.toNumber(),
        radiusMeters: assignment.event.radiusMeters,
        startsAt: assignment.event.startsAt.toISOString(),
        endsAt: assignment.event.endsAt.toISOString(),
        status: assignment.event.status,
        requirePhoto: assignment.event.photoRequired,
        requireCheckout: assignment.event.checkoutRequired,
      },
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    },
  };
}

export async function getAdminEventTimeline({
  eventId,
  query,
}: GetAdminEventTimelineArgs): Promise<AdminEventTimelineResult> {
  return prisma.$transaction((tx) =>
    getAdminEventTimelineInTransaction(tx, { eventId, query }),
  );
}

export async function getAdminEventTimelineInTransaction(
  tx: Prisma.TransactionClient,
  { eventId, query }: GetAdminEventTimelineArgs,
): Promise<AdminEventTimelineResult> {
  const event = await tx.event.findUnique({
    where: {
      id: eventId,
    },
    select: adminEventSummarySelect,
  });

  if (!event) {
    throw new EventServiceError(404, "EVENT_NOT_FOUND", "Event not found.");
  }

  const where = assignmentWhere({ eventId, query });
  const skip = (query.page - 1) * query.pageSize;
  const [total, assignments] = await Promise.all([
    tx.eventAssignment.count({ where }),
    tx.eventAssignment.findMany({
      where,
      orderBy: [
        {
          checkedInAt: "asc",
        },
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
      skip,
      take: query.pageSize,
      select: adminAssignmentSelect,
    }),
  ]);
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const employeeIds = [...new Set(assignments.map((assignment) => assignment.employeeId))];

  const [employees, proofs, rechecks] =
    assignmentIds.length > 0
      ? await Promise.all([
          tx.user.findMany({
            where: {
              id: {
                in: employeeIds,
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          }),
          tx.eventProof.findMany({
            where: {
              assignmentId: {
                in: assignmentIds,
              },
            },
            orderBy: [
              {
                createdAt: "asc",
              },
              {
                id: "asc",
              },
            ],
            select: adminProofSelect,
          }),
          tx.eventRecheck.findMany({
            where: {
              assignmentId: {
                in: assignmentIds,
              },
            },
            orderBy: [
              {
                startsAt: "asc",
              },
              {
                id: "asc",
              },
            ],
            select: adminRecheckSelect,
          }),
        ])
      : [[], [], []];

  return buildAdminEventTimelineResult({
    event,
    assignments,
    proofs,
    rechecks,
    employees,
    query,
    total,
  });
}

export async function listAdminEventEmployees({
  eventId,
  query,
}: GetAdminEventTimelineArgs): Promise<AdminEventEmployeesResult> {
  return prisma.$transaction((tx) =>
    listAdminEventEmployeesInTransaction(tx, { eventId, query }),
  );
}

export async function listAdminEventEmployeesInTransaction(
  tx: Prisma.TransactionClient,
  { eventId, query }: GetAdminEventTimelineArgs,
): Promise<AdminEventEmployeesResult> {
  const event = await tx.event.findUnique({
    where: {
      id: eventId,
    },
    select: adminEventSummarySelect,
  });

  if (!event) {
    throw new EventServiceError(404, "EVENT_NOT_FOUND", "Event not found.");
  }

  const where = assignmentWhere({ eventId, query });
  const skip = (query.page - 1) * query.pageSize;
  const [total, assignments] = await Promise.all([
    tx.eventAssignment.count({ where }),
    tx.eventAssignment.findMany({
      where,
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
      skip,
      take: query.pageSize,
      select: adminAssignmentSelect,
    }),
  ]);
  const employeeIds = [...new Set(assignments.map((assignment) => assignment.employeeId))];
  const employees =
    employeeIds.length > 0
      ? await tx.user.findMany({
          where: {
            id: {
              in: employeeIds,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  return {
    event: toAdminEventSummary(event),
    assignments: assignments.map((assignment) =>
      toAssignmentSummary(assignment, employeeById),
    ),
    pagination: toPagination({
      page: query.page,
      pageSize: query.pageSize,
      total,
    }),
  };
}
