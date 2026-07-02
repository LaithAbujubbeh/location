import { AssignmentStatus, EventStatus, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CreateEventInput,
  EmployeeEventListQueryInput,
} from "@/lib/validators";

export class EventServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EventServiceError";
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

  const [total, assignments] = await prisma.$transaction([
    prisma.eventAssignment.count({ where }),
    prisma.eventAssignment.findMany({
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
