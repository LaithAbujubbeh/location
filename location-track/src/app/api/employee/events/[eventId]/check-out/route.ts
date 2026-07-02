import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { PermissionError, requireEmployeeOrAdmin } from "@/lib/permissions";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  checkOutPayloadSchema,
  eventRouteParamsSchema,
} from "@/lib/validators";
import {
  checkOutFromEvent,
  CheckOutServiceError,
} from "@/services/check-out.service";

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

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await requireEmployeeOrAdmin();
    const params = eventRouteParamsSchema.safeParse(await context.params);

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
      policy: rateLimitPolicies.checkOutSubmit,
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

    const parsed = checkOutPayloadSchema.safeParse(body);

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

    const result = await checkOutFromEvent({
      eventId: params.data.eventId,
      session,
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

    if (error instanceof CheckOutServiceError) {
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
