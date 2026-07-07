import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateHaversineDistanceMeters,
  checkGpsTimestampFreshness,
  DEFAULT_ACCEPTED_GPS_ACCURACY_METERS,
  DEFAULT_MAX_GPS_AGE_MS,
  DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS,
} from "../../lib/geo.ts";

test("haversine distance is zero for the same point", () => {
  const distance = calculateHaversineDistanceMeters(
    { latitude: 31.9711, longitude: 35.9078 },
    { latitude: 31.9711, longitude: 35.9078 },
  );

  assert.equal(distance, 0);
});

test("haversine distance is close to the known distance between two Amman points", () => {
  const distance = calculateHaversineDistanceMeters(
    { latitude: 31.9711, longitude: 35.9078 },
    { latitude: 31.9721, longitude: 35.9078 },
  );

  assert.ok(distance > 110);
  assert.ok(distance < 112);
});

test("GPS timestamp within the accepted age window is fresh", () => {
  const result = checkGpsTimestampFreshness({
    gpsTimestamp: new Date("2026-07-10T12:00:10.000Z"),
    now: new Date("2026-07-10T12:00:30.000Z"),
  });

  assert.equal(result.fresh, true);
  assert.equal(result.ageMs, 20_000);
});

test("GPS timestamp older than the accepted age window is rejected", () => {
  const result = checkGpsTimestampFreshness({
    gpsTimestamp: new Date("2026-07-10T11:58:29.999Z"),
    now: new Date("2026-07-10T12:00:30.000Z"),
  });

  assert.equal(result.fresh, false);
  assert.equal(result.ageMs, DEFAULT_MAX_GPS_AGE_MS + 1);
  assert.equal(result.reason, "GPS_TOO_OLD");
});

test("GPS timestamp too far in the future is rejected", () => {
  const result = checkGpsTimestampFreshness({
    gpsTimestamp: new Date("2026-07-10T12:00:06.000Z"),
    now: new Date("2026-07-10T12:00:00.000Z"),
  });

  assert.equal(result.fresh, false);
  assert.equal(result.ageMs, -6000);
  assert.equal(result.reason, "GPS_IN_FUTURE");
});

test("GPS accuracy thresholds describe accepted and reviewable ranges", () => {
  assert.equal(DEFAULT_MAX_GPS_AGE_MS, 2 * 60 * 1000);
  assert.equal(DEFAULT_ACCEPTED_GPS_ACCURACY_METERS, 150);
  assert.equal(DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS, 1000);
  assert.ok(
    DEFAULT_ACCEPTED_GPS_ACCURACY_METERS <
      DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS,
  );
});
