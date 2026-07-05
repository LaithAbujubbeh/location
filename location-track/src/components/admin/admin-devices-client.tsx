"use client";

import type { DeviceStatus } from "@prisma/client";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import {
  AdminDeviceApiError,
  adminDeviceQueryKeys,
  adminDeviceQueryOptions,
  approveAdminDevice,
  fetchAdminDevices,
  rejectAdminDevice,
  type AdminDeviceRecord,
} from "@/lib/admin-devices";
import type { Locale, Messages } from "@/lib/i18n";

type AdminDevicesClientProps = {
  labels: Messages["admin"]["devices"];
  locale: Locale;
  statusLabels: Messages["status"];
};

type StatusTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";
type ReviewAction = "approve" | "reject";

const deviceStatuses: Array<DeviceStatus | ""> = [
  "",
  "PENDING",
  "TRUSTED",
  "REJECTED",
];

const statusTone: Record<string, StatusTone> = {
  PENDING: "warning",
  REJECTED: "danger",
  TRUSTED: "success",
};

function formatDateTime(
  value: string | null,
  locale: Locale,
  labels: Messages["admin"]["devices"],
) {
  if (!value) {
    return labels.none;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: string, labels: Messages["status"]) {
  const key = status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  ) as keyof Messages["status"];

  return labels[key] ?? status;
}

function userLabel(
  device: AdminDeviceRecord,
  labels: Messages["admin"]["devices"],
) {
  if (!device.user) {
    return labels.unknownUser;
  }

  return device.user.name || device.user.email;
}

