import Text from "@/app_directories/components/app/Text";
import EncryptionSetupPanel from "@/app_directories/components/messages/EncryptionSetupPanel";
import api_routes from "@/app_directories/constants/ApiRoutes";
import {
  gray_200,
  gray_300,
  gray_400,
  gray_500,
  gray_700,
  gray_800,
  gray_900,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { useMessageUnread } from "@/app_directories/context/MessageUnreadContext";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import {
  claimPrekeys,
  ensureOlmReady,
  getStoredDeviceId,
  registerDeviceWithServer,
  replenishOtksIfNeeded,
} from "@/app_directories/crypto/olm/deviceApi";
import { decrypt, encrypt } from "@/app_directories/crypto/olm/olmClient";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import {
  getChatInboxSocket,
  refreshChatSocketAuth,
} from "@/app_directories/services/chatInboxSocket";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { uploadFilesWithProgress } from "@/app_directories/services/uploadWithProgress";
import type {
  Chat,
  ChatEnvelope,
  ClaimedPrekey,
  Room,
} from "@/app_directories/types/chat";
import { FetchMethod, type Snack } from "@/app_directories/types/types";
import { getUserIdFromAccessToken } from "@/app_directories/utils/jwtPayload";
import { resolvePlaybackUrl } from "@/app_directories/utils/playbackUrl";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function sortChatsAsc(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
}

function isLikelyMediaUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  return (
    /\.(png|jpe?g|gif|webp|mp4|webm)(\?|$)/i.test(t) || t.includes("/file/")
  );
}

const CLAIM_DEDUPE_MS = 8_000;
const RETRY_BACKOFF_BASE_MS = 10_000;
const RETRY_BACKOFF_MAX_MS = 40_000;
const OUTBOUND_CACHE_KEY = "@afovid/chat/outbound-plaintext-v1";
const OUTBOUND_CACHE_MAX = 500;
const INBOUND_CACHE_KEY = "@afovid/chat/inbound-plaintext-v1";
const INBOUND_CACHE_MAX = 1000;

function isThrottle429(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; message?: string };
  if (e.status === 429) return true;
  return /too many requests|throttlerexception/i.test(e.message ?? "");
}

/** Look up a sender's device identity key from the cached room participants. */
function findSenderIdentityKey(
  directIdentityKey: string | null | undefined,
  room: Room | null,
  _senderUserId: string,
  senderDeviceId: string,
): string | null {
  if (directIdentityKey) return directIdentityKey;
  if (!room?.participants) return null;
  for (const p of room.participants) {
    const device = p.devices?.find((d) => d.id === senderDeviceId);
    if (device) return device.identityKeyCurve25519;
  }
  return null;
}

async function restoreInboundPlaintextCache(
  cache: Map<string, string>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(INBOUND_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [envelopeId, plaintext] of Object.entries(parsed)) {
      if (
        !envelopeId ||
        typeof plaintext !== "string" ||
        plaintext.length === 0
      )
        continue;
      cache.set(envelopeId, plaintext);
    }
  } catch {
    // Best-effort cache hydrate; unreadable cache should never break chat.
  }
}

async function restoreOutboundPlaintextCache(
  cache: Map<string, string>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOUND_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [chatId, plaintext] of Object.entries(parsed)) {
      if (!chatId || typeof plaintext !== "string" || plaintext.length === 0)
        continue;
      cache.set(chatId, plaintext);
    }
  } catch {
    // Best-effort cache hydrate; unreadable cache should never break chat.
  }
}

