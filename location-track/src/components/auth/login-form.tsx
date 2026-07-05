"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { signIn, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginFormLabels = {
  email: string;
  inactiveError: string;
  password: string;
  submit: string;
  submitting: string;
  requiredError: string;
  invalidError: string;
};

type LoginFormProps = {
  initialError?: string;
  labels: LoginFormLabels;
  nextPath: string;
};

type AuthError = {
  code?: string;
  message?: string;
};

function isInactiveAccountError(error: AuthError | null | undefined) {
  return (
    error?.code === "ACCOUNT_INACTIVE" ||
    error?.message === "This user account is inactive."
  );
}

export function LoginForm({ initialError, labels, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!initialError) {
      return;
    }

    void signOut();
  }, [initialError]);

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
        setError(
          isInactiveAccountError(result.error)
            ? labels.inactiveError
            : labels.invalidError,
        );
        return;
      }

      if (
        result.data?.user &&
        (result.data.user as { isActive?: unknown }).isActive === false
      ) {
        await signOut();
        setError(labels.inactiveError);
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
