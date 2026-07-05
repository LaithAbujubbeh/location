import Link from "next/link";
import { notFound } from "next/navigation";

import { EmployeeRecheckClient } from "@/components/employee/employee-recheck-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type EmployeeRecheckPageProps = {
  params: Promise<{ eventId: string; locale: string }>;
};

export default async function EmployeeRecheckPage({
  params,
}: EmployeeRecheckPageProps) {
  const { eventId, locale: localeParam } = await params;

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
          href={`/${locale}/employee/events/${eventId}`}
        >
          {messages.employee.recheck.backToEvent}
        </Link>
        <div className="grid gap-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {messages.employee.recheck.title}
          </h1>
          <p className="max-w-prose text-sm leading-6 text-text-muted">
            {messages.employee.recheck.description}
          </p>
        </div>
      </header>

      <EmployeeRecheckClient
        eventId={eventId}
        labels={messages.employee.recheck}
        locale={locale}
        statusLabels={messages.status}
      />
    </div>
  );
}
