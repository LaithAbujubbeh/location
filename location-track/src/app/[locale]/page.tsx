import { notFound } from "next/navigation";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: HomeProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const messages = await getMessages(locale);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface-elevated p-5 text-start shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="font-mono text-xs font-medium text-text-subtle">
              {messages.home.eyebrow}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {messages.home.title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-text-muted">
              {messages.home.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LanguageToggle currentLocale={locale} labels={messages.language} />
            <ThemeToggle
              labels={{
                ariaLabel: messages.theme.label,
                dark: messages.theme.dark,
                light: messages.theme.light,
                system: messages.theme.system,
              }}
            />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>{messages.home.componentsTitle}</CardTitle>
              <CardDescription>
                {messages.home.componentsDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <Button>{messages.home.buttons.primary}</Button>
                <Button variant="secondary">
                  {messages.home.buttons.secondary}
                </Button>
                <Button variant="outline">
                  {messages.home.buttons.outline}
                </Button>
                <Button variant="ghost">{messages.home.buttons.ghost}</Button>
                <Button variant="danger">{messages.home.buttons.danger}</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge>{messages.status.pending}</Badge>
                <Badge tone="primary">{messages.status.inProgress}</Badge>
                <Badge tone="success">{messages.status.completed}</Badge>
                <Badge tone="warning">{messages.status.suspicious}</Badge>
                <Badge tone="danger">{messages.status.failed}</Badge>
                <Badge tone="info">{messages.status.accepted}</Badge>
              </div>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                {messages.home.inputLabel}
                <Input placeholder={messages.home.inputPlaceholder} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{messages.home.tokensTitle}</CardTitle>
              <CardDescription>
                {messages.home.tokensDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="h-12 rounded-md bg-primary" />
                <div className="h-12 rounded-md bg-success" />
                <div className="h-12 rounded-md bg-warning" />
                <div className="h-12 rounded-md bg-danger" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
