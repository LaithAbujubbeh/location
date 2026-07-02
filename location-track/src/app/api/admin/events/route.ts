import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../lib/cache.ts";
import { PermissionError, requireAdmin } from "../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "../../../../lib/rate-limit.ts";
import { createEventSchema } from "../../../../lib/validators.ts";
import {
  createEventForAdmin,
  EventServiceError,
  type CreateEventResult,
} from "../../../../services/event.service.ts";

export const dynamic = "force-dynamic";

type AdminEventsRouteDeps = {
  requireAdminSession: typeof requireAdmin;
  consumeRateLimit: typeof consumeUserRateLimit;
  createEvent: typeof createEventForAdmin;
};

const defaultDeps: AdminEventsRouteDeps = {
  requireAdminSession: requireAdmin,
  consumeRateLimit: consumeUserRateLimit,
  createEvent: createEventForAdmin,
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function handleAdminCreateEventRequest(
  request: Request,
  deps: AdminEventsRouteDeps = defaultDeps,
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Request body must be valid JSON.", 400, {
        headers: privateNoStoreHeaders,
      });
    }

    const parsed = createEventSchema.safeParse(body);

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

    const result: CreateEventResult = await deps.createEvent({
      input: parsed.data,
      createdByUserId: adminSession.user.id,
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

export async function POST(request: Request) {
  return handleAdminCreateEventRequest(request);
}
