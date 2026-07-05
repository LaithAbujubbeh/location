import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../../lib/cache.ts";
import { PermissionError, requireAdmin } from "../../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "../../../../../lib/rate-limit.ts";
import {
  updateAdminUserSchema,
  userRouteParamsSchema,
  type UpdateAdminUserInput,
} from "../../../../../lib/validators.ts";
import {
  getAdminUser,
  updateAdminUser,
  UserServiceError,
  type AdminUserRecord,
} from "../../../../../services/user.service.ts";

export const dynamic = "force-dynamic";

type AdminUserRouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type AdminUserGetDeps = {
  getUser: (userId: string) => Promise<AdminUserRecord>;
  requireAdminSession: typeof requireAdmin;
};

type AdminUserPatchDeps = {
  consumeRateLimit: typeof consumeUserRateLimit;
  requireAdminSession: typeof requireAdmin;
  updateUser: (input: {
    currentAdminId: string;
    input: UpdateAdminUserInput;
    userId: string;
  }) => Promise<{ user: AdminUserRecord }>;
};

const defaultGetDeps: AdminUserGetDeps = {
  getUser: getAdminUser,
  requireAdminSession: requireAdmin,
};

const defaultPatchDeps: AdminUserPatchDeps = {
  consumeRateLimit: consumeUserRateLimit,
  requireAdminSession: requireAdmin,
  updateUser: updateAdminUser,
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

async function parseUserParams(context: AdminUserRouteContext) {
  const params = await context.params;
  const parsed = userRouteParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new UserServiceError(
      400,
      "VALIDATION_ERROR",
      formatValidationError(parsed.error),
    );
  }

  return parsed.data;
}

export async function handleAdminGetUserRequest(
  _request: Request,
  context: AdminUserRouteContext,
  deps: AdminUserGetDeps = defaultGetDeps,
) {
  try {
    await deps.requireAdminSession();

    const params = await parseUserParams(context);
    const user = await deps.getUser(params.userId);

    return apiSuccess({ user }, 200, {
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

export async function handleAdminUpdateUserRequest(
  request: Request,
  context: AdminUserRouteContext,
  deps: AdminUserPatchDeps = defaultPatchDeps,
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

    const params = await parseUserParams(context);
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Request body must be valid JSON.", 400, {
        headers: privateNoStoreHeaders,
      });
    }

    const parsed = updateAdminUserSchema.safeParse(body);

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

    const result = await deps.updateUser({
      currentAdminId: adminSession.user.id,
      input: parsed.data,
      userId: params.userId,
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

export async function GET(request: Request, context: AdminUserRouteContext) {
  return handleAdminGetUserRequest(request, context);
}

export async function PATCH(request: Request, context: AdminUserRouteContext) {
  return handleAdminUpdateUserRequest(request, context);
}
