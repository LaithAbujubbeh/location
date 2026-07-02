import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import {
  isCronRequestAuthorized,
  processScheduledRechecks,
  type ProcessRechecksSummary,
} from "../../../../services/recheck-cron.service.ts";

export const dynamic = "force-dynamic";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

type CronRechecksHandlerOptions = {
  cronSecret?: string | null;
  processRechecks?: () => Promise<ProcessRechecksSummary>;
};

export async function handleCronRechecksRequest(
  request: Request,
  {
    cronSecret = process.env.CRON_SECRET,
    processRechecks = processScheduledRechecks,
  }: CronRechecksHandlerOptions = {},
) {
  const requestUrl = new URL(request.url);

  if (
    !isCronRequestAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      querySecret: requestUrl.searchParams.get("secret"),
      expectedSecret: cronSecret,
    })
  ) {
    return apiError("UNAUTHORIZED", "Cron authorization failed.", 401, {
      headers: privateNoStoreHeaders,
    });
  }

  const result = await processRechecks();

  return apiSuccess(result, 200, {
    headers: privateNoStoreHeaders,
  });
}

export async function GET(request: Request) {
  try {
    return await handleCronRechecksRequest(request);
  } catch (error) {
    console.error(error);

    return apiError("INTERNAL_SERVER_ERROR", "Something went wrong.", 500, {
      headers: privateNoStoreHeaders,
    });
  }
}
