import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { privateNoStoreHeaders } from "@/lib/cache";
import { PermissionError, requireEmployee } from "@/lib/permissions";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  employeeRecheckRouteParamsSchema,
  recheckSubmitPayloadSchema,
} from "@/lib/validators";
import {
  RecheckServiceError,
  submitEmployeeRecheckSlotProof,
} from "@/services/recheck.service";

export const dynamic = "force-dynamic";

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string; slotId: string }> },
) {
  try {
    const employeeSession = await requireEmployee();
    const params = employeeRecheckRouteParamsSchema.safeParse(
      await context.params,
    );

    if (!params.success) {
      return apiError(
        "VALIDATION_ERROR",
        formatValidationError(params.error),
        400,
        {
          headers: privateNoStoreHeaders,
        },
      );
    }

    const rateLimit = await consumeUserRateLimit({
      policy: rateLimitPolicies.recheckSubmit,
      userId: employeeSession.user.id,
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

    const parsed = recheckSubmitPayloadSchema.safeParse(body);

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

    const result = await submitEmployeeRecheckSlotProof({
      eventId: params.data.eventId,
      slotId: params.data.slotId,
      session: employeeSession,
      input: parsed.data,
      userAgent: request.headers.get("user-agent"),
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

    if (error instanceof RecheckServiceError) {
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
