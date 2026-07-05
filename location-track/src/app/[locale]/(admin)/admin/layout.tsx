import { notFound } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { requireAdminPage } from "@/lib/page-auth";

type AdminLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const session = await requireAdminPage(locale, `/${locale}/admin/events`);
  const messages = await getMessages(locale);

  return (
    <AdminShell
      labels={{
        appName: messages.common.appName,
        areaLabel: messages.admin.shell.areaLabel,
        closeMenu: messages.admin.shell.closeMenu,
        language: messages.language,
        logout: messages.auth.logout,
        nav: messages.admin.nav,
        notifications: messages.notifications,
        openMenu: messages.admin.shell.openMenu,
        signedInAs: messages.auth.signedInAs,
        theme: messages.theme,
      }}
      locale={locale}
      user={session.user}
    >
      {children}
    </AdminShell>
  );
}
