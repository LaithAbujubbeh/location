import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { PRIVATE_NO_STORE_HEADER_VALUE } = await import("../../lib/cache.ts");
const { RecheckServiceError } = await import(
  "../../services/recheck.service.ts"
);
const { handleRecheckTokenLookupRequest } = await import(
  "../../app/api/rechecks/[token]/route.ts"
);

const request = new Request(
  "http://localhost:3000/api/rechecks/recheck-token-for-tests",
);

function context(token: string) {
  return {
    params: Promise.resolve({
      token,
    }),
  };
}

test("recheck token lookup returns public event and active window details", async () => {
  let lookedUpToken: string | null = null;

  const response = await handleRecheckTokenLookupRequest(
    request,
    context("valid-recheck-token-for-tests"),
    {
      getTokenInfo: async ({ token }) => {
        lookedUpToken = token;

        return {
          event: {
            name: "Warehouse Audit",
            locationName: "Amman Warehouse",
            photoRequired: true,
          },
          recheck: {
            startsAt: "2026-07-10T10:00:00.000Z",
            expiresAt: "2026-07-10T10:15:00.000Z",
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(lookedUpToken, "valid-recheck-token-for-tests");
  assert.equal(
    response.headers.get("Cache-Control"),
    PRIVATE_NO_STORE_HEADER_VALUE,
  );

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.data.event.name, "Warehouse Audit");
  assert.equal(JSON.stringify(body).includes("tokenHash"), false);
  assert.equal(JSON.stringify(body).includes("rawToken"), false);
  assert.equal(JSON.stringify(body).includes("valid-recheck-token-for-tests"), false);
});

test("invalid recheck token lookup fails with 404", async () => {
  const response = await handleRecheckTokenLookupRequest(
    request,
    context("invalid-recheck-token-for-tests"),
    {
      getTokenInfo: async () => {
        throw new RecheckServiceError(
          404,
          "INVALID_RECHECK_TOKEN",
          "Recheck token was not found.",
        );
      },
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "INVALID_RECHECK_TOKEN",
      message: "Recheck token was not found.",
    },
  });
});

test("expired recheck token lookup fails with 410", async () => {
  const response = await handleRecheckTokenLookupRequest(
    request,
    context("expired-recheck-token-for-tests"),
    {
      getTokenInfo: async () => {
        throw new RecheckServiceError(
          410,
          "RECHECK_EXPIRED",
          "This recheck token has expired.",
        );
      },
    },
  );

  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "RECHECK_EXPIRED",
      message: "This recheck token has expired.",
    },
  });
});

test("reused recheck token lookup fails with 409", async () => {
  const response = await handleRecheckTokenLookupRequest(
    request,
    context("reused-recheck-token-for-tests"),
    {
      getTokenInfo: async () => {
        throw new RecheckServiceError(
          409,
          "RECHECK_ALREADY_SUBMITTED",
          "This recheck token has already been submitted.",
        );
      },
    },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "RECHECK_ALREADY_SUBMITTED",
      message: "This recheck token has already been submitted.",
    },
  });
});
