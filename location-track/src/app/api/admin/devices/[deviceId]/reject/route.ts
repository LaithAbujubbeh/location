import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { privateNoStoreHeaders } from "@/lib/cache";
import { PermissionError, requireAdmin } from "@/lib/permissions";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { deviceRouteParamsSchema } from "@/lib/validators";
import {
  DeviceServiceError,
  rejectUserDevice,
} from "@/services/device.service";

export const dynamic = "force-dynamic";

type DeviceRouteContext = {
  params: Promise<{
    deviceId: string;
  }>;
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function POST(_request: Request, context: DeviceRouteContext) {
  try {
    const adminSession = await requireAdmin();
    const rateLimit = await consumeUserRateLimit({
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

    const device = await rejectUserDevice({
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
