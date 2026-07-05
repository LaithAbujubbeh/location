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
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
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
  const requestedError = Array.isArray(search.error)
    ? search.error[0]
    : search.error;
  const requestedNext = Array.isArray(search.next) ? search.next[0] : search.next;
  const isInactiveAccountError = requestedError === "accountInactive";
  const safeNextPath =
    getSafeNextPath(locale, requestedNext) ??
    roleHomePath(locale, UserRole.EMPLOYEE);
  const session = await getCurrentSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (isUserRole(role) && !isInactiveAccountError) {
    redirect(getSafeNextPath(locale, requestedNext) ?? roleHomePath(locale, role));
  }

  return (
    <main className="flex min-h-[100dvh] items-start bg-background px-4 py-6 text-foreground sm:items-center sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="grid min-w-0 gap-1">
            <p className="text-sm font-medium text-text-muted">
              {messages.common.appName}
            </p>
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              {messages.auth.login.title}
            </h1>
          </div>
          <div className="grid w-full min-w-0 gap-2 min-[390px]:grid-cols-2 sm:w-72 sm:justify-self-end md:w-80">
            <LanguageToggle
              currentLocale={locale}
              labels={messages.language}
            />
            <ThemeToggle
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
              initialError={
                isInactiveAccountError
                  ? messages.auth.login.inactiveError
                  : undefined
              }
              labels={{
                email: messages.auth.login.email,
                inactiveError: messages.auth.login.inactiveError,
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
