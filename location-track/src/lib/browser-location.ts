export type BrowserLocationResult = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  gpsTimestamp: string;
};

export type BrowserLocationErrorCode =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "UNSUPPORTED"
  | "UNKNOWN";

export class BrowserLocationError extends Error {
  constructor(
    readonly code: BrowserLocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BrowserLocationError";
  }
}

function mapGeolocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return new BrowserLocationError(
      "PERMISSION_DENIED",
      "Location permission was denied.",
    );
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return new BrowserLocationError(
      "POSITION_UNAVAILABLE",
      "Location is currently unavailable.",
    );
  }

  if (error.code === error.TIMEOUT) {
    return new BrowserLocationError("TIMEOUT", "Location request timed out.");
  }

  return new BrowserLocationError("UNKNOWN", "Location could not be captured.");
}

export function getCurrentBrowserLocation(): Promise<BrowserLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new BrowserLocationError(
        "UNSUPPORTED",
        "Geolocation is not supported by this browser.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          gpsTimestamp: new Date(position.timestamp).toISOString(),
        });
      },
      (error) => reject(mapGeolocationError(error)),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );
  });
}
