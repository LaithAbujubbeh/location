import assert from "node:assert/strict";
import test from "node:test";

import {
  canCheckIn,
  canCheckOut,
  canSubmitRecheck,
  type EmployeeEventItem,
} from "../../lib/employee-events.ts";

function eventWith(
  overrides: Partial<EmployeeEventItem["assignment"]> = {},
  eventOverrides: Partial<EmployeeEventItem["event"]> = {},
): EmployeeEventItem {
  return {
    assignment: {
      checkedInAt: null,
      checkedOutAt: null,
      completedAt: null,
      id: "assignment-1",
      status: "PENDING",
      ...overrides,
    },
    event: {
      endsAt: "2026-07-06T13:00:00.000Z",
      id: "event-1",
      latitude: 31.95,
      locationName: "Office",
      longitude: 35.91,
      name: "Event",
      radiusMeters: 100,
      recheckSlots: [],
      requireCheckout: true,
      requirePhoto: false,
      startsAt: "2026-07-06T12:00:00.000Z",
      status: "ACTIVE",
      ...eventOverrides,
    } as EmployeeEventItem["event"],
  };
}

test("check-in action only shows for pending unchecked assignments", () => {
  assert.equal(canCheckIn(eventWith()), true);
  assert.equal(canCheckIn(eventWith({ status: "MISSED" })), false);
  assert.equal(canCheckIn(eventWith({ status: "FAILED" })), false);
  assert.equal(
    canCheckIn(eventWith({ checkedInAt: "2026-07-06T12:10:00.000Z" })),
    false,
  );
});

test("recheck action only shows for in-progress assignments with open slots", () => {
  const recheckSlots = [
    {
      completedAt: null,
      expiresAt: "2026-07-06T12:40:00.000Z",
      id: "slot-1",
      startsAt: "2026-07-06T12:30:00.000Z",
      status: "PENDING" as const,
      submittedAt: null,
    },
  ];

  assert.equal(
    canSubmitRecheck(eventWith({ status: "IN_PROGRESS" }, { recheckSlots })),
    true,
  );
  assert.equal(canSubmitRecheck(eventWith({ status: "PENDING" }, { recheckSlots })), false);
  assert.equal(canSubmitRecheck(eventWith({ status: "IN_PROGRESS" })), false);
});

test("checkout action matches backend assignment status rules", () => {
  assert.equal(
    canCheckOut(
      eventWith({
        checkedInAt: "2026-07-06T12:10:00.000Z",
        status: "IN_PROGRESS",
      }),
    ),
    true,
  );
  assert.equal(
    canCheckOut(
      eventWith({
        checkedInAt: "2026-07-06T12:10:00.000Z",
        status: "FAILED",
      }),
    ),
    false,
  );
  assert.equal(
    canCheckOut(
      eventWith(
        {
          checkedInAt: "2026-07-06T12:10:00.000Z",
          status: "IN_PROGRESS",
        },
        { requireCheckout: false },
      ),
    ),
    false,
  );
});
