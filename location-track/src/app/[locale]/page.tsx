import { redirect } from "next/navigation";

import { getCurrentSession, isUserRole } from "@/lib/permissions";
import { loginPath, roleHomePath } from "@/lib/page-auth";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: HomeProps) {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const session = await getCurrentSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (isUserRole(role)) {
    redirect(roleHomePath(locale, role));
  }

  redirect(loginPath(locale));
}
