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

export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface-elevated p-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="font-mono text-xs font-medium text-text-subtle">
              Design system setup
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Location Attendance
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-text-muted">
              Theme tokens, dark mode, base components, and theme switching are
              ready for the next implementation step.
            </p>
          </div>
          <ThemeToggle
            labels={{
              ariaLabel: "Theme",
              dark: "Dark",
              light: "Light",
              system: "System",
            }}
          />
        </header>

        <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Base components</CardTitle>
              <CardDescription>
                Buttons, badges, inputs, cards, and loading placeholders use
                semantic design tokens.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge>Pending</Badge>
                <Badge tone="primary">In Progress</Badge>
                <Badge tone="success">Completed</Badge>
                <Badge tone="warning">Suspicious</Badge>
                <Badge tone="danger">Failed</Badge>
                <Badge tone="info">Info</Badge>
              </div>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                Sample input
                <Input placeholder="Employee name" />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Theme tokens</CardTitle>
              <CardDescription>
                The palette keeps the required blue primary and status tones
                aligned across light and dark modes.
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
