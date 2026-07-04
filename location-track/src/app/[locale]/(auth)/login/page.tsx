import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { getSafeNextPath, roleHomePath } from "@/lib/page-auth";
import { getCurrentSession, isUserRole } from "@/lib/permissions";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const messages = await getMessages(locale);
  const search = await searchParams;
  const requestedNext = Array.isArray(search.next) ? search.next[0] : search.next;
  const safeNextPath =
    getSafeNextPath(locale, requestedNext) ??
    roleHomePath(locale, UserRole.EMPLOYEE);
  const session = await getCurrentSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (isUserRole(role)) {
    redirect(getSafeNextPath(locale, requestedNext) ?? roleHomePath(locale, role));
  }

  return (
    <main className="grid min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-5">
        <header className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-text-muted">
              {messages.common.appName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {messages.auth.login.title}
            </h1>
          </div>
          <div className="grid w-full gap-2 min-[430px]:grid-cols-2 sm:w-auto sm:flex sm:flex-wrap">
            <LanguageToggle
              className="w-full sm:w-auto"
              currentLocale={locale}
              labels={messages.language}
            />
            <ThemeToggle
              className="w-full sm:w-auto"
              labels={{
                ariaLabel: messages.theme.label,
                dark: messages.theme.dark,
                light: messages.theme.light,
                system: messages.theme.system,
              }}
            />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{messages.auth.login.cardTitle}</CardTitle>
            <CardDescription>
              {messages.auth.login.cardDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              labels={{
                email: messages.auth.login.email,
                invalidError: messages.auth.login.invalidError,
                password: messages.auth.login.password,
                requiredError: messages.auth.login.requiredError,
                submit: messages.auth.login.submit,
                submitting: messages.auth.login.submitting,
              }}
              nextPath={safeNextPath}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
