import { notFound } from "next/navigation";

import { AdminEventTimelineClient } from "@/components/admin/admin-event-timeline-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminEventTimelinePageProps = {
  params: Promise<{
    eventId: string;
    locale: string;
  }>;
};

export default async function AdminEventTimelinePage({
  params,
}: AdminEventTimelinePageProps) {
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
          {messages.admin.timeline.title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-text-muted">
          {messages.admin.timeline.description}
        </p>
      </header>

      <AdminEventTimelineClient
        eventId={eventId}
        labels={messages.admin.timeline}
        locale={locale}
        statusLabels={messages.status}
      />
    </div>
  );
}
