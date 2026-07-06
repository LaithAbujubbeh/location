import { apiError, apiSuccess } from "../../../../lib/api-response.ts";
import { privateNoStoreHeaders } from "../../../../lib/cache.ts";
import {
  PermissionError,
  requireEmployee,
  type AuthenticatedSession,
} from "../../../../lib/permissions.ts";
import {
  consumeUserRateLimit,
  rateLimitPolicies,
  rateLimitResponse,
  type RateLimitStore,
} from "../../../../lib/rate-limit.ts";
import {
  uploadProofPhoto,
  UploadServiceError,
  type ProofPhotoUploadResult,
} from "../../../../services/upload.service.ts";

export const dynamic = "force-dynamic";

type ProofPhotoUploadDeps = {
  requireEmployeeSession?: () => Promise<AuthenticatedSession>;
  upload?: typeof uploadProofPhoto;
  rateLimitStore?: RateLimitStore;
};

function getStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function handleProofPhotoUploadRequest(
  request: Request,
  {
    rateLimitStore,
    requireEmployeeSession = requireEmployee,
    upload = uploadProofPhoto,
  }: ProofPhotoUploadDeps = {},
) {
  try {
    const employeeSession = await requireEmployeeSession();
    const rateLimit = await consumeUserRateLimit({
      policy: rateLimitPolicies.proofPhotoUpload,
      store: rateLimitStore,
      userId: employeeSession.user.id,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, {
        headers: privateNoStoreHeaders,
      });
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return apiError(
        "INVALID_FORM_DATA",
        "Request body must be multipart form data.",
        400,
        {
          headers: privateNoStoreHeaders,
        },
      );
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("VALIDATION_ERROR", "Proof photo file is required.", 400, {
        headers: privateNoStoreHeaders,
      });
    }

    const result: ProofPhotoUploadResult = await upload({
      assignmentId: getStringField(formData, "assignmentId"),
      file,
      proofType: getStringField(formData, "proofType"),
      session: employeeSession,
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

    if (error instanceof UploadServiceError) {
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

export function POST(request: Request) {
  return handleProofPhotoUploadRequest(request);
}
