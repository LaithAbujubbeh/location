export const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterMs: number;
};

export type RateLimitStore = {
  consume(args: {
    key: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): Promise<RateLimitResult> | RateLimitResult;
};

type InMemoryRateLimitEntry = {
  count: number;
  resetAtMs: number;
};

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, InMemoryRateLimitEntry>();

  consume({
    key,
    limit,
    windowMs,
    now,
  }: {
    key: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): RateLimitResult {
    const nowMs = now.getTime();
    const existing = this.entries.get(key);
    const entry =
      existing && existing.resetAtMs > nowMs
        ? existing
        : {
            count: 0,
            resetAtMs: nowMs + windowMs,
          };

    entry.count += 1;
    this.entries.set(key, entry);

    const allowed = entry.count <= limit;
    const remaining = Math.max(limit - entry.count, 0);
    const retryAfterMs = Math.max(entry.resetAtMs - nowMs, 0);

    return {
      allowed,
      limit,
      remaining,
      resetAt: new Date(entry.resetAtMs),
      retryAfterMs,
    };
  }

  clear() {
    this.entries.clear();
  }
}

export const rateLimitPolicies = {
  checkInSubmit: {
    name: "check-in-submit",
    limit: 5,
    windowMs: 5 * 60 * 1000,
  },
  recheckSubmit: {
    name: "recheck-submit",
    limit: 5,
    windowMs: 5 * 60 * 1000,
  },
  checkOutSubmit: {
    name: "check-out-submit",
    limit: 5,
    windowMs: 5 * 60 * 1000,
  },
  adminCreateEvent: {
    name: "admin-create-event",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  },
  deviceRegistration: {
    name: "device-registration",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  },
  adminDeviceReview: {
    name: "admin-device-review",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  },
  adminUserMutation: {
    name: "admin-user-mutation",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  },
  proofPhotoUpload: {
    name: "proof-photo-upload",
    limit: 10,
    windowMs: 5 * 60 * 1000,
  },
} as const satisfies Record<string, RateLimitPolicy>;

const defaultRateLimitStore = new InMemoryRateLimitStore();

export function userRateLimitIdentifier(userId: string) {
  return `user:${userId}`;
}

export function createRateLimitKey({
  policy,
  identifier,
}: {
  policy: RateLimitPolicy;
  identifier: string;
}) {
  return `${policy.name}:${identifier}`;
}

export async function consumeRateLimit({
  policy,
  identifier,
  now = new Date(),
  store = defaultRateLimitStore,
}: {
  policy: RateLimitPolicy;
  identifier: string;
  now?: Date;
  store?: RateLimitStore;
}) {
  return store.consume({
    key: createRateLimitKey({ policy, identifier }),
    limit: policy.limit,
    windowMs: policy.windowMs,
    now,
  });
}

export async function consumeUserRateLimit({
  policy,
  userId,
  now,
  store,
}: {
  policy: RateLimitPolicy;
  userId: string;
  now?: Date;
  store?: RateLimitStore;
}) {
  return consumeRateLimit({
    policy,
    identifier: userRateLimitIdentifier(userId),
    now,
    store,
  });
}

export function rateLimitResponse(
  result: RateLimitResult,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);

  headers.set("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt.getTime() / 1000)),
  );

  return Response.json(
    {
      message: RATE_LIMIT_MESSAGE,
    },
    {
      ...init,
      status: 429,
      headers,
    },
  );
}

export function resetRateLimitStoreForTests() {
  defaultRateLimitStore.clear();
}
