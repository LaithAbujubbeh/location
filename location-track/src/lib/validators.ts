import { AssignmentStatus, DeviceStatus, EventStatus, UserRole } from "@prisma/client";
import { z } from "zod";

const dateString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid ISO date string.",
  })
  .transform((value) => new Date(value));

const recheckSlotSchema = z.object({
  startsAt: dateString,
  expiresAt: dateString,
});

const assignmentInstructionSchema = z.object({
  employeeId: z.string().trim().min(1),
  instructions: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || null),
});

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    locationName: z.string().trim().min(1).max(240),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(1).max(50000),
    startsAt: dateString,
    endsAt: dateString,
    employeeIds: z.array(z.string().trim().min(1)).min(1),
    assignmentInstructions: z
      .array(assignmentInstructionSchema)
      .max(500)
      .default([]),
    recheckSlots: z.array(recheckSlotSchema).max(10).default([]),
    requirePhoto: z.boolean().default(false),
    requireCheckout: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt must be after startsAt.",
      });
    }

    if (new Set(value.employeeIds).size !== value.employeeIds.length) {
      context.addIssue({
        code: "custom",
        path: ["employeeIds"],
        message: "employeeIds must not contain duplicates.",
      });
    }

    const employeeIds = new Set(value.employeeIds);
    const assignmentInstructionEmployeeIds = new Set<string>();

    for (const [index, assignment] of value.assignmentInstructions.entries()) {
      if (!employeeIds.has(assignment.employeeId)) {
        context.addIssue({
          code: "custom",
          path: ["assignmentInstructions", index, "employeeId"],
          message: "assignmentInstructions must reference selected employeeIds.",
        });
      }

      if (assignmentInstructionEmployeeIds.has(assignment.employeeId)) {
        context.addIssue({
          code: "custom",
          path: ["assignmentInstructions", index, "employeeId"],
          message: "assignmentInstructions must not contain duplicate employeeIds.",
        });
      }

      assignmentInstructionEmployeeIds.add(assignment.employeeId);
    }

    const startsAtTimes = new Set<number>();

    for (const [index, slot] of value.recheckSlots.entries()) {
      if (slot.startsAt < value.startsAt || slot.startsAt > value.endsAt) {
        context.addIssue({
          code: "custom",
          path: ["recheckSlots", index, "startsAt"],
          message: "startsAt must be inside the event time window.",
        });
      }

      if (slot.expiresAt < value.startsAt || slot.expiresAt > value.endsAt) {
        context.addIssue({
          code: "custom",
          path: ["recheckSlots", index, "expiresAt"],
          message: "expiresAt must be inside the event time window.",
        });
      }

      if (slot.startsAt >= slot.expiresAt) {
        context.addIssue({
          code: "custom",
          path: ["recheckSlots", index, "expiresAt"],
          message: "expiresAt must be after startsAt.",
        });
      }

      const startsAtTime = slot.startsAt.getTime();

      if (startsAtTimes.has(startsAtTime)) {
        context.addIssue({
          code: "custom",
          path: ["recheckSlots", index, "startsAt"],
          message: "recheckSlots must not contain duplicate startsAt values.",
        });
      }

      startsAtTimes.add(startsAtTime);
    }
  });

export const employeeEventDetailQuerySchema = z.object({
  includeEnded: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type EmployeeEventDetailQueryInput = z.infer<
  typeof employeeEventDetailQuerySchema
>;

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    locationName: z.string().trim().min(1).max(240),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(1).max(50000),
    startsAt: dateString,
    endsAt: dateString,
    requirePhoto: z.boolean().default(false),
    requireCheckout: z.boolean().default(true),
    status: z.enum(EventStatus),
  })
  .superRefine((value, context) => {
    if (value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt must be after startsAt.",
      });
    }
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

const paginationNumber = (defaultValue: number, maxValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return defaultValue;
      }

      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : Number.NaN;
    })
    .pipe(z.number().int().min(1).max(maxValue));

export const employeeEventListQuerySchema = z.object({
  page: paginationNumber(1, 10000),
  pageSize: paginationNumber(20, 100),
});

export type EmployeeEventListQueryInput = z.infer<
  typeof employeeEventListQuerySchema
>;

export const adminEventListQuerySchema = z.object({
  page: paginationNumber(1, 10000),
  pageSize: paginationNumber(20, 100),
});

export type AdminEventListQueryInput = z.infer<
  typeof adminEventListQuerySchema
>;

export const adminEventTimelineQuerySchema = z.object({
  page: paginationNumber(1, 10000),
  pageSize: paginationNumber(20, 100),
  status: z.enum(AssignmentStatus).optional(),
  employeeId: z.string().trim().min(1).optional(),
});

export type AdminEventTimelineQueryInput = z.infer<
  typeof adminEventTimelineQuerySchema
>;

export const notificationListQuerySchema = z.object({
  page: paginationNumber(1, 10000),
  pageSize: paginationNumber(20, 100),
  unread: z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true",
    ),
});

export type NotificationListQueryInput = z.infer<
  typeof notificationListQuerySchema
>;

export const employeeNotificationListQuerySchema = notificationListQuerySchema;

export type EmployeeNotificationListQueryInput = NotificationListQueryInput;

export const registerDeviceSchema = z.object({
  deviceId: z.string().trim().uuid(),
  label: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .transform((value) => value ?? null),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const locationPayloadSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(10000),
  gpsTimestamp: dateString,
  deviceId: z.string().trim().uuid(),
  photoUrl: z
    .string()
    .trim()
    .url()
    .max(2048)
    .optional()
    .transform((value) => value ?? null),
});

export const checkInPayloadSchema = locationPayloadSchema;

export type CheckInPayloadInput = z.infer<typeof checkInPayloadSchema>;

export const recheckSubmitPayloadSchema = locationPayloadSchema;

export type RecheckSubmitPayloadInput = z.infer<
  typeof recheckSubmitPayloadSchema
>;

export const checkOutPayloadSchema = locationPayloadSchema;

export type CheckOutPayloadInput = z.infer<typeof checkOutPayloadSchema>;

export const adminDeviceListQuerySchema = z.object({
  page: paginationNumber(1, 10000),
  pageSize: paginationNumber(20, 100),
  status: z.enum(DeviceStatus).optional(),
});

export type AdminDeviceListQueryInput = z.infer<
  typeof adminDeviceListQuerySchema
>;

export const deviceRouteParamsSchema = z.object({
  deviceId: z.string().trim().min(1),
});

export const adminUserListQuerySchema = z.object({
  page: paginationNumber(1, 10000),
  pageSize: paginationNumber(20, 100),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true",
    ),
  role: z.enum(UserRole).optional(),
  search: z.string().trim().max(120).optional(),
});

export type AdminUserListQueryInput = z.infer<
  typeof adminUserListQuerySchema
>;

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  isActive: z.boolean().default(true),
  role: z.enum(UserRole),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

export const updateAdminUserSchema = z.object({
  isActive: z.boolean(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(UserRole),
});

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const userRouteParamsSchema = z.object({
  userId: z.string().trim().min(1),
});

export const eventRouteParamsSchema = z.object({
  eventId: z.string().trim().min(1),
});

export const employeeRecheckRouteParamsSchema = z.object({
  eventId: z.string().trim().min(1),
  slotId: z.string().trim().min(1),
});

export const recheckRouteParamsSchema = z.object({
  token: z.string().trim().min(16).max(512),
});

export const notificationRouteParamsSchema = z.object({
  notificationId: z.string().trim().min(1),
});
