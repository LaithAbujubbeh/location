import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminUserForm } from "@/components/admin/admin-user-form";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminEditUserPageProps = {
  params: Promise<{
    locale: string;
    userId: string;
  }>;
};

export default async function AdminEditUserPage({
  params,
}: AdminEditUserPageProps) {
  const { locale: localeParam, userId } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const messages = await getMessages(locale);

  return (
    <div className="grid min-w-0 gap-5">
      <header className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="grid min-w-0 gap-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {messages.admin.users.editTitle}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-text-muted">
            {messages.admin.users.editDescription}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle sm:w-auto"
          href={`/${locale}/admin/users`}
        >
          {messages.admin.users.actions.backToUsers}
        </Link>
      </header>

      <AdminUserForm
        labels={messages.admin.users}
        locale={locale}
        mode="edit"
        userId={userId}
      />
    </div>
  );
}
