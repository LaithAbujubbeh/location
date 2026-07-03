import { DeviceStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { AdminDeviceListQueryInput } from "@/lib/validators";

export class DeviceServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeviceServiceError";
  }
}

const userDeviceSelect = {
  id: true,
  userId: true,
  deviceId: true,
  status: true,
  label: true,
  userAgent: true,
  firstSeenAt: true,
  lastSeenAt: true,
  approvedAt: true,
  rejectedAt: true,
  reviewedByUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserDeviceSelect;

type SelectedUserDevice = Prisma.UserDeviceGetPayload<{
  select: typeof userDeviceSelect;
}>;

export type DeviceRecord = {
  id: string;
  userId: string;
  deviceId: string;
  status: DeviceStatus;
  label: string | null;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceRegistrationResult = {
  device: DeviceRecord;
  created: boolean;
  trusted: boolean;
  firstDeviceTrusted: boolean;
};

export type AdminDeviceListResult = {
  items: Array<
    DeviceRecord & {
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
      } | null;
    }
  >;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type GetOrCreateUserDeviceArgs = {
  userId: string;
  deviceId: string;
  userAgent?: string | null;
  label?: string | null;
};

type CheckDeviceTrustedArgs = {
  userId: string;
  deviceId: string;
};

type ReviewDeviceArgs = {
  userDeviceId: string;
  reviewedByUserId: string;
};

function toDeviceRecord(device: SelectedUserDevice): DeviceRecord {
  return {
    id: device.id,
    userId: device.userId,
    deviceId: device.deviceId,
    status: device.status,
    label: device.label,
    userAgent: device.userAgent,
    firstSeenAt: device.firstSeenAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
    approvedAt: device.approvedAt?.toISOString() ?? null,
    rejectedAt: device.rejectedAt?.toISOString() ?? null,
    reviewedByUserId: device.reviewedByUserId,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

function isKnownPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function registrationResult(
  device: SelectedUserDevice,
  created: boolean,
  firstDeviceTrusted: boolean,
): DeviceRegistrationResult {
  return {
    device: toDeviceRecord(device),
    created,
    trusted: device.status === DeviceStatus.TRUSTED,
    firstDeviceTrusted,
  };
}

export async function getOrCreateUserDevice({
  userId,
  deviceId,
  userAgent,
  label,
}: GetOrCreateUserDeviceArgs): Promise<DeviceRegistrationResult> {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const existingDevice = await tx.userDevice.findUnique({
        where: {
          userId_deviceId: {
            userId,
            deviceId,
          },
        },
        select: userDeviceSelect,
      });

      if (existingDevice) {
        const updatedDevice = await tx.userDevice.update({
          where: {
            id: existingDevice.id,
          },
          data: {
            lastSeenAt: now,
            ...(userAgent !== undefined ? { userAgent } : {}),
            ...(label !== undefined ? { label } : {}),
          },
          select: userDeviceSelect,
        });

        return registrationResult(updatedDevice, false, false);
      }

      const existingUserDevice = await tx.userDevice.findFirst({
        where: {
          userId,
        },
        select: {
          id: true,
        },
      });
      const shouldTrustDevice = !existingUserDevice;

      const createdDevice = await tx.userDevice.create({
        data: {
          userId,
          deviceId,
          status: shouldTrustDevice ? DeviceStatus.TRUSTED : DeviceStatus.PENDING,
          label,
          userAgent,
          firstSeenAt: now,
          lastSeenAt: now,
          approvedAt: shouldTrustDevice ? now : null,
        },
        select: userDeviceSelect,
      });

      return registrationResult(createdDevice, true, shouldTrustDevice);
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      return getOrCreateUserDevice({ userId, deviceId, userAgent, label });
    }

    throw error;
  }
}

export async function isDeviceTrusted({
  userId,
  deviceId,
}: CheckDeviceTrustedArgs): Promise<boolean> {
  const device = await prisma.userDevice.findUnique({
    where: {
      userId_deviceId: {
        userId,
        deviceId,
      },
    },
    select: {
      status: true,
    },
  });

  return device?.status === DeviceStatus.TRUSTED;
}

export async function listDevicesForAdmin({
  query,
}: {
  query: AdminDeviceListQueryInput;
}): Promise<AdminDeviceListResult> {
  const where: Prisma.UserDeviceWhereInput = {
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;

  const [total, devices] = await prisma.$transaction([
    prisma.userDevice.count({ where }),
    prisma.userDevice.findMany({
      where,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "asc",
        },
      ],
      skip,
      take: query.pageSize,
      select: userDeviceSelect,
    }),
  ]);

  const userIds = [...new Set(devices.map((device) => device.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        })
      : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const totalPages = Math.ceil(total / query.pageSize);

  return {
    items: devices.map((device) => ({
      ...toDeviceRecord(device),
      user: userById.get(device.userId) ?? null,
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

export async function approveUserDevice({
  userDeviceId,
  reviewedByUserId,
}: ReviewDeviceArgs): Promise<DeviceRecord> {
  const now = new Date();

  try {
    const device = await prisma.userDevice.update({
      where: {
        id: userDeviceId,
      },
      data: {
        status: DeviceStatus.TRUSTED,
        approvedAt: now,
        rejectedAt: null,
        reviewedByUserId,
      },
      select: userDeviceSelect,
    });

    return toDeviceRecord(device);
  } catch (error) {
    if (isKnownPrismaError(error, "P2025")) {
      throw new DeviceServiceError(404, "DEVICE_NOT_FOUND", "Device not found.");
    }

    throw error;
  }
}

export async function rejectUserDevice({
  userDeviceId,
  reviewedByUserId,
}: ReviewDeviceArgs): Promise<DeviceRecord> {
  const now = new Date();

  try {
    const device = await prisma.userDevice.update({
      where: {
        id: userDeviceId,
      },
      data: {
        status: DeviceStatus.REJECTED,
        approvedAt: null,
        rejectedAt: now,
        reviewedByUserId,
      },
      select: userDeviceSelect,
    });

    return toDeviceRecord(device);
  } catch (error) {
    if (isKnownPrismaError(error, "P2025")) {
      throw new DeviceServiceError(404, "DEVICE_NOT_FOUND", "Device not found.");
    }

    throw error;
  }
}
