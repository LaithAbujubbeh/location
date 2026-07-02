import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { PermissionError, requireEmployee } from "@/lib/permissions";
import { employeeEventListQuerySchema } from "@/lib/validators";
import { listAssignedEventsForEmployee } from "@/services/event.service";

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

export async function GET(request: Request) {
  try {
    const employeeSession = await requireEmployee();
    const searchParams = new URL(request.url).searchParams;
    const parsed = employeeEventListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

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

    const result = await listAssignedEventsForEmployee({
      employeeId: employeeSession.user.id,
      query: parsed.data,
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
