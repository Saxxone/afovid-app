import api_routes from "@/app_directories/constants/ApiRoutes";
import {
  disconnectChatSocket,
  getChatInboxSocket,
  refreshChatSocketAuth,
} from "@/app_directories/services/chatInboxSocket";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import type { Chat, Room } from "@/app_directories/types/chat";
import { FetchMethod } from "@/app_directories/types/types";
import { getUserIdFromAccessToken } from "@/app_directories/utils/jwtPayload";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "./AppContext";

function peerSenderId(chat: Chat): string | undefined {
  return chat.senderUserId || undefined;
}

async function joinAllRoomSockets(
  socket: ReturnType<typeof getChatInboxSocket>,
  selfId: string,
) {
  const pageSize = 50;
  let skip = 0;
  // Walk the full inbox so users with > 50 threads still receive live events
  // for every room. Cap defensively to avoid runaway loops on server bugs.
  const maxPages = 20;
  for (let page = 0; page < maxPages; page += 1) {
    const url = `${api_routes.room.rooms}?skip=${skip}&take=${pageSize}`;
    const res = await ApiConnectService<Room[]>({
      url,
      method: FetchMethod.GET,
    });
    const rooms = res.data ?? [];
    for (const r of rooms) {
      socket.emit("join-room", { roomId: r.id, userId: selfId });
    }
    if (rooms.length < pageSize) return;
    skip += pageSize;
  }
}

type Ctx = {
  hasUnreadMessages: boolean;
  clearUnread: () => void;
  setActiveChatRoom: (roomId: string | null) => void;
};

const MessageUnreadContext = createContext<Ctx | null>(null);

export function useMessageUnread() {
  const v = useContext(MessageUnreadContext);
  if (!v) {
    throw new Error(
      "useMessageUnread must be used within MessageUnreadProvider",
    );
  }
  return v;
}

type Props = { children: ReactNode };

export function MessageUnreadProvider({ children }: Props) {
  const { session } = useSession();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const activeRoomIdRef = useRef<string | null>(null);
  const selfIdRef = useRef<string | null>(null);

  const setActiveChatRoom = useCallback((roomId: string | null) => {
    activeRoomIdRef.current = roomId;
  }, []);

  const clearUnread = useCallback(() => {
    setHasUnreadMessages(false);
  }, []);

  useEffect(() => {
    if (!session) {
      setHasUnreadMessages(false);
      // Tear the singleton down so the next sign-in starts from a clean
      // handshake rather than reusing an unauthenticated connection.
      disconnectChatSocket();
      return;
    }

    let cancelled = false;

    const s = getChatInboxSocket();

    const onConnect = () => {
      const self = selfIdRef.current;
      if (!self) return;
      void joinAllRoomSockets(s, self);
    };

    const onReceive = (chat: Chat) => {
      if (cancelled) return;
      const me = selfIdRef.current;
      if (!me) return;
      const from = peerSenderId(chat);
      if (!from || from === me) return;
      if (chat.roomId && chat.roomId === activeRoomIdRef.current) {
        return;
      }
      setHasUnreadMessages(true);
    };

    void (async () => {
      const { access_token } = await getTokens();
      if (!access_token || cancelled) return;
      const selfId = getUserIdFromAccessToken(access_token);
      if (!selfId) return;
      selfIdRef.current = selfId;
      if (cancelled) return;

      s.on("connect", onConnect);
      s.on("receive-message", onReceive);
      // Keep the handshake in sync with the latest access token. Without
      // this the gateway disconnects the socket on connect.
      await refreshChatSocketAuth();
      if (cancelled) return;
      if (!s.connected) s.connect();
      if (cancelled) return;
      await joinAllRoomSockets(s, selfId);
    })();

    return () => {
      cancelled = true;
      selfIdRef.current = null;
      s.off("connect", onConnect);
      s.off("receive-message", onReceive);
      setHasUnreadMessages(false);
    };
  }, [session]);

  const value = useMemo(
    () => ({
      hasUnreadMessages,
      clearUnread,
      setActiveChatRoom,
    }),
    [hasUnreadMessages, clearUnread, setActiveChatRoom],
  );

  return (
    <MessageUnreadContext.Provider value={value}>
      {children}
    </MessageUnreadContext.Provider>
  );
}
