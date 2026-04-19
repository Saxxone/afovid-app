import { DateString } from "./types";
import type { Author } from "./user";

export interface Notification {
  id: string;
  date: DateString | null;
  author?: Author;
  description: string;
  trigger?: unknown;
  read?: boolean;
  postId?: string | null;
  commentId?: string | null;
  notificationType?: string;
}

export type ApiNotificationRow = {
  id: string;
  userId: string;
  description: string;
  createdAt: string;
  type?: string;
  read?: boolean;
  postId?: string | null;
  commentId?: string | null;
};

export function mapApiRowToNotification(row: ApiNotificationRow): Notification {
  return {
    id: row.id,
    date: row.createdAt as DateString,
    description: row.description,
    author: undefined,
    read: row.read ?? false,
    postId: row.postId ?? undefined,
    commentId: row.commentId ?? undefined,
    notificationType: row.type,
    trigger: row.type ? { type: row.type } : undefined,
  };
}

export type SseNotificationPayload = {
  id?: string;
  date?: string;
  description?: string;
  author?: Partial<Author>;
  user?: { id?: string };
  type?: string;
  postId?: string | null;
  commentId?: string | null;
  read?: boolean;
};

/** Shape expected by the notifications infinite-query cache (API rows). */
export function notificationToApiRow(n: Notification): ApiNotificationRow {
  return {
    id: n.id,
    userId: "",
    description: n.description,
    createdAt:
      typeof n.date === "string" && n.date.length > 0
        ? n.date
        : new Date().toISOString(),
    type: n.notificationType,
    read: n.read,
    postId: n.postId ?? null,
    commentId: n.commentId ?? null,
  };
}

export function mapSsePayloadToNotification(
  payload: SseNotificationPayload,
): Notification {
  const author = payload.author as Author | undefined;
  return {
    id:
      payload.id ??
      `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: (payload.date as DateString | undefined) ?? null,
    description: payload.description ?? "",
    author,
    read: payload.read ?? false,
    postId: payload.postId ?? undefined,
    commentId: payload.commentId ?? undefined,
    notificationType: payload.type,
    trigger: undefined,
  };
}
