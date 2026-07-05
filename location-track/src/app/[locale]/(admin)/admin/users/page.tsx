import { notFound } from "next/navigation";

import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminUsersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminUsersPage({ params }: AdminUsersPageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const messages = await getMessages(locale);

  return (
    <div className="grid min-w-0 gap-5">
      <header className="grid min-w-0 gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {messages.admin.users.title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-text-muted">
          {messages.admin.users.description}
        </p>
      </header>

      <AdminUsersClient labels={messages.admin.users} locale={locale} />
    </div>
  );
}
