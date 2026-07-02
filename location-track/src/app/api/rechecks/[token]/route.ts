import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../lib/cache.ts";
import { recheckRouteParamsSchema } from "../../../../lib/validators.ts";
import {
  getRecheckTokenInfo,
  RecheckServiceError,
  type RecheckTokenInfoResult,
} from "../../../../services/recheck.service.ts";

export const dynamic = "force-dynamic";

type RecheckTokenRouteDeps = {
  getTokenInfo: typeof getRecheckTokenInfo;
};

const defaultDeps: RecheckTokenRouteDeps = {
  getTokenInfo: getRecheckTokenInfo,
};

function formatValidationError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function handleRecheckTokenLookupRequest(
  _request: Request,
  context: { params: Promise<{ token: string }> },
  deps: RecheckTokenRouteDeps = defaultDeps,
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

    const result: RecheckTokenInfoResult = await deps.getTokenInfo({
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

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return handleRecheckTokenLookupRequest(request, context);
}
