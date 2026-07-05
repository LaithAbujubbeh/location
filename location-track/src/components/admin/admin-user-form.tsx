"use client";

import type { UserRole } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AdminUserApiError,
  adminUserQueryKeys,
  createAdminUser,
  fetchAdminUser,
  updateAdminUser,
  type AdminUserRecord,
} from "@/lib/admin-users";
import type { Locale, Messages } from "@/lib/i18n";

type AdminUserFormProps = {
  labels: Messages["admin"]["users"];
  locale: Locale;
  mode: "create" | "edit";
  userId?: string;
};

type FieldErrors = Partial<Record<"email" | "name" | "password", string>>;

const roles: UserRole[] = ["EMPLOYEE", "ADMIN"];

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-danger/25 bg-danger/10 px-4 py-4 text-sm leading-6 text-danger">
      {children}
    </div>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="text-xs leading-5 text-danger">{error}</span>
      ) : null}
    </label>
  );
}

function getRoleLabel(role: UserRole, labels: Messages["admin"]["users"]["roles"]) {
  return role === "ADMIN" ? labels.admin : labels.employee;
}

export function AdminUserForm({
  labels,
  locale,
  mode,
  userId,
}: AdminUserFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const [name, setName] = useState<string | null>(isEdit ? null : "");
  const [email, setEmail] = useState<string | null>(isEdit ? null : "");
  const [isActive, setIsActive] = useState<boolean | null>(isEdit ? null : true);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole | null>(isEdit ? null : "EMPLOYEE");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const detailQuery = useQuery({
    enabled: isEdit && Boolean(userId),
    queryFn: () => fetchAdminUser(userId ?? ""),
    queryKey: userId
      ? adminUserQueryKeys.adminUserDetails(userId)
      : ["admin", "users", "missing"],
    staleTime: 10_000,
  });

  const loadedUser: AdminUserRecord | null = detailQuery.data?.user ?? null;
  const nameValue = name ?? loadedUser?.name ?? "";
  const emailValue = email ?? loadedUser?.email ?? "";
  const isActiveValue = isActive ?? loadedUser?.isActive ?? true;
  const roleValue = role ?? loadedUser?.role ?? "EMPLOYEE";

  const mutation = useMutation({
    mutationFn: () =>
      isEdit && userId
        ? updateAdminUser(userId, {
            isActive: isActiveValue,
            name: nameValue,
            role: roleValue,
          })
        : createAdminUser({
            email: emailValue,
            isActive: isActiveValue,
            name: nameValue,
            password,
            role: roleValue,
          }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminUserQueryKeys.adminUsers(),
        }),
        queryClient.invalidateQueries({
          queryKey: adminUserQueryKeys.adminUserDetails(result.user.id),
        }),
      ]);
      router.push(`/${locale}/admin/users`);
    },
  });

  const backendError =
    mutation.error instanceof AdminUserApiError ? mutation.error : null;

  function validateForm() {
    const errors: FieldErrors = {};

    if (!nameValue.trim()) {
      errors.name = labels.validation.required;
    }

    if (!isEdit && !emailValue.trim()) {
      errors.email = labels.validation.required;
    }

    if (!isEdit && password.length < 8) {
      errors.password = labels.validation.password;
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    mutation.mutate();
  }

  if (isEdit && detailQuery.isLoading) {
    return (
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <div className="h-8 w-1/2 rounded-md bg-surface-subtle" />
          <div className="h-12 rounded-md bg-surface-subtle" />
          <div className="h-12 rounded-md bg-surface-subtle" />
        </CardContent>
      </Card>
    );
  }

  if (isEdit && detailQuery.isError) {
    return (
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <WarningBox>{labels.errorDescription}</WarningBox>
          <Link
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle sm:w-fit"
            href={`/${locale}/admin/users`}
          >
            {labels.actions.backToUsers}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            {isEdit ? labels.form.editTitle : labels.form.createTitle}
          </CardTitle>
          <CardDescription>
            {isEdit ? labels.form.editDescription : labels.form.createDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field error={fieldErrors.name} label={labels.fields.name}>
            <Input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              value={nameValue}
            />
          </Field>
          <Field error={fieldErrors.email} label={labels.fields.email}>
            <Input
              autoComplete="email"
              disabled={isEdit}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={emailValue}
            />
            {isEdit ? (
              <span className="text-xs leading-5 text-text-muted">
                {labels.form.emailReadonly}
              </span>
            ) : null}
          </Field>
          {!isEdit ? (
            <Field error={fieldErrors.password} label={labels.fields.password}>
              <Input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </Field>
          ) : null}
          <Field label={labels.fields.role}>
            <select
              className="min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
              onChange={(event) => setRole(event.target.value as UserRole)}
              value={roleValue}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {getRoleLabel(item, labels.roles)}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex min-w-0 items-start gap-3 rounded-md border border-border bg-surface px-3 py-3 md:col-span-2">
            <input
              checked={isActiveValue}
              className="mt-1 size-4 accent-primary"
              onChange={(event) => setIsActive(event.target.checked)}
              type="checkbox"
            />
            <span className="grid min-w-0 gap-1">
              <span className="text-sm font-medium text-foreground">
                {labels.fields.isActive}
              </span>
              <span className="text-xs leading-5 text-text-muted">
                {labels.form.isActiveDescription}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {backendError ? (
        <WarningBox>
          <span className="block font-medium">
            {(labels.backendErrors as Record<string, string>)[backendError.code] ??
              labels.backendErrors.REQUEST_FAILED}
          </span>
          <span className="mt-1 block">{backendError.message}</span>
        </WarningBox>
      ) : null}

      {mutation.error && !backendError ? (
        <WarningBox>{labels.errors.unknownSubmitError}</WarningBox>
      ) : null}

      <div className="grid gap-2 sm:flex sm:justify-end">
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle sm:w-auto"
          href={`/${locale}/admin/users`}
        >
          {labels.actions.cancel}
        </Link>
        <Button
          className="w-full sm:w-auto"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending
            ? labels.actions.saving
            : isEdit
              ? labels.actions.save
              : labels.actions.create}
        </Button>
      </div>
    </form>
  );
}
