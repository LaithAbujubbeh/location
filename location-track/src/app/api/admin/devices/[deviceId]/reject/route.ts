import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../../../lib/cache.ts";
import {
  PermissionError,
  requireAdmin,
} from "../../../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "../../../../../../lib/rate-limit.ts";
import { deviceRouteParamsSchema } from "../../../../../../lib/validators.ts";
import {
  DeviceServiceError,
  rejectUserDevice,
  type DeviceRecord,
} from "../../../../../../services/device.service.ts";

export const dynamic = "force-dynamic";

type DeviceRouteContext = {
  params: Promise<{
    deviceId: string;
  }>;
};

type AdminDeviceRejectDeps = {
  consumeRateLimit: typeof consumeUserRateLimit;
  rejectDevice: (input: {
    userDeviceId: string;
    reviewedByUserId: string;
  }) => Promise<DeviceRecord>;
  requireAdminSession: typeof requireAdmin;
};

const defaultDeps: AdminDeviceRejectDeps = {
  consumeRateLimit: consumeUserRateLimit,
  rejectDevice: rejectUserDevice,
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

export async function handleAdminRejectDeviceRequest(
  _request: Request,
  context: DeviceRouteContext,
  deps: AdminDeviceRejectDeps = defaultDeps,
) {
  try {
    const adminSession = await deps.requireAdminSession();
    const rateLimit = await deps.consumeRateLimit({
      policy: rateLimitPolicies.adminDeviceReview,
      userId: adminSession.user.id,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, {
        headers: privateNoStoreHeaders,
      });
    }

    const params = await context.params;
    const parsed = deviceRouteParamsSchema.safeParse(params);

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

    const device = await deps.rejectDevice({
      userDeviceId: parsed.data.deviceId,
      reviewedByUserId: adminSession.user.id,
    });

    return apiSuccess({ device }, 200, {
      headers: privateNoStoreHeaders,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return apiError(error.code, error.message, error.status, {
        headers: privateNoStoreHeaders,
      });
    }

    if (error instanceof DeviceServiceError) {
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

export async function POST(request: Request, context: DeviceRouteContext) {
  return handleAdminRejectDeviceRequest(request, context);
}
