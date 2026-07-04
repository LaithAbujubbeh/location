import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  getDirection,
  getMessages,
  isLocale,
  locales,
  type Locale,
} from "@/lib/i18n";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type ThemeMode = "light" | "dark" | "system";

const themeCookieName = "location-attendance-theme";

function isThemeMode(value: string | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "en";
  const messages = await getMessages(locale);

  return {
    title: messages.metadata.title,
    description: messages.metadata.description,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dir = getDirection(locale);
  const storedThemeMode = (await cookies()).get(themeCookieName)?.value;
  const initialThemeMode = isThemeMode(storedThemeMode)
    ? storedThemeMode
    : "system";
  const initialTheme = initialThemeMode === "dark" ? "dark" : "light";

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={initialTheme}
      data-theme-mode={initialThemeMode}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <ThemeProvider initialMode={initialThemeMode}>
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
