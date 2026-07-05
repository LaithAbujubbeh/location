import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../../../lib/cache.ts";
import {
  PermissionError,
  requireEmployee,
} from "../../../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "../../../../../../lib/rate-limit.ts";
import {
  checkOutPayloadSchema,
  type CheckOutPayloadInput,
  eventRouteParamsSchema,
} from "../../../../../../lib/validators.ts";
import {
  checkOutFromEvent,
  CheckOutServiceError,
  type CheckOutResult,
} from "../../../../../../services/check-out.service.ts";

export const dynamic = "force-dynamic";

type CheckOutRouteDeps = {
  requireEmployeeSession: typeof requireEmployee;
  consumeRateLimit: typeof consumeUserRateLimit;
  checkOut: (input: {
    eventId: string;
    session: Awaited<ReturnType<typeof requireEmployee>>;
    input: CheckOutPayloadInput;
    userAgent?: string | null;
  }) => Promise<CheckOutResult>;
};

const defaultDeps: CheckOutRouteDeps = {
  requireEmployeeSession: requireEmployee,
  consumeRateLimit: consumeUserRateLimit,
  checkOut: checkOutFromEvent,
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function handleEmployeeCheckOutRequest(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
  deps: CheckOutRouteDeps = defaultDeps,
) {
  try {
    const session = await deps.requireEmployeeSession();
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

    const rateLimit = await deps.consumeRateLimit({
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

    const result = await deps.checkOut({
      eventId: params.data.eventId,
      session,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  return handleEmployeeCheckOutRequest(request, context);
}
