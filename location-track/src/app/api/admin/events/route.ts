import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../lib/cache.ts";
import { PermissionError, requireAdmin } from "../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
} from "../../../../lib/rate-limit.ts";
import {
  adminEventListQuerySchema,
  createEventSchema,
  type AdminEventListQueryInput,
} from "../../../../lib/validators.ts";
import {
  createEventForAdmin,
  EventServiceError,
  listAdminEvents,
  type AdminEventListResult,
  type CreateEventResult,
} from "../../../../services/event.service.ts";

export const dynamic = "force-dynamic";

type AdminEventsRouteDeps = {
  requireAdminSession: typeof requireAdmin;
  consumeRateLimit: typeof consumeUserRateLimit;
  createEvent: typeof createEventForAdmin;
};

type AdminListEventsRouteDeps = {
  requireAdminSession: typeof requireAdmin;
  listEvents: (input: {
    query: AdminEventListQueryInput;
  }) => Promise<AdminEventListResult>;
};

const defaultCreateDeps: AdminEventsRouteDeps = {
  requireAdminSession: requireAdmin,
  consumeRateLimit: consumeUserRateLimit,
  createEvent: createEventForAdmin,
};

const defaultListDeps: AdminListEventsRouteDeps = {
  requireAdminSession: requireAdmin,
  listEvents: listAdminEvents,
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
  deps: AdminEventsRouteDeps = defaultCreateDeps,
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

export async function handleAdminListEventsRequest(
  request: Request,
  deps: AdminListEventsRouteDeps = defaultListDeps,
) {
  try {
    await deps.requireAdminSession();

    const searchParams = new URL(request.url).searchParams;
    const query = adminEventListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
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

    const result = await deps.listEvents({
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

export async function GET(request: Request) {
  return handleAdminListEventsRequest(request);
}

export async function POST(request: Request) {
  return handleAdminCreateEventRequest(request);
}
