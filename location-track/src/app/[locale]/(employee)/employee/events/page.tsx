import { notFound } from "next/navigation";

import { EmployeeEventsClient } from "@/components/employee/employee-events-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type EmployeeEventsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function EmployeeEventsPage({
  params,
}: EmployeeEventsPageProps) {
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
          {messages.employee.events.title}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-text-muted">
          {messages.employee.events.description}
        </p>
      </header>

      <EmployeeEventsClient
        labels={messages.employee.events}
        locale={locale}
        statusLabels={messages.status}
      />
    </div>
  );
}
