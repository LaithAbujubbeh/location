import { notFound } from "next/navigation";

import { AdminEventDetailClient } from "@/components/admin/admin-event-detail-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminEventDetailPageProps = {
  params: Promise<{
    eventId: string;
    locale: string;
  }>;
};

export default async function AdminEventDetailPage({
  params,
}: AdminEventDetailPageProps) {
  const { eventId, locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const messages = await getMessages(locale);

  return (
    <div className="grid min-w-0 gap-5">
      <header className="grid min-w-0 gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {messages.admin.eventDetails.title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-text-muted">
          {messages.admin.eventDetails.description}
        </p>
      </header>

      <AdminEventDetailClient
        eventId={eventId}
        labels={messages.admin.eventDetails}
        locale={locale}
        statusLabels={messages.status}
      />
    </div>
  );
}
