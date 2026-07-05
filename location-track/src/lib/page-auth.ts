import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import {
  PermissionError,
  requireUser,
  type AuthenticatedSession,
} from "@/lib/permissions";
import type { Locale } from "@/lib/i18n";

export type AdminPageSession = AuthenticatedSession & {
  user: AuthenticatedSession["user"] & { role: typeof UserRole.ADMIN };
};

export type EmployeePageSession = AuthenticatedSession & {
  user: AuthenticatedSession["user"] & { role: typeof UserRole.EMPLOYEE };
};

export function roleHomePath(locale: Locale, role: UserRole) {
  return role === UserRole.ADMIN
    ? `/${locale}/admin/events`
    : `/${locale}/employee/events`;
}

export function loginPath(locale: Locale, nextPath?: string) {
  const basePath = `/${locale}/login`;

  if (!nextPath) {
    return basePath;
  }

  return `${basePath}?next=${encodeURIComponent(nextPath)}`;
}

export function inactiveAccountLoginPath(locale: Locale, nextPath: string) {
  return `${loginPath(locale, nextPath)}&error=accountInactive`;
}

export function getSafeNextPath(locale: Locale, nextPath: string | undefined) {
  if (
    !nextPath ||
    nextPath === `/${locale}/login` ||
    !nextPath.startsWith(`/${locale}/`)
  ) {
    return null;
  }

  return nextPath;
}

async function requirePageUser(locale: Locale, nextPath: string) {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof PermissionError && error.status === 401) {
      redirect(loginPath(locale, nextPath));
    }

    if (error instanceof PermissionError && error.code === "ACCOUNT_INACTIVE") {
      redirect(inactiveAccountLoginPath(locale, nextPath));
    }

    throw error;
  }
}

export async function requireAdminPage(
  locale: Locale,
  nextPath: string,
): Promise<AdminPageSession> {
  const session = await requirePageUser(locale, nextPath);

  if (session.user.role !== UserRole.ADMIN) {
    redirect(roleHomePath(locale, session.user.role));
  }

  return session as AdminPageSession;
}

export async function requireEmployeePage(
  locale: Locale,
  nextPath: string,
): Promise<EmployeePageSession> {
  const session = await requirePageUser(locale, nextPath);

  if (session.user.role !== UserRole.EMPLOYEE) {
    redirect(roleHomePath(locale, session.user.role));
  }

  return session as EmployeePageSession;
}
