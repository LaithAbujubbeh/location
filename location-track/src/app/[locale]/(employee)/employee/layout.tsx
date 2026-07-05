import { notFound } from "next/navigation";

import { EmployeeShell } from "@/components/layout/employee-shell";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { requireEmployeePage } from "@/lib/page-auth";

type EmployeeLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function EmployeeLayout({
  children,
  params,
}: EmployeeLayoutProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const session = await requireEmployeePage(locale, `/${locale}/employee/events`);
  const messages = await getMessages(locale);

  return (
    <EmployeeShell
      labels={{
        appName: messages.common.appName,
        areaLabel: messages.employee.shell.areaLabel,
        language: messages.language,
        logout: messages.auth.logout,
        nav: messages.employee.nav,
        notifications: messages.notifications,
        signedInAs: messages.auth.signedInAs,
        theme: messages.theme,
      }}
      locale={locale}
      user={session.user}
    >
      {children}
    </EmployeeShell>
  );
}
