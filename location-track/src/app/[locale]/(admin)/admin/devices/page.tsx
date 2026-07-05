import { notFound } from "next/navigation";

import { AdminDevicesClient } from "@/components/admin/admin-devices-client";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type AdminDevicesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDevicesPage({ params }: AdminDevicesPageProps) {
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
          {messages.admin.devices.title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-text-muted">
          {messages.admin.devices.description}
        </p>
      </header>

      <AdminDevicesClient
        labels={messages.admin.devices}
        locale={locale}
        statusLabels={messages.status}
      />
    </div>
  );
}
