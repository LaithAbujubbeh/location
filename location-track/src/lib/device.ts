const DEVICE_ID_STORAGE_KEY = "locationAttendance.deviceId";

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    throw new Error("getDeviceId can only be used in a browser.");
  }

  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);

  return deviceId;
}
