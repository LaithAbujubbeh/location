import { EventStatus, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CreateEventInput } from "@/lib/validators";

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
