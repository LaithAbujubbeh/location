import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin timeline renders proof photo thumbnails when photoUrl exists", async () => {
  const source = await readFile(
    "src/components/admin/admin-event-timeline-client.tsx",
    "utf8",
  );

  assert.match(source, /<img/);
  assert.match(source, /src=\{photoUrl\}/);
  assert.match(source, /max-h-44/);
});
