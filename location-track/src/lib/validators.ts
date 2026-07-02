import { DeviceStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid ISO date string.",
  })
  .transform((value) => new Date(value));

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
    recheckCount: z.number().int().min(0).max(20).default(0),
    recheckWindowMin: z.number().int().min(1).max(1440).optional(),
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

    if (value.recheckCount > 0 && !value.recheckWindowMin) {
      context.addIssue({
        code: "custom",
        path: ["recheckWindowMin"],
        message:
          "recheckWindowMin is required when recheckCount is greater than 0.",
      });
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

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

export const eventRouteParamsSchema = z.object({
  eventId: z.string().trim().min(1),
});

export const recheckRouteParamsSchema = z.object({
  token: z.string().trim().min(16).max(512),
});