function WarningBox({
  children,
  tone = "danger",
}: {
  children: React.ReactNode;
  tone?: "danger" | "info" | "success";
}) {
  const classes = {
    danger: "border-danger/25 bg-danger/10 text-danger",
    info: "border-info/25 bg-info/10 text-info",
    success: "border-success/20 bg-success/10 text-success",
  };

  return (
    <div
      className={`rounded-md border px-4 py-5 text-sm leading-6 ${classes[tone]}`}
    >
      {children}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-border bg-surface px-3 py-3">
      <dt className="text-xs font-medium uppercase text-text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <div className="h-6 w-2/3 rounded-md bg-surface-subtle" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-16 rounded-md bg-surface-subtle" />
            <div className="h-16 rounded-md bg-surface-subtle" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:pt-5">
          <div className="h-24 rounded-md bg-surface-subtle" />
          <div className="h-24 rounded-md bg-surface-subtle" />
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceActions({
  device,
  isPending,
  labels,
  onReview,
}: {
  device: AdminDeviceRecord;
  isPending: boolean;
  labels: Messages["admin"]["devices"];
  onReview: (device: AdminDeviceRecord, action: ReviewAction) => void;
}) {
  const canApprove = device.status === "PENDING" || device.status === "REJECTED";
  const canReject = device.status === "PENDING" || device.status === "TRUSTED";

  if (!canApprove && !canReject) {
    return <span className="text-sm text-text-muted">{labels.none}</span>;
  }

  return (
    <div className="grid gap-2 min-[390px]:grid-cols-2 lg:flex lg:justify-end">
      {canApprove ? (
        <Button
          className="w-full lg:w-auto"
          disabled={isPending}
          onClick={() => onReview(device, "approve")}
          size="sm"
        >
          {labels.actions.approve}
        </Button>
      ) : null}
      {canReject ? (
        <Button
          className="w-full lg:w-auto"
          disabled={isPending}
          onClick={() => onReview(device, "reject")}
          size="sm"
          variant="danger"
        >
          {labels.actions.reject}
        </Button>
      ) : null}
    </div>
  );
}

function DeviceCard({
  device,
  isPending,
  labels,
  locale,
  onReview,
  statusLabels,
}: {
  device: AdminDeviceRecord;
  isPending: boolean;
  labels: Messages["admin"]["devices"];
  locale: Locale;
  onReview: (device: AdminDeviceRecord, action: ReviewAction) => void;
  statusLabels: Messages["status"];
}) {
  return (
    <Card className="overflow-hidden lg:hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{userLabel(device, labels)}</CardTitle>
            <CardDescription>{device.user?.email ?? device.userId}</CardDescription>
          </div>
          <Badge
            className="w-fit shrink-0"
            tone={statusTone[device.status] ?? "neutral"}
          >
            {getStatusLabel(device.status, statusLabels)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoItem label={labels.fields.deviceId} value={device.deviceId} />
          <InfoItem
            label={labels.fields.createdAt}
            value={formatDateTime(device.createdAt, locale, labels)}
          />
          <InfoItem
            label={labels.fields.approvedAt}
            value={formatDateTime(device.approvedAt, locale, labels)}
          />
          <InfoItem
            label={labels.fields.rejectedAt}
            value={formatDateTime(device.rejectedAt, locale, labels)}
          />
          <InfoItem
            label={labels.fields.userAgent}
            value={device.userAgent ?? labels.none}
          />
        </dl>
        <DeviceActions
          device={device}
          isPending={isPending}
          labels={labels}
          onReview={onReview}
        />
      </CardContent>
    </Card>
  );
}

export function AdminDevicesClient({
  labels,
  locale,
  statusLabels,
}: AdminDevicesClientProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "">("");
  const [actionError, setActionError] = useState<string | null>(null);
  const pageSize = 20;
  const query = useQuery({
    queryFn: () => fetchAdminDevices({ page, pageSize, status: statusFilter }),
    queryKey: [
      ...adminDeviceQueryKeys.adminDevices(),
      page,
      pageSize,
      statusFilter,
    ],
    placeholderData: keepPreviousData,
    ...adminDeviceQueryOptions,
  });
  const reviewMutation = useMutation({
    mutationFn: ({
      action,
      device,
    }: {
      action: ReviewAction;
      device: AdminDeviceRecord;
    }) =>
      action === "approve"
        ? approveAdminDevice(device.id)
        : rejectAdminDevice(device.id),
    onError: (error) => {
      if (error instanceof AdminDeviceApiError) {
        setActionError(error.message);
        return;
      }

      setActionError(labels.errors.reviewFailed);
    },
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: adminDeviceQueryKeys.adminDevices(),
      });
    },
  });

  function reviewDevice(device: AdminDeviceRecord, action: ReviewAction) {
    setActionError(null);
    reviewMutation.mutate({ action, device });
  }

  if (query.isLoading) {
    return <LoadingSkeleton />;
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
          <Button
            className="w-full lg:w-auto"
            onClick={() => void query.refetch()}
            variant="outline"
          >
            {labels.actions.refresh}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)]">
            <select
              className="min-h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as DeviceStatus | "");
              }}
              value={statusFilter}
            >
              {deviceStatuses.map((status) => (
                <option key={status || "all"} value={status}>
                  {status
                    ? getStatusLabel(status, statusLabels)
                    : labels.filters.allStatuses}
                </option>
              ))}
            </select>
          </div>

          {actionError ? <WarningBox>{actionError}</WarningBox> : null}

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
                {data.items.map((device) => (
                  <DeviceCard
                    device={device}
                    isPending={
                      reviewMutation.isPending &&
                      reviewMutation.variables?.device.id === device.id
                    }
                    key={device.id}
                    labels={labels}
                    locale={locale}
                    onReview={reviewDevice}
                    statusLabels={statusLabels}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-md border border-border lg:block">
                <table className="w-full min-w-[72rem] border-collapse text-sm">
                  <thead className="bg-surface-subtle text-xs font-medium uppercase text-text-subtle">
                    <tr>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.employee}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.deviceId}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.status}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.createdAt}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.approvedAt}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.rejectedAt}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {labels.fields.userAgent}
                      </th>
                      <th className="px-3 py-3 text-end">
                        {labels.fields.actions}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-elevated">
                    {data.items.map((device) => (
                      <tr key={device.id}>
                        <td className="max-w-56 px-3 py-3 align-top">
                          <span className="block truncate font-medium text-foreground">
                            {userLabel(device, labels)}
                          </span>
                          <span className="block truncate text-text-muted">
                            {device.user?.email ?? device.userId}
                          </span>
                        </td>
                        <td className="max-w-56 px-3 py-3 align-top text-foreground">
                          <span className="block break-all">{device.deviceId}</span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge tone={statusTone[device.status] ?? "neutral"}>
                            {getStatusLabel(device.status, statusLabels)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 align-top text-foreground">
                          {formatDateTime(device.createdAt, locale, labels)}
                        </td>
                        <td className="px-3 py-3 align-top text-foreground">
                          {formatDateTime(device.approvedAt, locale, labels)}
                        </td>
                        <td className="px-3 py-3 align-top text-foreground">
                          {formatDateTime(device.rejectedAt, locale, labels)}
                        </td>
                        <td className="max-w-64 px-3 py-3 align-top text-text-muted">
                          <span className="block truncate">
                            {device.userAgent ?? labels.none}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-end">
                          <DeviceActions
                            device={device}
                            isPending={
                              reviewMutation.isPending &&
                              reviewMutation.variables?.device.id === device.id
                            }
                            labels={labels}
                            onReview={reviewDevice}
                          />
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
