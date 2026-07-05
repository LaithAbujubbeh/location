export const PRIVATE_NO_STORE_HEADER_VALUE =
  "private, no-store, no-cache, max-age=0, must-revalidate";

export type ClientQueryKey = readonly string[];

export const privateNoStoreHeaders = {
  "Cache-Control": PRIVATE_NO_STORE_HEADER_VALUE,
} as const satisfies HeadersInit;

export const clientQueryKeys = {
  admin: {
    events: {
      list: () => ["admin", "events", "list"] as const,
      employees: (eventId: string) =>
        ["admin", "events", eventId, "employees"] as const,
      timeline: (eventId: string) =>
        ["admin", "events", eventId, "timeline"] as const,
    },
    devices: {
      list: () => ["admin", "devices", "list"] as const,
    },
    users: {
      detail: (userId: string) => ["admin", "users", userId] as const,
      list: () => ["admin", "users", "list"] as const,
    },
  },
  employee: {
    devices: {
      status: (userId: string) =>
        ["employee", userId, "devices", "status"] as const,
    },
    events: {
      list: (userId: string) => ["employee", userId, "events", "list"] as const,
      detail: (userId: string, eventId: string) =>
        ["employee", userId, "events", eventId] as const,
    },
    notifications: {
      list: (userId: string) =>
        ["employee", userId, "notifications", "list"] as const,
    },
  },
  rechecks: {
    detail: (token: string) => ["rechecks", "detail", token] as const,
  },
} as const;

export const mutationInvalidationPlan = {
  adminCreateEvent: [
    "admin.events.list",
    "employee.events.list for each assigned employee",
  ],
  employeeCheckIn: [
    "employee.events.list",
    "employee.events.detail",
    "admin.events.timeline",
    "admin.events.employees",
  ],
  recheckSubmit: [
    "employee.events.detail",
    "rechecks.detail",
    "admin.events.timeline",
  ],
  employeeCheckOut: [
    "employee.events.list",
    "employee.events.detail",
    "admin.events.timeline",
    "admin.events.employees",
  ],
  adminReviewDevice: ["admin.devices.list", "employee.devices.status"],
  adminUserMutation: ["admin.users.list", "admin.users.detail"],
  employeeReadNotification: ["employee.notifications.list"],
} as const;

export function withPrivateNoStore(response: Response) {
  response.headers.set("Cache-Control", PRIVATE_NO_STORE_HEADER_VALUE);

  return response;
}
