import assert from "node:assert/strict";
import test from "node:test";

import { UserRole } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { uploadProofPhoto, UploadServiceError } = await import(
  "../../services/upload.service.ts"
);

const session = {
  user: {
    id: "employee_1",
    role: UserRole.EMPLOYEE,
  },
} as never;

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00]);

function database(assignmentFound = true) {
  let lookupCalled = false;

  return {
    client: {
      eventAssignment: {
        findFirst: async () => {
          lookupCalled = true;
          return assignmentFound ? { id: "assignment_1" } : null;
        },
      },
    },
    lookupCalled: () => lookupCalled,
  };
}

test("proof photo upload rejects unsupported file type", async () => {
  const db = database();
  const file = new File([new Uint8Array([0x25, 0x50])], "proof.pdf", {
    type: "application/pdf",
  });

  await assert.rejects(
    () =>
      uploadProofPhoto({
        assignmentId: "assignment_1",
        database: db.client,
        file,
        proofType: "CHECK_IN",
        session,
        uploadBlob: async () => {
          throw new Error("upload should not run");
        },
      }),
    (error: unknown) =>
      error instanceof UploadServiceError &&
      error.code === "UNSUPPORTED_FILE_TYPE" &&
      error.status === 400,
  );
  assert.equal(db.lookupCalled(), false);
});

test("proof photo upload rejects files larger than 5MB", async () => {
  const db = database();
  const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
  oversizedBytes.set(jpegBytes, 0);
  const file = new File([oversizedBytes], "proof.jpg", {
    type: "image/jpeg",
  });

  await assert.rejects(
    () =>
      uploadProofPhoto({
        assignmentId: "assignment_1",
        database: db.client,
        file,
        proofType: "CHECK_IN",
        session,
        uploadBlob: async () => {
          throw new Error("upload should not run");
        },
      }),
    (error: unknown) =>
      error instanceof UploadServiceError &&
      error.code === "FILE_TOO_LARGE" &&
      error.status === 413,
  );
  assert.equal(db.lookupCalled(), false);
});

test("proof photo upload stores immutable blob with scoped pathname", async () => {
  const db = database();
  const file = new File([jpegBytes], "proof.jpg", {
    type: "image/jpeg",
  });
  let sawPathname = "";

  const result = await uploadProofPhoto({
    assignmentId: "assignment_1",
    database: db.client,
    file,
    now: new Date("2026-07-10T10:00:00.000Z"),
    proofType: "CHECK_IN",
    session,
    uploadBlob: async (pathname, body, options) => {
      sawPathname = pathname;
      assert.equal(body.type, "image/jpeg");
      assert.deepEqual(options, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "image/jpeg",
      });

      return {
        pathname,
        url: `https://blob.example/${pathname}`,
      };
    },
  });

  assert.equal(db.lookupCalled(), true);
  assert.match(
    sawPathname,
    /^proofs\/employee_1\/assignment_1\/CHECK_IN\/2026-07-10T10-00-00-000Z-.+\.jpg$/,
  );
  assert.equal(result.url, `https://blob.example/${sawPathname}`);
  assert.equal(result.pathname, sawPathname);
});
