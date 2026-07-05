import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { privateNoStoreHeaders } from "@/lib/cache";
import { PermissionError, requireUser } from "@/lib/permissions";
import { notificationRouteParamsSchema } from "@/lib/validators";
import {
  markNotificationReadForUser,
  NotificationServiceError,
} from "@/services/notification.service";

export const dynamic = "force-dynamic";

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const session = await requireUser();
    const params = notificationRouteParamsSchema.safeParse(
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

    const result = await markNotificationReadForUser({
      userId: session.user.id,
      notificationId: params.data.notificationId,
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

    if (error instanceof NotificationServiceError) {
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
