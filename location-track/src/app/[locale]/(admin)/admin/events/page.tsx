import { notFound } from "next/navigation";
import Link from "next/link";

import { AdminEventsClient } from "@/components/admin/admin-events-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminEventsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminEventsPage({ params }: AdminEventsPageProps) {
  const { locale: localeParam } = await params;

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
            {messages.admin.events.title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-text-muted">
            {messages.admin.events.description}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-medium leading-tight text-on-primary shadow-[var(--shadow-sm)] transition-colors hover:bg-primary-hover sm:w-auto"
          href={`/${locale}/admin/events/create`}
        >
          {messages.admin.events.actions.create}
        </Link>
      </header>

      <AdminEventsClient
        labels={messages.admin.events}
        locale={locale}
        statusLabels={messages.status}
      />
    </div>
  );
}
