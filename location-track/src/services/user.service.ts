import { Prisma, UserRole } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "../lib/prisma.ts";
import type {
  AdminUserListQueryInput,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from "../lib/validators.ts";

export class UserServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "UserServiceError";
    this.status = status;
    this.code = code;
  }
}

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListResult = {
  items: AdminUserRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type ListAdminUsersArgs = {
  query: AdminUserListQueryInput;
};

type CreateAdminUserArgs = {
  input: CreateAdminUserInput;
};

type UpdateAdminUserArgs = {
  currentAdminId: string;
  input: UpdateAdminUserInput;
  userId: string;
};

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type SelectedAdminUser = Prisma.UserGetPayload<{
  select: typeof adminUserSelect;
}>;

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

function toAdminUserRecord(user: SelectedAdminUser): AdminUserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function userWhere(query: AdminUserListQueryInput): Prisma.UserWhereInput {
  const search = query.search?.trim();

  return {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function listAdminUsers({
  query,
}: ListAdminUsersArgs): Promise<AdminUserListResult> {
  const where = userWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
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
      select: adminUserSelect,
    }),
  ]);

  return {
    items: users.map(toAdminUserRecord),
    pagination: toPagination({
      page: query.page,
      pageSize: query.pageSize,
      total,
    }),
  };
}

export async function getAdminUser(userId: string): Promise<AdminUserRecord> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: adminUserSelect,
  });

  if (!user) {
    throw new UserServiceError(404, "USER_NOT_FOUND", "User not found.");
  }

  return toAdminUserRecord(user);
}

export async function createAdminUser({
  input,
}: CreateAdminUserArgs): Promise<{ user: AdminUserRecord }> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          isActive: input.isActive,
          role: input.role,
          emailVerified: false,
        },
        select: adminUserSelect,
      });

      await tx.account.create({
        data: {
          accountId: createdUser.id,
          providerId: "credential",
          userId: createdUser.id,
          password: passwordHash,
        },
      });

      return createdUser;
    });

    return {
      user: toAdminUserRecord(user),
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UserServiceError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "A user with this email already exists.",
      );
    }

    throw error;
  }
}

export async function updateAdminUser({
  currentAdminId,
  input,
  userId,
}: UpdateAdminUserArgs): Promise<{ user: AdminUserRecord }> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      isActive: true,
      role: true,
    },
  });

  if (!user) {
    throw new UserServiceError(404, "USER_NOT_FOUND", "User not found.");
  }

  if (
    user.id === currentAdminId &&
    user.role === UserRole.ADMIN &&
    input.role === UserRole.EMPLOYEE
  ) {
    throw new UserServiceError(
      400,
      "SELF_DEMOTION_NOT_ALLOWED",
      "You cannot remove your own administrator role.",
    );
  }

  if (
    user.id === currentAdminId &&
    user.role === UserRole.ADMIN &&
    !input.isActive
  ) {
    throw new UserServiceError(
      400,
      "SELF_DEACTIVATION_NOT_ALLOWED",
      "You cannot deactivate your own administrator account.",
    );
  }

  const removesActiveAdmin =
    user.role === UserRole.ADMIN &&
    user.isActive &&
    (input.role === UserRole.EMPLOYEE || !input.isActive);

  if (removesActiveAdmin) {
    const adminCount = await prisma.user.count({
      where: {
        isActive: true,
        role: UserRole.ADMIN,
      },
    });

    if (adminCount <= 1) {
      if (input.role === UserRole.EMPLOYEE) {
        throw new UserServiceError(
          400,
          "LAST_ADMIN_DEMOTION_NOT_ALLOWED",
          "The last administrator cannot be demoted.",
        );
      }

      throw new UserServiceError(
        400,
        "LAST_ACTIVE_ADMIN_REQUIRED",
        "At least one active administrator is required.",
      );
    }
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      isActive: input.isActive,
      name: input.name,
      role: input.role,
    },
    select: adminUserSelect,
  });

  return {
    user: toAdminUserRecord(updatedUser),
  };
}
