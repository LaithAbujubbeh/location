export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type GpsFreshnessResult =
  | {
      fresh: true;
      ageMs: number;
    }
  | {
      fresh: false;
      ageMs: number;
      reason: "GPS_TOO_OLD" | "GPS_IN_FUTURE";
    };

export const DEFAULT_MAX_GPS_AGE_MS = 30 * 1000;
export const DEFAULT_MAX_GPS_FUTURE_DRIFT_MS = 5 * 1000;
export const DEFAULT_ACCEPTED_GPS_ACCURACY_METERS = 100;
export const DEFAULT_MAX_REVIEWABLE_GPS_ACCURACY_METERS = 1000;

const EARTH_RADIUS_METERS = 6371000;

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function calculateHaversineDistanceMeters(
  origin: GeoPoint,
  destination: GeoPoint,
) {
  const latitudeDelta = degreesToRadians(destination.latitude - origin.latitude);
  const longitudeDelta = degreesToRadians(
    destination.longitude - origin.longitude,
  );
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function checkGpsTimestampFreshness({
  gpsTimestamp,
  now,
  maxAgeMs = DEFAULT_MAX_GPS_AGE_MS,
  maxFutureDriftMs = DEFAULT_MAX_GPS_FUTURE_DRIFT_MS,
}: {
  gpsTimestamp: Date;
  now: Date;
  maxAgeMs?: number;
  maxFutureDriftMs?: number;
}): GpsFreshnessResult {
  const ageMs = now.getTime() - gpsTimestamp.getTime();

  if (ageMs < -maxFutureDriftMs) {
    return {
      fresh: false,
      ageMs,
      reason: "GPS_IN_FUTURE",
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      fresh: false,
      ageMs,
      reason: "GPS_TOO_OLD",
    };
  }

  return {
    fresh: true,
    ageMs,
  };
}
