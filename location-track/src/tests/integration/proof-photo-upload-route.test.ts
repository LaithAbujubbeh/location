import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const { PermissionError } = await import("../../lib/permissions.ts");
const { handleProofPhotoUploadRequest } = await import(
  "../../app/api/uploads/proof-photo/route.ts"
);

test("proof photo upload requires an employee session", async () => {
  let uploadCalled = false;
  const response = await handleProofPhotoUploadRequest(
    new Request("http://localhost:3000/api/uploads/proof-photo", {
      method: "POST",
    }),
    {
      requireEmployeeSession: async () => {
        throw new PermissionError(401, "UNAUTHORIZED", "Authentication is required.");
      },
      upload: async () => {
        uploadCalled = true;
        throw new Error("upload should not run without a session");
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(uploadCalled, false);
  assert.equal(response.headers.get("Cache-Control"), PRIVATE_NO_STORE_HEADER_VALUE);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication is required.",
    },
  });
});
