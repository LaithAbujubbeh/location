import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("create event page selects employees from admin users", async () => {
  const source = await readFile(
    new URL("../../components/admin/admin-create-event-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /fetchAdminUsers/);
  assert.match(source, /isActive: true/);
  assert.match(source, /role: "EMPLOYEE"/);
  assert.match(source, /toggleEmployee/);
  assert.match(source, /assignmentInstructions/);
  assert.match(source, /updateAssignmentInstructions/);
  assert.match(source, /<textarea/);
});
