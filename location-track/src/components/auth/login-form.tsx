"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginFormLabels = {
  email: string;
  password: string;
  submit: string;
  submitting: string;
  requiredError: string;
  invalidError: string;
};

type LoginFormProps = {
  labels: LoginFormLabels;
  nextPath: string;
};

export function LoginForm({ labels, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError(labels.requiredError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn.email({
        email,
        password,
        rememberMe: true,
      });

      if (result.error) {
        setError(labels.invalidError);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError(labels.invalidError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid min-w-0 gap-5" onSubmit={handleSubmit}>
      <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
        {labels.email}
        <Input
          autoComplete="email"
          name="email"
          required
          type="email"
        />
      </label>

      <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
        {labels.password}
        <Input
          autoComplete="current-password"
          name="password"
          required
          type="password"
        />
      </label>

      {error ? (
        <p className="break-words rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
