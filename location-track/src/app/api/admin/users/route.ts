import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../lib/cache.ts";
import { PermissionError, requireAdmin } from "../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "../../../../lib/rate-limit.ts";
import {
  adminUserListQuerySchema,
  createAdminUserSchema,
  type AdminUserListQueryInput,
  type CreateAdminUserInput,
} from "../../../../lib/validators.ts";
import {
  createAdminUser,
  listAdminUsers,
  UserServiceError,
  type AdminUserListResult,
  type AdminUserRecord,
} from "../../../../services/user.service.ts";

export const dynamic = "force-dynamic";

type AdminUsersListDeps = {
  listUsers: (input: {
    query: AdminUserListQueryInput;
  }) => Promise<AdminUserListResult>;
  requireAdminSession: typeof requireAdmin;
};

type AdminUsersCreateDeps = {
  consumeRateLimit: typeof consumeUserRateLimit;
  createUser: (input: {
    input: CreateAdminUserInput;
  }) => Promise<{ user: AdminUserRecord }>;
  requireAdminSession: typeof requireAdmin;
};

const defaultListDeps: AdminUsersListDeps = {
  listUsers: listAdminUsers,
  requireAdminSession: requireAdmin,
};

const defaultCreateDeps: AdminUsersCreateDeps = {
  consumeRateLimit: consumeUserRateLimit,
  createUser: createAdminUser,
  requireAdminSession: requireAdmin,
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function handleAdminListUsersRequest(
  request: Request,
  deps: AdminUsersListDeps = defaultListDeps,
) {
  try {
    await deps.requireAdminSession();

    const searchParams = new URL(request.url).searchParams;
    const query = adminUserListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    if (!query.success) {
      return apiError(
        "VALIDATION_ERROR",
        formatValidationError(query.error),
        400,
        {
          headers: privateNoStoreHeaders,
        },
      );
    }

    const result = await deps.listUsers({
      query: query.data,
    });

    return apiSuccess(result, 200, {
      headers: privateNoStoreHeaders,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.code, error.message, error.status, {
        headers: privateNoStoreHeaders,
      });
    }

    if (error instanceof UserServiceError) {
      return apiError(error.code, error.message, error.status, {
        headers: privateNoStoreHeaders,
      });
    }

    console.error(error);

    return apiError("INTERNAL_SERVER_ERROR", "Something went wrong.", 500, {
      headers: privateNoStoreHeaders,
    });
  }
}

export async function handleAdminCreateUserRequest(
  request: Request,
  deps: AdminUsersCreateDeps = defaultCreateDeps,
) {
  try {
    const adminSession = await deps.requireAdminSession();
    const rateLimit = await deps.consumeRateLimit({
      policy: rateLimitPolicies.adminUserMutation,
      userId: adminSession.user.id,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, {
        headers: privateNoStoreHeaders,
      });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Request body must be valid JSON.", 400, {
        headers: privateNoStoreHeaders,
      });
    }

    const parsed = createAdminUserSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        formatValidationError(parsed.error),
        400,
        {
          headers: privateNoStoreHeaders,
        },
      );
    }

    const result = await deps.createUser({
      input: parsed.data,
    });

    return apiSuccess(result, 201, {
      headers: privateNoStoreHeaders,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.code, error.message, error.status, {
        headers: privateNoStoreHeaders,
      });
    }

    if (error instanceof UserServiceError) {
      return apiError(error.code, error.message, error.status, {
        headers: privateNoStoreHeaders,
      });
    }

    console.error(error);

    return apiError("INTERNAL_SERVER_ERROR", "Something went wrong.", 500, {
      headers: privateNoStoreHeaders,
    });
  }
}

export async function GET(request: Request) {
  return handleAdminListUsersRequest(request);
}

export async function POST(request: Request) {
  return handleAdminCreateUserRequest(request);
}
