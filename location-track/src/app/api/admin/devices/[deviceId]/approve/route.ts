import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { PermissionError, requireAdmin } from "@/lib/permissions";
import { deviceRouteParamsSchema } from "@/lib/validators";
import {
  approveUserDevice,
  DeviceServiceError,
} from "@/services/device.service";

export const dynamic = "force-dynamic";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

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

    const device = await approveUserDevice({
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
