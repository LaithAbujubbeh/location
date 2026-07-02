import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeUserRateLimit,
  createRateLimitKey,
  InMemoryRateLimitStore,
  RATE_LIMIT_MESSAGE,
  rateLimitPolicies,
  rateLimitResponse,
  type RateLimitPolicy,
  type RateLimitStore,
  userRateLimitIdentifier,
} from "../../lib/rate-limit.ts";

const policy = {
  name: "unit-test",
  limit: 2,
  windowMs: 60_000,
} satisfies RateLimitPolicy;

test("request succeeds under the limit", async () => {
  const store = new InMemoryRateLimitStore();
  const first = await consumeUserRateLimit({
    policy,
    userId: "user_1",
    store,
    now: new Date("2026-07-02T10:00:00.000Z"),
  });
  const second = await consumeUserRateLimit({
    policy,
    userId: "user_1",
    store,
    now: new Date("2026-07-02T10:00:01.000Z"),
  });

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
});

test("request returns 429 after exceeding the limit", async () => {
  const store = new InMemoryRateLimitStore();

  await consumeUserRateLimit({
    policy,
    userId: "user_1",
    store,
    now: new Date("2026-07-02T10:00:00.000Z"),
  });
  await consumeUserRateLimit({
    policy,
    userId: "user_1",
    store,
    now: new Date("2026-07-02T10:00:01.000Z"),
  });
  const limited = await consumeUserRateLimit({
    policy,
    userId: "user_1",
    store,
    now: new Date("2026-07-02T10:00:02.000Z"),
  });

  assert.equal(limited.allowed, false);

  const response = rateLimitResponse(limited);

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    message: RATE_LIMIT_MESSAGE,
  });
});

test("different users have separate limits", async () => {
  const store = new InMemoryRateLimitStore();
  const now = new Date("2026-07-02T10:00:00.000Z");

  assert.equal(
    (
      await consumeUserRateLimit({
        policy: { ...policy, limit: 1 },
        userId: "user_1",
        store,
        now,
      })
    ).allowed,
    true,
  );
  assert.equal(
    (
      await consumeUserRateLimit({
        policy: { ...policy, limit: 1 },
        userId: "user_2",
        store,
        now,
      })
    ).allowed,
    true,
  );
  assert.equal(
    (
      await consumeUserRateLimit({
        policy: { ...policy, limit: 1 },
        userId: "user_1",
        store,
        now,
      })
    ).allowed,
    false,
  );
});

test("check-in, recheck, and checkout limits use the session user ID", async () => {
  const consumedKeys: string[] = [];
  const store: RateLimitStore = {
    consume: ({ key, limit, windowMs, now }) => {
      consumedKeys.push(key);

      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt: new Date(now.getTime() + windowMs),
        retryAfterMs: windowMs,
      };
    },
  };

  await consumeUserRateLimit({
    policy: rateLimitPolicies.checkInSubmit,
    userId: "session_employee_1",
    store,
  });
  await consumeUserRateLimit({
    policy: rateLimitPolicies.recheckSubmit,
    userId: "session_employee_1",
    store,
  });
  await consumeUserRateLimit({
    policy: rateLimitPolicies.checkOutSubmit,
    userId: "session_employee_1",
    store,
  });

  assert.deepEqual(consumedKeys, [
    "check-in-submit:user:session_employee_1",
    "recheck-submit:user:session_employee_1",
    "check-out-submit:user:session_employee_1",
  ]);
});

test("admin create event limit uses the admin user ID", async () => {
  const key = createRateLimitKey({
    policy: rateLimitPolicies.adminCreateEvent,
    identifier: userRateLimitIdentifier("session_admin_1"),
  });

  assert.equal(key, "admin-create-event:user:session_admin_1");
});
