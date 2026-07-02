import { UserRole } from "@prisma/client";
import { headers } from "next/headers.js";

import { auth } from "./auth.ts";

export { UserRole };

export const ROLES = {
  ADMIN: UserRole.ADMIN,
  EMPLOYEE: UserRole.EMPLOYEE,
} as const;

export class PermissionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PermissionError";
    this.status = status;
    this.code = code;
  }
}

export type CurrentSession = NonNullable<
  Awaited<ReturnType<typeof getCurrentSession>>
>;

export type SessionUser = CurrentSession["user"] & {
  role: UserRole;
};

export type AuthenticatedSession = CurrentSession & {
  user: SessionUser;
};

export function isUserRole(role: unknown): role is UserRole {
  return role === UserRole.ADMIN || role === UserRole.EMPLOYEE;
}

export function isAdminRole(role: unknown): role is typeof UserRole.ADMIN {
  return role === UserRole.ADMIN;
}

export function isEmployeeRole(role: unknown): role is typeof UserRole.EMPLOYEE {
  return role === UserRole.EMPLOYEE;
}

export function isAdmin(
  user: { role?: unknown } | null | undefined,
): user is SessionUser & { role: typeof UserRole.ADMIN } {
  return isAdminRole(user?.role);
}

export function isEmployee(
  user: { role?: unknown } | null | undefined,
): user is SessionUser & { role: typeof UserRole.EMPLOYEE } {
  return isEmployeeRole(user?.role);
}

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireUser(): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();

  if (!session) {
    throw new PermissionError(
      401,
      "UNAUTHORIZED",
      "Authentication is required.",
    );
  }

  const role = (session.user as { role?: unknown }).role;

  if (!isUserRole(role)) {
    throw new PermissionError(403, "INVALID_ROLE", "User role is invalid.");
  }

  return {
    ...session,
    user: {
      ...session.user,
      role,
    },
  };
}

export async function requireAdmin(): Promise<AuthenticatedSession> {
  const session = await requireUser();

  if (!isAdmin(session.user)) {
    throw new PermissionError(
      403,
      "FORBIDDEN",
      "Administrator access is required.",
    );
  }

  return session;
}

export async function requireEmployee(): Promise<AuthenticatedSession> {
  const session = await requireUser();

  if (!isEmployee(session.user)) {
    throw new PermissionError(
      403,
      "FORBIDDEN",
      "Employee access is required.",
    );
  }

  return session;
}

export async function requireEmployeeOrAdmin(): Promise<AuthenticatedSession> {
  const session = await requireUser();

  if (!isEmployee(session.user) && !isAdmin(session.user)) {
    throw new PermissionError(
      403,
      "FORBIDDEN",
      "Employee or administrator access is required.",
    );
  }

  return session;
}
