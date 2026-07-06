"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  localizedNotificationLink,
  markAllNotificationsRead,
  markNotificationRead,
  notificationQueryKeys,
  notificationQueryOptions,
  type NotificationRecord,
} from "@/lib/notifications";
import type { Locale, Messages } from "@/lib/i18n";

type NotificationBellProps = {
  labels: Messages["notifications"];
  locale: Locale;
};

type NotificationTypeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const notificationTypeTone: Record<string, NotificationTypeTone> = {
  ATTENDANCE_REVIEW: "warning",
  DEVICE: "info",
  RECHECK: "primary",
};

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function notificationTypeLabel(
  type: string,
  labels: Messages["notifications"],
) {
  return labels.types[type as keyof Messages["notifications"]["types"]] ?? type;
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function NotificationPreview({
  labels,
  locale,
  notification,
  onDelete,
  onMarkRead,
  onOpen,
  pending,
}: {
  labels: Messages["notifications"];
  locale: Locale;
  notification: NotificationRecord;
  onDelete: (notificationId: string) => void;
  onMarkRead: (notificationId: string) => void;
  onOpen: (notification: NotificationRecord) => void;
  pending: boolean;
}) {
  const href = localizedNotificationLink(notification.link, locale);
  const unread = !notification.readAt;

  return (
    <article className="grid min-w-0 gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="break-words text-sm font-semibold text-foreground">
            {notification.title}
          </h3>
          <p className="text-xs leading-5 text-text-muted">
            {formatDateTime(notification.createdAt, locale)}
          </p>
        </div>
        <Badge
          className="shrink-0"
          tone={notificationTypeTone[notification.type] ?? "neutral"}
        >
          {notificationTypeLabel(notification.type, labels)}
        </Badge>
        <Badge className="shrink-0" tone={unread ? "warning" : "neutral"}>
          {unread ? labels.state.unread : labels.state.read}
        </Badge>
      </div>

      <p className="break-words text-sm leading-6 text-foreground">
        {notification.message}
      </p>

      <div className="grid gap-2 min-[390px]:grid-cols-2">
        {href ? (
          <button
            className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-md border border-border bg-surface-elevated px-3 py-2 text-center text-sm font-medium leading-tight text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
            disabled={pending}
            onClick={() => onOpen(notification)}
            type="button"
          >
            {labels.actions.openLink}
          </button>
        ) : null}
        <Button
          className="w-full"
          disabled={!unread || pending}
          onClick={() => onMarkRead(notification.id)}
          size="sm"
          variant={unread ? "primary" : "outline"}
        >
          {labels.actions.markRead}
        </Button>
        <Button
          className="w-full min-[390px]:col-span-2"
          disabled={pending}
          onClick={() => onDelete(notification.id)}
          size="sm"
          variant="danger"
        >
          {labels.actions.delete}
        </Button>
      </div>
    </article>
  );
}

export function NotificationBell({ labels, locale }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: () =>
      fetchNotifications({
        page: 1,
        pageSize: 5,
      }),
    queryKey: [...notificationQueryKeys.notifications(), "dropdown"],
    ...notificationQueryOptions,
  });
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.notifications(),
        }),
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.unreadNotifications(),
        }),
      ]);
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.notifications(),
        }),
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.unreadNotifications(),
        }),
      ]);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.notifications(),
        }),
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.unreadNotifications(),
        }),
      ]);
    },
  });
  const deleteAllMutation = useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.notifications(),
        }),
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.unreadNotifications(),
        }),
      ]);
    },
  });
  const unreadCount = query.data?.unreadCount ?? 0;
  const badgeLabel =
    unreadCount > 99 ? labels.badgeOverflow : String(unreadCount);

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const top = Math.min(rect.bottom + 8, window.innerHeight - 96);

    if (viewportWidth < 640) {
      setPanelStyle({
        left: 16,
        right: 16,
        top,
      });
      return;
    }

    const panelWidth = 384;
    const minimumInset = 16;
    const maximumLeft = viewportWidth - panelWidth - minimumInset;
    const preferredLeft =
      locale === "ar" ? rect.right - panelWidth : rect.left;
    const left = Math.min(
      Math.max(preferredLeft, minimumInset),
      Math.max(maximumLeft, minimumInset),
    );

    setPanelStyle({
      left,
      top,
      width: panelWidth,
    });
  }, [locale]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePanelPosition]);

  async function openNotification(notification: NotificationRecord) {
    const href = localizedNotificationLink(notification.link, locale);

    if (!href) {
      return;
    }

    if (!notification.readAt) {
      await markReadMutation.mutateAsync(notification.id);
    }

    setIsOpen(false);
    router.push(href);
  }

  const hasNotifications = Boolean(query.data?.items.length);

  const notificationPanel =
    isOpen && panelStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[1300] grid max-h-[min(34rem,calc(100dvh-6rem))] gap-3 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-3 shadow-[var(--shadow-md)]"
            ref={panelRef}
            style={panelStyle}
          >
            <div className="grid min-w-0 gap-3">
              <div className="grid min-w-0 gap-1">
                <p className="text-sm font-semibold text-foreground">
                  {labels.cardTitle}
                </p>
                <p className="text-xs leading-5 text-text-muted">
                  {labels.cardDescription.replace(
                    "{count}",
                    String(unreadCount),
                  )}
                </p>
              </div>
              <div className="grid gap-2 min-[390px]:grid-cols-2">
                <Button
                  disabled={unreadCount === 0 || markAllReadMutation.isPending}
                  onClick={() => markAllReadMutation.mutate()}
                  size="sm"
                  variant="outline"
                >
                  {labels.actions.markAllRead}
                </Button>
                <Button
                  disabled={!hasNotifications || deleteAllMutation.isPending}
                  onClick={() => deleteAllMutation.mutate()}
                  size="sm"
                  variant="danger"
                >
                  {labels.actions.deleteAll}
                </Button>
              </div>
            </div>

            {query.isLoading ? (
              <div className="grid gap-2">
                <div className="h-20 rounded-md bg-surface-subtle" />
                <div className="h-20 rounded-md bg-surface-subtle" />
              </div>
            ) : null}

            {query.isError ? (
              <div className="rounded-md border border-danger/25 bg-danger/10 px-3 py-3">
                <p className="text-sm font-medium text-danger">
                  {labels.errorTitle}
                </p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => void query.refetch()}
                  size="sm"
                >
                  {labels.actions.retry}
                </Button>
              </div>
            ) : null}

            {!query.isLoading && !query.isError && !query.data?.items.length ? (
              <div className="rounded-md border border-dashed border-border-strong bg-surface px-3 py-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {labels.emptyTitle}
                </p>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  {labels.emptyDescription}
                </p>
              </div>
            ) : null}

            {query.data?.items.length ? (
              <div className="grid min-w-0 gap-3">
                {query.data.items.map((notification) => (
                  <NotificationPreview
                    key={notification.id}
                    labels={labels}
                    locale={locale}
                    notification={notification}
                    onDelete={(notificationId) =>
                      deleteMutation.mutate(notificationId)
                    }
                    onMarkRead={(notificationId) =>
                      markReadMutation.mutate(notificationId)
                    }
                    onOpen={(nextNotification) =>
                      void openNotification(nextNotification)
                    }
                    pending={
                      (markReadMutation.isPending &&
                        markReadMutation.variables === notification.id) ||
                      (deleteMutation.isPending &&
                        deleteMutation.variables === notification.id)
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-label={labels.open}
        className="relative inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -end-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold leading-none text-on-primary">
            {badgeLabel}
          </span>
        ) : null}
      </button>
      {notificationPanel}
    </div>
  );
}
