import api_routes from "@/app_directories/constants/ApiRoutes";
import {
  mapSsePayloadToNotification,
  notificationToApiRow,
  type ApiNotificationRow,
  type SseNotificationPayload,
} from "@/app_directories/types/notification";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import { jwtUserId } from "@/app_directories/utils/jwtPayload";
import { type InfiniteData, type QueryClient } from "@tanstack/react-query";
import {
  fetchEventSource,
  type EventSourceMessage,
} from "@microsoft/fetch-event-source";
import { useEffect, useRef } from "react";

export const NOTIFICATIONS_QUERY_KEY = ["notifications", "feed"] as const;

type NotificationPage = {
  data: ApiNotificationRow[] | null;
  error: unknown;
};

function mergeSseIntoCache(
  queryClient: QueryClient,
  item: ReturnType<typeof mapSsePayloadToNotification>,
) {
  const row = notificationToApiRow(item);
  queryClient.setQueryData<InfiniteData<NotificationPage>>(
    NOTIFICATIONS_QUERY_KEY,
    (old) => {
      if (!old?.pages?.length) {
        return {
          pageParams: [0],
          pages: [{ data: [row], error: null }],
        };
      }
      const pages = old.pages.map((p, i) => {
        if (i !== 0) return p;
        const data = p.data ?? [];
        const j = data.findIndex((r) => r.id === row.id);
        if (j >= 0) {
          const next = [...data];
          next[j] = { ...data[j], ...row };
          return { ...p, data: next };
        }
        return { ...p, data: [row, ...data] };
      });
      return { ...old, pages };
    },
  );
}

export function useNotificationSse(queryClient: QueryClient, enabled: boolean) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (cancelled) return;
      attempt += 1;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;
      const { access_token } = await getTokens();
      if (!access_token || cancelled) return;
      const me = jwtUserId(access_token);
      if (!me) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        await fetchEventSource(api_routes.notifications.sse, {
          signal: abortRef.current.signal,
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: "text/event-stream",
          },
          onopen: async (res: Response) => {
            if (res.ok && res.status === 200) {
              attempt = 0;
              return;
            }
            if (res.status >= 400 && res.status < 500 && res.status !== 429) {
              throw new Error(`SSE HTTP ${res.status}`);
            }
          },
          onmessage(ev: EventSourceMessage) {
            if (!ev.data || cancelled) return;
            try {
              const raw = JSON.parse(ev.data) as SseNotificationPayload;
              if (raw.user?.id && raw.user.id !== me) return;
              const mapped = mapSsePayloadToNotification(raw);
              mergeSseIntoCache(queryClient, mapped);
            } catch {
              /* malformed frame */
            }
          },
          onclose() {
            if (!cancelled) scheduleReconnect();
          },
          onerror() {
            if (cancelled) return;
            scheduleReconnect();
          },
        });
      } catch {
        if (!cancelled) scheduleReconnect();
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      abortRef.current?.abort();
    };
  }, [enabled, queryClient]);
}
