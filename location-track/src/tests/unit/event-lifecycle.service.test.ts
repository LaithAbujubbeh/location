import assert from "node:assert/strict";
import test from "node:test";

import { EventStatus } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/location_track_test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { completeEndedEventsInTransaction } = await import(
  "../../services/event.service.ts"
);

test("ended scheduled or active events are marked completed", async () => {
  let updateManyArgs: unknown = null;
  const now = new Date("2026-07-10T12:00:00.000Z");
  const tx = {
    event: {
      updateMany: async (args: unknown) => {
        updateManyArgs = args;

        return {
          count: 2,
        };
      },
    },
  };

  const result = await completeEndedEventsInTransaction(tx as never, { now });

  assert.equal(result.count, 2);
  assert.deepEqual(updateManyArgs, {
    where: {
      status: {
        in: [EventStatus.SCHEDULED, EventStatus.ACTIVE],
      },
      endsAt: {
        lte: now,
      },
    },
    data: {
      status: EventStatus.COMPLETED,
    },
  });
});
