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
  eventRouteParamsSchema,
  updateEventSchema,
  type UpdateEventInput,
} from "../../../../../lib/validators.ts";
import {
  deleteEventForAdmin,
  EventServiceError,
  updateEventForAdmin,
  type AdminEventSummary,
} from "../../../../../services/event.service.ts";

export const dynamic = "force-dynamic";

type AdminEventRouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type AdminEventPatchDeps = {
  consumeRateLimit: typeof consumeUserRateLimit;
  requireAdminSession: typeof requireAdmin;
  updateEvent: (input: {
    eventId: string;
    input: UpdateEventInput;
  }) => Promise<{ event: AdminEventSummary }>;
};

type AdminEventDeleteDeps = {
  consumeRateLimit: typeof consumeUserRateLimit;
  deleteEvent: (input: { eventId: string }) => Promise<{ deleted: true }>;
  requireAdminSession: typeof requireAdmin;
};

const defaultPatchDeps: AdminEventPatchDeps = {
  consumeRateLimit: consumeUserRateLimit,
  requireAdminSession: requireAdmin,
  updateEvent: updateEventForAdmin,
};

const defaultDeleteDeps: AdminEventDeleteDeps = {
  consumeRateLimit: consumeUserRateLimit,
  deleteEvent: deleteEventForAdmin,
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

async function parseEventParams(context: AdminEventRouteContext) {
  const params = await context.params;
  const parsed = eventRouteParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new EventServiceError(
      400,
      "VALIDATION_ERROR",
      formatValidationError(parsed.error),
    );
  }

  return parsed.data;
}

export async function handleAdminUpdateEventRequest(
  request: Request,
  context: AdminEventRouteContext,
  deps: AdminEventPatchDeps = defaultPatchDeps,
) {
  try {
    const adminSession = await deps.requireAdminSession();
    const rateLimit = await deps.consumeRateLimit({
      policy: rateLimitPolicies.adminCreateEvent,
      userId: adminSession.user.id,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, {
        headers: privateNoStoreHeaders,
      });
    }

    const params = await parseEventParams(context);
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Request body must be valid JSON.", 400, {
        headers: privateNoStoreHeaders,
      });
    }

    const parsed = updateEventSchema.safeParse(body);

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

    const result = await deps.updateEvent({
      eventId: params.eventId,
      input: parsed.data,
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

export async function handleAdminDeleteEventRequest(
  _request: Request,
  context: AdminEventRouteContext,
  deps: AdminEventDeleteDeps = defaultDeleteDeps,
) {
  try {
    const adminSession = await deps.requireAdminSession();
    const rateLimit = await deps.consumeRateLimit({
      policy: rateLimitPolicies.adminCreateEvent,
      userId: adminSession.user.id,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, {
        headers: privateNoStoreHeaders,
      });
    }

    const params = await parseEventParams(context);
    const result = await deps.deleteEvent({
      eventId: params.eventId,
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

export async function PATCH(
  request: Request,
  context: AdminEventRouteContext,
) {
  return handleAdminUpdateEventRequest(request, context);
}

export async function DELETE(
  request: Request,
  context: AdminEventRouteContext,
) {
  return handleAdminDeleteEventRequest(request, context);
}