async function persistInboundPlaintextCache(
  cache: Map<string, string>,
  envelopeId: string,
  plaintext: string,
): Promise<void> {
  if (!envelopeId) return;
  cache.set(envelopeId, plaintext);
  try {
    const next = Object.fromEntries(cache.entries());
    const ids = Object.keys(next);
    if (ids.length > INBOUND_CACHE_MAX) {
      for (const staleId of ids.slice(0, ids.length - INBOUND_CACHE_MAX)) {
        delete next[staleId];
        cache.delete(staleId);
      }
    }
    await AsyncStorage.setItem(INBOUND_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort persistence only.
  }
}

async function persistOutboundPlaintextCache(
  cache: Map<string, string>,
  chatId: string,
  plaintext: string,
): Promise<void> {
  if (!chatId) return;
  cache.set(chatId, plaintext);
  try {
    const next = Object.fromEntries(cache.entries());
    const ids = Object.keys(next);
    if (ids.length > OUTBOUND_CACHE_MAX) {
      for (const staleId of ids.slice(0, ids.length - OUTBOUND_CACHE_MAX)) {
        delete next[staleId];
        cache.delete(staleId);
      }
    }
    await AsyncStorage.setItem(OUTBOUND_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort persistence only.
  }
}

function ChatLine({
  item,
  selfDeviceId,
  selfUserId,
  room,
  accessToken,
  outboundPlaintext,
  inboundPlaintext,
}: {
  item: Chat;
  selfDeviceId: string;
  selfUserId: string;
  room: Room | null;
  accessToken: string;
  outboundPlaintext: Map<string, string>;
  inboundPlaintext: Map<string, string>;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useI18n();
  const [lineText, setLineText] = useState("…");
  const mine = item.senderUserId === selfUserId;
  const unreadableText = t("chat.unreadable_on_this_device");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (mine) {
        const cached = item.id ? outboundPlaintext.get(item.id) : undefined;
        if (cached) {
          setLineText(cached);
          return;
        }
        // Olm sessions cannot decrypt their own outbound ciphertext; if we
        // missed caching (e.g., app restarted mid-send) there is nothing we
        // can show.
        setLineText(unreadableText);
        return;
      }
      const env = item.envelopes?.find(
        (e) => e.recipientDeviceId === selfDeviceId,
      );
      if (!env) {
        setLineText(unreadableText);
        return;
      }
      const cachedInbound = env.id ? inboundPlaintext.get(env.id) : undefined;
      if (cachedInbound) {
        setLineText(cachedInbound);
        return;
      }
      const senderIdentity = findSenderIdentityKey(
        item.senderIdentityKeyCurve25519,
        room,
        item.senderUserId,
        item.senderDeviceId,
      );
      if (!senderIdentity) {
        setLineText(unreadableText);
        return;
      }
      try {
        const plain = await decrypt({
          senderDeviceId: item.senderDeviceId,
          senderIdentityKeyCurve25519: senderIdentity,
          ciphertext: env.ciphertext,
          messageType: env.messageType,
        });
        if (!cancelled) setLineText(plain);
        if (env.id) {
          void persistInboundPlaintextCache(inboundPlaintext, env.id, plain);
        }
      } catch {
        if (!cancelled) setLineText(unreadableText);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    inboundPlaintext,
    item,
    mine,
    outboundPlaintext,
    room,
    selfDeviceId,
    unreadableText,
  ]);

  const plain =
    lineText !== "…" && lineText !== unreadableText ? lineText.trim() : "";
  const showRichMedia = !!plain && isLikelyMediaUrl(plain) && !!accessToken;
  const mediaUri = showRichMedia
    ? resolvePlaybackUrl(plain, accessToken, { requiresAuth: true })
    : "";
  const isVideo =
    /\.(mp4|webm)(\?|$)/i.test(plain) || plain.toLowerCase().includes("video");
  const bubbleBg = mine
    ? isDark
      ? gray_700
      : gray_300
    : isDark
      ? gray_900
      : white;
  const lineColor = isDark ? gray_200 : gray_900;

  return (
    <View
      style={[
        tailwindClasses(
          `mb-2 max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "self-end" : "self-start"}`,
        ),
        { backgroundColor: bubbleBg },
      ]}
    >
      {mediaUri && !isVideo ? (
        <Image
          source={{ uri: mediaUri }}
          style={{ width: 220, height: 220, borderRadius: 8 }}
          contentFit="cover"
        />
      ) : null}
      {mediaUri && isVideo ? (
        <Text style={{ color: lineColor, fontSize: 14 }}>
          Video attachment: {plain}
        </Text>
      ) : null}
      {!mediaUri ? <Text style={{ color: lineColor }}>{lineText}</Text> : null}
    </View>
  );
}

export default function MessageRoomScreen() {
  const params = useLocalSearchParams<{
    r?: string | string[];
    u?: string | string[];
  }>();
  const rid = typeof params.r === "string" ? params.r : params.r?.[0];
  const uidPeer = typeof params.u === "string" ? params.u : params.u?.[0];

  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { snackBar, setSnackBar } = useSnackBar();
  const screenBg = isDark ? gray_800 : gray_200;
  const headerButtonBg = isDark ? gray_900 : white;
  const headerIconColor = isDark ? gray_300 : gray_700;
  const titleColor = isDark ? gray_200 : gray_900;
  const composerBg = isDark ? gray_900 : white;
  const composerBorder = isDark ? gray_700 : gray_300;
  const composerInputColor = isDark ? gray_200 : gray_900;
  const composerPlaceholder = isDark ? gray_400 : gray_500;
  const composerActionIcon = isDark ? gray_300 : gray_700;
  const sendIconDisabled = isDark ? gray_500 : gray_400;
  const loaderColor = isDark ? gray_200 : gray_700;

  const showSnack = useCallback(
    (patch: Partial<Snack>) => {
      setSnackBar({ ...snackBar, ...patch, visible: true });
    },
    [setSnackBar, snackBar],
  );

  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfDeviceId, setSelfDeviceId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [sending, setSending] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [retrySignal, setRetrySignal] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryInFlightRef = useRef(false);
  const retryBackoffMsRef = useRef(RETRY_BACKOFF_BASE_MS);
  const retryPausedUntilRef = useRef(0);

  /** Plaintext cache for outbound messages keyed by `chatId`. */
  const outboundPlaintext = useRef<Map<string, string>>(new Map()).current;
  const inboundPlaintext = useRef<Map<string, string>>(new Map()).current;
  const pendingRetryPlaintexts = useRef<string[]>([]);
  const claimCacheRef = useRef<
    Map<string, { at: number; bundles: ClaimedPrekey[] }>
  >(new Map());

  const { setActiveChatRoom } = useMessageUnread();
  const listRef = useRef<FlatList<Chat>>(null);

  const receiver = useMemo(() => {
    if (!room?.participants || !selfId) return null;
    return room.participants.find((p) => p.id !== selfId) ?? null;
  }, [room, selfId]);

  const peerTitle = receiver?.name ?? room?.name ?? t("chat.page_title");

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation, peerTitle]);

  const fetchRoom = useCallback(
    async (uid: string, currentDeviceId?: string | null) => {
      const deviceQuery = currentDeviceId
        ? `deviceId=${encodeURIComponent(currentDeviceId)}`
        : "";
      if (rid) {
        const res = await ApiConnectService<Room>({
          url: deviceQuery
            ? `${api_routes.room.room(rid)}?${deviceQuery}`
            : api_routes.room.room(rid),
          method: FetchMethod.GET,
        });
        if (res.data) setRoom(res.data);
      } else if (uidPeer) {
        const res = await ApiConnectService<Room>({
          url: deviceQuery
            ? `${api_routes.room.findRoomByParticipantsOrCreate(uidPeer, uid)}&${deviceQuery}`
            : api_routes.room.findRoomByParticipantsOrCreate(uidPeer, uid),
          method: FetchMethod.POST,
        });
        if (res.data) setRoom(res.data);
      }
    },
    [rid, uidPeer],
  );

  const initRoom = useCallback(async () => {
    setLoading(true);
    const { access_token } = await getTokens();
    if (!access_token) {
      setLoading(false);
      return;
    }
    setAccessToken(access_token);
    const uid = getUserIdFromAccessToken(access_token);
    setSelfId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }

    await ensureOlmReady();
    await restoreOutboundPlaintextCache(outboundPlaintext);
    await restoreInboundPlaintextCache(inboundPlaintext);
    const currentDeviceId = await getStoredDeviceId();
    setSelfDeviceId(currentDeviceId);

    try {
      await fetchRoom(uid, currentDeviceId);
    } catch {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: t("messages.no_results"),
      });
    }
    setLoading(false);
  }, [fetchRoom, showSnack, t]);

  useEffect(() => {
    void initRoom();
  }, [initRoom]);

  const loadMessages = useCallback(async () => {
    if (!room?.id || !selfDeviceId) return;
    const url = `${api_routes.room.chats(room.id)}?skip=0&take=100&deviceId=${encodeURIComponent(selfDeviceId)}`;
    const res = await ApiConnectService<Chat[]>({
      url,
      method: FetchMethod.GET,
    });
    if (res.data) setMessages(sortChatsAsc(res.data));
  }, [room?.id, selfDeviceId]);

  useEffect(() => {
    if (room?.id && selfDeviceId) void loadMessages();
  }, [loadMessages, room?.id, selfDeviceId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length, room?.id]);

  useEffect(() => {
    if (!room?.id) {
      setActiveChatRoom(null);
      return;
    }
    setActiveChatRoom(room.id);
    return () => setActiveChatRoom(null);
  }, [room?.id, setActiveChatRoom]);

  useEffect(() => {
    if (!room?.id || !selfId || !selfDeviceId) return;
    const s = getChatInboxSocket();
    const activeRoomId = room.id;

    const onReceive = (chat: Chat) => {
      if (chat.roomId && chat.roomId !== activeRoomId) return;
      setMessages((prev) => {
        if (chat.id && prev.some((m) => m.id === chat.id)) return prev;
        return sortChatsAsc([...prev, chat]);
      });
      if (chat.id) {
        s.emit("ack-envelopes", {
          chatIds: [chat.id],
          deviceId: selfDeviceId,
        });
      }
    };

    const onException = (err: { message?: string }) => {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: err?.message ?? t("chat.send_failed"),
      });
    };
    const onRecipientDevicesAvailable = (evt: {
      roomId?: string;
      recipientUserId?: string;
    }) => {
      if (!evt?.recipientUserId || evt.recipientUserId !== receiver?.id) return;
      if (evt.roomId && evt.roomId !== activeRoomId) return;
      if (pendingRetryPlaintexts.current.length === 0) return;
      setRetrySignal((v) => v + 1);
    };

    const onConnect = () => {
      s.emit("join-room", { roomId: activeRoomId, userId: selfId });
    };

    s.on("receive-message", onReceive);
    s.on("exception", onException);
    s.on("recipient-devices-available", onRecipientDevicesAvailable);
    s.on("connect", onConnect);
    s.auth = { ...(s.auth as object | undefined), deviceId: selfDeviceId };
    if (s.connected) {
      s.emit("join-room", { roomId: activeRoomId, userId: selfId });
    } else {
      void (async () => {
        await refreshChatSocketAuth();
        s.auth = { ...(s.auth as object | undefined), deviceId: selfDeviceId };
        if (!s.connected) s.connect();
      })();
    }

    return () => {
      s.off("receive-message", onReceive);
      s.off("exception", onException);
      s.off("recipient-devices-available", onRecipientDevicesAvailable);
      s.off("connect", onConnect);
    };
  }, [receiver?.id, room?.id, selfDeviceId, selfId, showSnack, t]);

  const onRegister = useCallback(async () => {
    if (!selfId) return;
    setRegistering(true);
    try {
      const id = await registerDeviceWithServer();
      setSelfDeviceId(id);
      await refreshChatSocketAuth();
      void replenishOtksIfNeeded();
    } catch (e) {
      showSnack({
        type: "error",
        title: t("common.error"),
        message:
          e instanceof Error ? e.message : t("security.device_not_registered"),
      });
    } finally {
      setRegistering(false);
    }
  }, [selfId, showSnack, t]);

  const buildEnvelopes = useCallback(
    async (
      plaintext: string,
      preclaimed?: Record<string, ClaimedPrekey[]>,
    ): Promise<
      Pick<
        ChatEnvelope,
        "recipientUserId" | "recipientDeviceId" | "ciphertext" | "messageType"
      >[]
    > => {
      if (!room || !selfId || !selfDeviceId) return [];
      const recipients = (room.participants ?? [])
        .map((p) => p.id)
        .filter((id): id is string => !!id);

      const now = Date.now();
      const claims: Record<string, ClaimedPrekey[]> = preclaimed ?? {};
      if (!preclaimed) {
        await Promise.all(
          recipients.map(async (uid) => {
            const cached = claimCacheRef.current.get(uid);
            if (cached && now - cached.at < CLAIM_DEDUPE_MS) {
              claims[uid] = cached.bundles;
              return;
            }
            try {
              const bundles = await claimPrekeys(uid);
              claims[uid] = bundles;
              claimCacheRef.current.set(uid, { at: Date.now(), bundles });
            } catch (e) {
              if (isThrottle429(e)) {
                const err = new Error("Too Many Requests");
                (err as Error & { status?: number }).status = 429;
                throw err;
              }
              claims[uid] = [];
            }
          }),
        );
      }

      const out: Array<{
        recipientUserId: string;
        recipientDeviceId: string;
        ciphertext: string;
        messageType: 0 | 1;
      }> = [];

      for (const uid of recipients) {
        for (const bundle of claims[uid] ?? []) {
          if (uid === selfId && bundle.deviceId === selfDeviceId) continue;
          try {
            const env = await encrypt({
              recipientDeviceId: bundle.deviceId,
              recipientIdentityKeyCurve25519: bundle.identityKeyCurve25519,
              recipientIdentityKeyEd25519: bundle.identityKeyEd25519,
              signedPrekey: {
                keyId: bundle.signedPrekey.keyId,
                publicKey: bundle.signedPrekey.publicKey,
                signature: bundle.signedPrekey.signature,
              },
              plaintext,
            });
            out.push({
              recipientUserId: uid,
              recipientDeviceId: bundle.deviceId,
              ciphertext: env.ciphertext,
              messageType: env.messageType,
            });
          } catch {
            // Skip devices that refuse the prekey; surface via missing fanout.
          }
        }
      }
      return out;
    },
    [room, selfDeviceId, selfId],
  );

  const emitEncryptedMessage = useCallback(
    async (
      plaintext: string,
      preclaimed?: Record<string, ClaimedPrekey[]>,
    ): Promise<boolean> => {
      if (!room?.id || !selfDeviceId) return false;
      const envelopes = await buildEnvelopes(plaintext, preclaimed);
      if (envelopes.length === 0) return false;
      const payload = {
        roomId: room.id,
        senderDeviceId: selfDeviceId,
        envelopes,
      };
      getChatInboxSocket().emit(
        "send-message",
        payload,
        (ack: Chat | undefined) => {
          if (!ack?.id) return;
          outboundPlaintext.set(ack.id, plaintext);
          void persistOutboundPlaintextCache(
            outboundPlaintext,
            ack.id,
            plaintext,
          );
          setMessages((prev) => {
            if (prev.some((m) => m.id === ack.id)) return prev;
            return sortChatsAsc([...prev, ack]);
          });
        },
      );
      void replenishOtksIfNeeded();
      return true;
    },
    [buildEnvelopes, outboundPlaintext, room?.id, selfDeviceId],
  );

  const schedulePendingRetry = useCallback(
    (delayMs = 10_000) => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (retryInFlightRef.current) return;
        retryInFlightRef.current = true;
        void (async () => {
          try {
            const now = Date.now();
            if (retryPausedUntilRef.current > now) {
              schedulePendingRetry(retryPausedUntilRef.current - now);
              return;
            }
            if (
              !room?.id ||
              !selfId ||
              !selfDeviceId ||
              pendingRetryPlaintexts.current.length === 0
            ) {
              return;
            }
            const recipients = (room.participants ?? [])
              .map((p) => p.id)
              .filter((id): id is string => !!id);
            const claimNow = Date.now();
            const preclaimed: Record<string, ClaimedPrekey[]> = {};
            await Promise.all(
              recipients.map(async (uid) => {
                const cached = claimCacheRef.current.get(uid);
                if (cached && claimNow - cached.at < CLAIM_DEDUPE_MS) {
                  preclaimed[uid] = cached.bundles;
                  return;
                }
                const bundles = await claimPrekeys(uid);
                preclaimed[uid] = bundles;
                claimCacheRef.current.set(uid, { at: Date.now(), bundles });
              }),
            );
            const stillPending: string[] = [];
            let deliveredCount = 0;
            for (const plaintext of pendingRetryPlaintexts.current) {
              try {
                const delivered = await emitEncryptedMessage(
                  plaintext,
                  preclaimed,
                );
                if (delivered) deliveredCount += 1;
                else stillPending.push(plaintext);
              } catch {
                stillPending.push(plaintext);
              }
            }
            pendingRetryPlaintexts.current = stillPending;
            retryBackoffMsRef.current = RETRY_BACKOFF_BASE_MS;
            retryPausedUntilRef.current = 0;
            if (deliveredCount > 0) {
              showSnack({
                type: "success",
                title: t("common.success"),
                message:
                  deliveredCount === 1
                    ? "Queued message delivered."
                    : `${deliveredCount} queued messages delivered.`,
              });
            }
            if (pendingRetryPlaintexts.current.length > 0) {
              schedulePendingRetry();
            }
          } catch (e) {
            if (isThrottle429(e)) {
              const pause = retryBackoffMsRef.current;
              retryPausedUntilRef.current = Date.now() + pause;
              retryBackoffMsRef.current = Math.min(
                retryBackoffMsRef.current * 2,
                RETRY_BACKOFF_MAX_MS,
              );
              schedulePendingRetry(pause);
              return;
            }
            schedulePendingRetry();
          } finally {
            retryInFlightRef.current = false;
          }
        })();
      }, delayMs);
    },
    [emitEncryptedMessage, room, selfDeviceId, selfId, showSnack, t],
  );

  const send = useCallback(async () => {
    if (sending || !draft.trim() || !room?.id || !selfId || !selfDeviceId)
      return;
    setSending(true);
    const plaintext = draft.trim();
    setDraft("");
    try {
      const delivered = await emitEncryptedMessage(plaintext);
      if (!delivered) {
        pendingRetryPlaintexts.current.push(plaintext);
        showSnack({
          type: "info",
          title: t("chat.page_title"),
          message:
            "No recipient devices yet. Message queued and will auto-send when a device appears.",
        });
        schedulePendingRetry(3_000);
        return;
      }
    } catch (e) {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: e instanceof Error ? e.message : t("chat.send_failed"),
      });
    } finally {
      setSending(false);
    }
  }, [
    buildEnvelopes,
    draft,
    emitEncryptedMessage,
    outboundPlaintext,
    room?.id,
    schedulePendingRetry,
    selfDeviceId,
    selfId,
    sending,
    showSnack,
    t,
  ]);

  useEffect(() => {
    if (
      !room?.id ||
      !selfId ||
      !selfDeviceId ||
      pendingRetryPlaintexts.current.length === 0
    ) {
      return;
    }
    // As soon as chat/device context is ready, kick the retry loop instead of
    // waiting for the next scheduled poll.
    schedulePendingRetry(1_000);
  }, [room?.id, schedulePendingRetry, selfDeviceId, selfId]);

  useEffect(() => {
    if (retrySignal <= 0) return;
    if (pendingRetryPlaintexts.current.length === 0) return;
    schedulePendingRetry(300);
  }, [retrySignal, schedulePendingRetry]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const pickAndAttachImage = useCallback(async () => {
    if (!room?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: "Photo library permission is required.",
      });
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (pick.canceled || !pick.assets[0]) return;
    const a = pick.assets[0];
    try {
      const ids = await uploadFilesWithProgress(
        [
          {
            uri: a.uri,
            name: a.fileName ?? "photo.jpg",
            type: a.mimeType ?? "image/jpeg",
          },
        ],
        () => {},
      );
      const id = ids[0];
      if (id) {
        setDraft(api_routes.files.get(id));
      }
    } catch (e) {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }, [room?.id, showSnack, t]);

  if (loading || !selfId) {
    return (
      <View
        style={[
          tailwindClasses("flex-1 items-center justify-center"),
          { backgroundColor: screenBg },
        ]}
      >
        <ActivityIndicator color={loaderColor} />
      </View>
    );
  }

  if (!room?.id) {
    return (
      <View
        style={[
          tailwindClasses("flex-1 items-center justify-center p-4"),
          { backgroundColor: screenBg },
        ]}
      >
        <Text style={{ color: titleColor }}>{t("messages.no_results")}</Text>
      </View>
    );
  }

  if (!selfDeviceId) {
    return (
      <View
        style={[
          tailwindClasses("flex-1 px-4 py-6"),
          { backgroundColor: screenBg },
        ]}
      >
        <EncryptionSetupPanel
          busy={registering}
          onRegister={() => void onRegister()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[tailwindClasses("flex-1"), { backgroundColor: screenBg }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
    >
      <View
        style={[
          tailwindClasses("px-3"),
          { paddingTop: insets.top + 6, paddingBottom: 12 },
        ]}
      >
        <View style={tailwindClasses("flex-row items-center")}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            style={[
              tailwindClasses(
                "h-12 w-12 items-center justify-center rounded-lg",
              ),
              { backgroundColor: headerButtonBg },
            ]}
          >
            <Ionicons name="arrow-back" size={21} color={headerIconColor} />
          </Pressable>
          <Text
            style={{
              marginLeft: 16,
              fontSize: 24,
              fontWeight: 600,
              color: titleColor,
            }}
          >
            {peerTitle}
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={tailwindClasses("flex-1 px-3")}
        contentContainerStyle={{ paddingBottom: 14, paddingTop: 8 }}
        data={messages}
        keyExtractor={(m, i) => m.id ?? `m-${i}`}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          listRef.current?.scrollToEnd({ animated: false });
        }}
        renderItem={({ item }) => (
          <ChatLine
            item={item}
            selfDeviceId={selfDeviceId}
            selfUserId={selfId}
            room={room}
            accessToken={accessToken}
            outboundPlaintext={outboundPlaintext}
            inboundPlaintext={inboundPlaintext}
          />
        )}
      />

      <View
        style={tailwindClasses("px-3 pb-0.5")}
        accessibilityLabel="chat-composer"
      >
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 2),
          }}
        >
          <View
            style={[
              tailwindClasses(
                "flex-row items-center rounded-lg border px-3 py-2",
              ),
              { borderColor: composerBorder, backgroundColor: composerBg },
            ]}
          >
            <TextInput
              placeholder={t("chat.new")}
              placeholderTextColor={composerPlaceholder}
              value={draft}
              onChangeText={setDraft}
              multiline
              style={[
                tailwindClasses(
                  "max-h-28 flex-1 px-1 py-2 rounded-lg text-base",
                ),
                { color: composerInputColor, textAlignVertical: "center" },
              ]}
            />
            <Pressable
              onPress={() => void pickAndAttachImage()}
              style={tailwindClasses("px-1.5 py-1")}
              accessibilityLabel="Attach image"
            >
              <Ionicons
                name="image-outline"
                size={21}
                color={composerActionIcon}
              />
            </Pressable>
            <Pressable
              onPress={() => void send()}
              disabled={sending || !draft.trim()}
              style={tailwindClasses("pl-2 pr-0.5 py-1")}
              accessibilityLabel="Send message"
            >
              {sending ? (
                <ActivityIndicator size="small" color={composerInputColor} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={draft.trim() ? composerInputColor : sendIconDisabled}
                />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
