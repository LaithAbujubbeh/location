"use client";

import type { UserRole } from "@prisma/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

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
import {
  adminUserQueryKeys,
  adminUserQueryOptions,
  fetchAdminUsers,
  formatUserDateTime,
  type AdminUserRecord,
} from "@/lib/admin-users";
import type { Locale, Messages } from "@/lib/i18n";

type AdminUsersClientProps = {
  labels: Messages["admin"]["users"];
  locale: Locale;
};

const roleFilters: Array<UserRole | ""> = ["", "EMPLOYEE", "ADMIN"];
const activeFilters: Array<boolean | ""> = ["", true, false];

function getRoleLabel(role: UserRole, labels: Messages["admin"]["users"]["roles"]) {
  return role === "ADMIN" ? labels.admin : labels.employee;
}

function roleTone(role: UserRole) {
  return role === "ADMIN" ? "primary" : "neutral";
}

function activeTone(isActive: boolean) {
  return isActive ? "success" as const : "danger" as const;
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-danger/25 bg-danger/10 px-4 py-5 text-sm leading-6 text-danger">
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-border bg-surface px-3 py-3">
      <dt className="text-xs font-medium uppercase text-text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function UserCard({
  labels,
  locale,
  user,
}: {
  labels: Messages["admin"]["users"];
  locale: Locale;
  user: AdminUserRecord;
}) {
  return (
    <Card className="overflow-hidden lg:hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <Badge className="w-fit shrink-0" tone={roleTone(user.role)}>
            {getRoleLabel(user.role, labels.roles)}
          </Badge>
          <Badge className="w-fit shrink-0" tone={activeTone(user.isActive)}>
            {user.isActive ? labels.status.active : labels.status.inactive}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoItem
            label={labels.fields.createdAt}
            value={formatUserDateTime(user.createdAt, locale)}
          />
          <InfoItem
            label={labels.fields.updatedAt}
            value={formatUserDateTime(user.updatedAt, locale)}
          />
          <InfoItem
            label={labels.fields.accountStatus}
            value={user.isActive ? labels.status.active : labels.status.inactive}
          />
        </dl>
        <Link
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
          href={`/${locale}/admin/users/${user.id}/edit`}
        >
          {labels.actions.edit}
        </Link>
      </CardContent>
    </Card>
  );
}

export function AdminUsersClient({ labels, locale }: AdminUsersClientProps) {
  const [page, setPage] = useState(1);
  const [isActive, setIsActive] = useState<boolean | "">("");
  const [role, setRole] = useState<UserRole | "">("");
  const [search, setSearch] = useState("");
  const pageSize = 20;
  const query = useQuery({
    queryFn: () => fetchAdminUsers({ isActive, page, pageSize, role, search }),
    queryKey: [
      ...adminUserQueryKeys.adminUsers(),
      page,
      pageSize,
      role,
      isActive,
      search,
    ],
    placeholderData: keepPreviousData,
    ...adminUserQueryOptions,
  });

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <div className="h-10 rounded-md bg-surface-subtle" />
          <div className="h-24 rounded-md bg-surface-subtle" />
          <div className="h-24 rounded-md bg-surface-subtle" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <WarningBox>
            <span className="block font-medium">{labels.errorTitle}</span>
            <span className="mt-1 block text-text-muted">
              {labels.errorDescription}
            </span>
          </WarningBox>
          <Button
            className="mt-4 w-full sm:w-fit"
            onClick={() => void query.refetch()}
          >
            {labels.actions.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = query.data;

  if (!data) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid gap-1.5">
            <CardTitle>{labels.cardTitle}</CardTitle>
            <CardDescription>{labels.cardDescription}</CardDescription>
          </div>
          <Link
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-medium leading-tight text-on-primary shadow-[var(--shadow-sm)] transition-colors hover:bg-primary-hover lg:w-auto"
            href={`/${locale}/admin/users/create`}
          >
            {labels.actions.create}
          </Link>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,14rem)]">
            <Input
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={labels.filters.searchPlaceholder}
              value={search}
            />
            <select
              className="min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
              onChange={(event) => {
                setPage(1);
                setRole(event.target.value as UserRole | "");
              }}
              value={role}
            >
              {roleFilters.map((item) => (
                <option key={item || "all"} value={item}>
                  {item ? getRoleLabel(item, labels.roles) : labels.filters.allRoles}
                </option>
              ))}
            </select>
            <select
              className="min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
              onChange={(event) => {
                setPage(1);
                setIsActive(
                  event.target.value === ""
                    ? ""
                    : event.target.value === "true",
                );
              }}
              value={isActive === "" ? "" : String(isActive)}
            >
              {activeFilters.map((item) => (
                <option
                  key={item === "" ? "all" : String(item)}
                  value={String(item)}
                >
                  {item === ""
                    ? labels.filters.allStatuses
                    : item
                      ? labels.status.active
                      : labels.status.inactive}
                </option>
              ))}
            </select>
          </div>

          {!data.items.length ? (
            <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-8 text-center sm:px-6 sm:py-10">
              <p className="text-sm font-medium text-foreground">
                {labels.emptyTitle}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-muted">
                {labels.emptyDescription}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:hidden">
                {data.items.map((user) => (
                  <UserCard
                    key={user.id}
                    labels={labels}
                    locale={locale}
                    user={user}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-md border border-border lg:block">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead className="bg-surface-subtle text-xs font-medium uppercase text-text-subtle">
                    <tr>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.name}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.email}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.role}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.accountStatus}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.createdAt}
                      </th>
                      <th className="px-3 py-3 text-end">
                        {labels.fields.actions}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-elevated">
                    {data.items.map((user) => (
                      <tr key={user.id}>
                        <td className="max-w-56 px-3 py-3 align-top font-medium text-foreground">
                          <span className="block truncate">{user.name}</span>
                        </td>
                        <td className="max-w-64 px-3 py-3 align-top text-text-muted">
                          <span className="block truncate">{user.email}</span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge tone={roleTone(user.role)}>
                            {getRoleLabel(user.role, labels.roles)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge tone={activeTone(user.isActive)}>
                            {user.isActive
                              ? labels.status.active
                              : labels.status.inactive}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 align-top text-text-muted">
                          {formatUserDateTime(user.createdAt, locale)}
                        </td>
                        <td className="px-3 py-3 text-end align-top">
                          <Link
                            className="inline-flex min-h-9 min-w-0 items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
                            href={`/${locale}/admin/users/${user.id}/edit`}
                          >
                            {labels.actions.edit}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="text-sm text-text-muted">
                  {labels.pagination.summary
                    .replace("{page}", String(data.pagination.page))
                    .replace(
                      "{totalPages}",
                      String(Math.max(data.pagination.totalPages, 1)),
                    )
                    .replace("{total}", String(data.pagination.total))}
                </p>
                <div className="grid gap-2 min-[390px]:grid-cols-2 sm:flex">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!data.pagination.hasPreviousPage}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    variant="outline"
                  >
                    {labels.pagination.previous}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!data.pagination.hasNextPage}
                    onClick={() => setPage((value) => value + 1)}
                    variant="outline"
                  >
                    {labels.pagination.next}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
