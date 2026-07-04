import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {messages.employee.events.title}
        </h1>
        <p className="text-sm leading-6 text-text-muted">
          {messages.employee.events.description}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{messages.employee.events.cardTitle}</CardTitle>
          <CardDescription>
            {messages.employee.events.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {messages.employee.events.emptyTitle}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {messages.employee.events.emptyDescription}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
