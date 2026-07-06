import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError } from "better-auth";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "./prisma.ts";

export const auth = betterAuth({
  appName: "Location Attendance",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const user = await prisma.user.findUnique({
            where: {
              id: session.userId,
            },
            select: {
              isActive: true,
            },
          });

          if (!user?.isActive) {
            throw APIError.from("FORBIDDEN", {
              code: "ACCOUNT_INACTIVE",
              message: "This user account is inactive.",
            });
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "EMPLOYEE",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
