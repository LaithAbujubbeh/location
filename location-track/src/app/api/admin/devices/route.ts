import type { ZodError } from "zod";

import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../lib/cache.ts";
import { PermissionError, requireAdmin } from "../../../../lib/permissions.ts";
import {
  adminDeviceListQuerySchema,
  type AdminDeviceListQueryInput,
} from "../../../../lib/validators.ts";
import {
  listDevicesForAdmin,
  type AdminDeviceListResult,
} from "../../../../services/device.service.ts";

export const dynamic = "force-dynamic";

type AdminDevicesListDeps = {
  listDevices: (input: {
    query: AdminDeviceListQueryInput;
  }) => Promise<AdminDeviceListResult>;
  requireAdminSession: typeof requireAdmin;
};

const defaultListDeps: AdminDevicesListDeps = {
  listDevices: listDevicesForAdmin,
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

export async function handleAdminListDevicesRequest(
  request: Request,
  deps: AdminDevicesListDeps = defaultListDeps,
) {
  try {
    await deps.requireAdminSession();

    const searchParams = new URL(request.url).searchParams;
    const parsed = adminDeviceListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
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

    const result = await deps.listDevices({
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

export async function GET(request: Request) {
  return handleAdminListDevicesRequest(request);
}
