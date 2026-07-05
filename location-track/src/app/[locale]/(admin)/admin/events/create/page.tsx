import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminCreateEventClient } from "@/components/admin/admin-create-event-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminCreateEventPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminCreateEventPage({
  params,
}: AdminCreateEventPageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const messages = await getMessages(locale);

  return (
    <div className="grid min-w-0 gap-5">
      <header className="grid min-w-0 gap-3">
        <Link
          className="w-fit text-sm font-medium text-primary hover:text-primary-hover"
          href={`/${locale}/admin/events`}
        >
          {messages.admin.createEvent.backToEvents}
        </Link>
        <div className="grid gap-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {messages.admin.createEvent.title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-text-muted">
            {messages.admin.createEvent.description}
          </p>
        </div>
      </header>

      <AdminCreateEventClient labels={messages.admin.createEvent} locale={locale} />
    </div>
  );
}
