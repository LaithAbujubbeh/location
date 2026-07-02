import type { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { privateNoStoreHeaders } from "@/lib/cache";
import { recheckRouteParamsSchema } from "@/lib/validators";
import {
  getRecheckTokenInfo,
  RecheckServiceError,
} from "@/services/recheck.service";

export const dynamic = "force-dynamic";

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const params = recheckRouteParamsSchema.safeParse(await context.params);

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

    const result = await getRecheckTokenInfo({
      token: params.data.token,
    });

    return apiSuccess(result, 200, {
      headers: privateNoStoreHeaders,
    });
  } catch (error) {
    if (error instanceof RecheckServiceError) {
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
