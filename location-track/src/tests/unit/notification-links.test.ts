import assert from "node:assert/strict";
import test from "node:test";

import { localizedNotificationLink } from "../../lib/notifications.ts";

test("notification links are localized without duplicating locale prefixes", () => {
  assert.equal(
    localizedNotificationLink("/admin/devices", "ar"),
    "/ar/admin/devices",
  );
  assert.equal(
    localizedNotificationLink("/en/admin/devices", "ar"),
    "/ar/admin/devices",
  );
  assert.equal(
    localizedNotificationLink("employee/events", "en"),
    "/en/employee/events",
  );
});
