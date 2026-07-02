import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { PermissionError, requireUser } from "@/lib/permissions";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { registerDeviceSchema } from "@/lib/validators";
import { getOrCreateUserDevice } from "@/services/device.service";

export const dynamic = "force-dynamic";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const rateLimit = await consumeUserRateLimit({
      policy: rateLimitPolicies.deviceRegistration,
      userId: session.user.id,
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

    const parsed = registerDeviceSchema.safeParse(body);

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

    const result = await getOrCreateUserDevice({
      userId: session.user.id,
      deviceId: parsed.data.deviceId,
      label: parsed.data.label,
      userAgent: request.headers.get("user-agent"),
    });

    return apiSuccess(result, result.created ? 201 : 200, {
      headers: privateNoStoreHeaders,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
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
