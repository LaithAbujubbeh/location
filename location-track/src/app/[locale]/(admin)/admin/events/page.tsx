import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <header className="grid min-w-0 gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {messages.admin.events.title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-text-muted">
          {messages.admin.events.description}
        </p>
      </header>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{messages.admin.events.cardTitle}</CardTitle>
          <CardDescription>
            {messages.admin.events.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6 sm:py-10">
            <p className="text-sm font-medium text-foreground">
              {messages.admin.events.emptyTitle}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
              {messages.admin.events.emptyDescription}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
