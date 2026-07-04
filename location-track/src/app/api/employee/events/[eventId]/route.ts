import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../../lib/cache.ts";
import {
  PermissionError,
  requireEmployee,
} from "../../../../../lib/permissions.ts";
import {
  employeeEventDetailQuerySchema,
  eventRouteParamsSchema,
} from "../../../../../lib/validators.ts";
import {
  EventServiceError,
  getAssignedEventForEmployee,
  type EmployeeEventDetailResult,
} from "../../../../../services/event.service.ts";

export const dynamic = "force-dynamic";

type EmployeeEventDetailRouteDeps = {
  requireEmployeeSession: typeof requireEmployee;
  getEvent: typeof getAssignedEventForEmployee;
};

const defaultDeps: EmployeeEventDetailRouteDeps = {
  requireEmployeeSession: requireEmployee,
  getEvent: getAssignedEventForEmployee,
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function handleEmployeeEventDetailRequest(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
  deps: EmployeeEventDetailRouteDeps = defaultDeps,
) {
  try {
    const employeeSession = await deps.requireEmployeeSession();
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

    const searchParams = new URL(request.url).searchParams;
    const query = employeeEventDetailQuerySchema.safeParse({
      includeEnded: searchParams.get("includeEnded") ?? undefined,
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

    const result: EmployeeEventDetailResult = await deps.getEvent({
      employeeId: employeeSession.user.id,
      eventId: params.data.eventId,
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

    if (error instanceof EventServiceError) {
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

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  return handleEmployeeEventDetailRequest(request, context);
}
