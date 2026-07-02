import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../../../lib/cache.ts";
import {
  PermissionError,
  requireAdmin,
} from "../../../../../../lib/permissions.ts";
import {
  adminEventTimelineQuerySchema,
  type AdminEventTimelineQueryInput,
  eventRouteParamsSchema,
} from "../../../../../../lib/validators.ts";
import {
  EventServiceError,
  getAdminEventTimeline,
  type AdminEventTimelineResult,
} from "../../../../../../services/event.service.ts";

export const dynamic = "force-dynamic";

type AdminTimelineHandlerOptions = {
  requireAdminSession?: () => Promise<unknown>;
  getTimeline?: (input: {
    eventId: string;
    query: AdminEventTimelineQueryInput;
  }) => Promise<AdminEventTimelineResult>;
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function handleAdminEventTimelineRequest(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
  {
    requireAdminSession = requireAdmin,
    getTimeline = getAdminEventTimeline,
  }: AdminTimelineHandlerOptions = {},
) {
  try {
    await requireAdminSession();

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
    const query = adminEventTimelineQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined,
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

    const result = await getTimeline({
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
  return handleAdminEventTimelineRequest(request, context);
}
