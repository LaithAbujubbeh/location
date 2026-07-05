import { apiError, apiSuccess } from "@/lib/api-response";
import { privateNoStoreHeaders } from "@/lib/cache";
import { PermissionError, requireUser } from "@/lib/permissions";
import { markAllNotificationsReadForUser } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    const session = await requireUser();
    const result = await markAllNotificationsReadForUser({
      userId: session.user.id,
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

    console.error(error);

    return apiError("INTERNAL_SERVER_ERROR", "Something went wrong.", 500, {
      headers: privateNoStoreHeaders,
    });
  }
}
