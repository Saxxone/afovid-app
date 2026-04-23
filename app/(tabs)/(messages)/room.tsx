import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import FormInput from "@/app_directories/components/form/FormInput";
import EncryptionSetupPanel from "@/app_directories/components/messages/EncryptionSetupPanel";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
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
import { uploadFilesWithProgress } from "@/app_directories/services/uploadWithProgress";
import { resolvePlaybackUrl } from "@/app_directories/utils/playbackUrl";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type {
  Chat,
  ChatEnvelope,
  ClaimedPrekey,
  Room,
} from "@/app_directories/types/chat";
import type { User } from "@/app_directories/types/user";
import { FetchMethod, type Snack } from "@/app_directories/types/types";
import { getUserIdFromAccessToken } from "@/app_directories/utils/jwtPayload";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";
import {
  getChatInboxSocket,
  refreshChatSocketAuth,
} from "@/app_directories/services/chatInboxSocket";
import { useMessageUnread } from "@/app_directories/context/MessageUnreadContext";
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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

/** Look up a sender's device identity key from the cached room participants. */
function findSenderIdentityKey(
  room: Room | null,
  senderUserId: string,
  senderDeviceId: string,
): string | null {
  if (!room?.participants) return null;
  for (const p of room.participants) {
    if (p.id !== senderUserId) continue;
    const device = p.devices?.find((d) => d.id === senderDeviceId);
    if (device) return device.identityKeyCurve25519;
  }
  return null;
}

function ChatLine({
  item,
  selfDeviceId,
  selfUserId,
  room,
  accessToken,
  outboundPlaintext,
}: {
  item: Chat;
  selfDeviceId: string;
  selfUserId: string;
  room: Room | null;
  accessToken: string;
  outboundPlaintext: Map<string, string>;
}) {
  const [lineText, setLineText] = useState("…");
  const mine = item.senderUserId === selfUserId;

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
        setLineText("—");
        return;
      }
      const env = item.envelopes?.find(
        (e) => e.recipientDeviceId === selfDeviceId,
      );
      if (!env) {
        setLineText("—");
        return;
      }
      const senderIdentity = findSenderIdentityKey(
        room,
        item.senderUserId,
        item.senderDeviceId,
      );
      if (!senderIdentity) {
        setLineText("—");
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
      } catch {
        if (!cancelled) setLineText("—");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item, mine, outboundPlaintext, room, selfDeviceId]);

  const plain = lineText !== "…" && lineText !== "—" ? lineText.trim() : "";
  const showRichMedia = !!plain && isLikelyMediaUrl(plain) && !!accessToken;
  const mediaUri = showRichMedia
    ? resolvePlaybackUrl(plain, accessToken, { requiresAuth: true })
    : "";
  const isVideo =
    /\.(mp4|webm)(\?|$)/i.test(plain) || plain.toLowerCase().includes("video");

  return (
    <View
      style={tailwindClasses(
        `mb-2 max-w-[85%] rounded-lg px-3 py-2 ${mine ? "self-end bg-indigo-600" : "self-start bg-gray-200 dark:bg-gray-600"}`,
      )}
    >
      {mediaUri && !isVideo ? (
        <Image
          source={{ uri: mediaUri }}
          style={{ width: 220, height: 220, borderRadius: 8 }}
          contentFit="cover"
        />
      ) : null}
      {mediaUri && isVideo ? (
        <Text
          style={tailwindClasses(
            mine
              ? "text-white text-sm"
              : "text-gray-900 dark:text-white text-sm",
          )}
        >
          Video attachment: {plain}
        </Text>
      ) : null}
      {!mediaUri ? (
        <Text
          style={tailwindClasses(
            mine ? "text-white" : "text-gray-900 dark:text-white",
          )}
        >
          {lineText}
        </Text>
      ) : null}
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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { snackBar, setSnackBar } = useSnackBar();

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

  /** Plaintext cache for outbound messages keyed by `chatId`. */
  const outboundPlaintext = useRef<Map<string, string>>(new Map()).current;

  const { setActiveChatRoom } = useMessageUnread();
  const listRef = useRef<FlatList<Chat>>(null);

  const receiver = useMemo(() => {
    if (!room?.participants || !selfId) return null;
    return room.participants.find((p) => p.id !== selfId) ?? null;
  }, [room, selfId]);

  const peerTitle = receiver?.name ?? room?.name ?? t("chat.page_title");

  useLayoutEffect(() => {
    navigation.setOptions({ title: peerTitle });
  }, [navigation, peerTitle]);

  const fetchRoom = useCallback(
    async (uid: string) => {
      if (rid) {
        const res = await ApiConnectService<Room>({
          url: api_routes.room.room(rid),
          method: FetchMethod.GET,
        });
        if (res.data) setRoom(res.data);
      } else if (uidPeer) {
        const res = await ApiConnectService<Room>({
          url: api_routes.room.findRoomByParticipantsOrCreate(uidPeer, uid),
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
    setSelfDeviceId(await getStoredDeviceId());

    try {
      await fetchRoom(uid);
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

    const onConnect = () => {
      s.emit("join-room", { roomId: activeRoomId, userId: selfId });
    };

    s.on("receive-message", onReceive);
    s.on("exception", onException);
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
      s.off("connect", onConnect);
    };
  }, [room?.id, selfDeviceId, selfId, showSnack, t]);

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

      const claims: Record<string, ClaimedPrekey[]> = {};
      await Promise.all(
        recipients.map(async (uid) => {
          claims[uid] = await claimPrekeys(uid);
        }),
      );

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

  const send = useCallback(async () => {
    if (sending || !draft.trim() || !room?.id || !selfId || !selfDeviceId)
      return;
    setSending(true);
    const plaintext = draft;
    try {
      const envelopes = await buildEnvelopes(plaintext);
      if (envelopes.length === 0) {
        showSnack({
          type: "error",
          title: t("common.error"),
          message: t("security.no_peer_devices"),
        });
        return;
      }
      const payload = {
        roomId: room.id,
        senderDeviceId: selfDeviceId,
        envelopes,
      };
      setDraft("");
      getChatInboxSocket().emit(
        "send-message",
        payload,
        (ack: Chat | undefined) => {
          if (!ack?.id) return;
          outboundPlaintext.set(ack.id, plaintext);
          setMessages((prev) => {
            if (prev.some((m) => m.id === ack.id)) return prev;
            return sortChatsAsc([...prev, ack]);
          });
        },
      );
      void replenishOtksIfNeeded();
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
    outboundPlaintext,
    room?.id,
    selfDeviceId,
    selfId,
    sending,
    showSnack,
    t,
  ]);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      <View style={tailwindClasses("flex-1 items-center justify-center")}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!room?.id) {
    return (
      <View style={tailwindClasses("flex-1 items-center justify-center p-4")}>
        <Text>{t("messages.no_results")}</Text>
      </View>
    );
  }

  if (!selfDeviceId) {
    return (
      <View style={tailwindClasses("flex-1 px-4 py-6")}>
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
      style={tailwindClasses("flex-1")}
      keyboardVerticalOffset={80}
    >
      <FlatList
        ref={listRef}
        style={tailwindClasses("flex-1 px-4")}
        contentContainerStyle={{ paddingBottom: 12 }}
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
          />
        )}
      />

      <View
        style={tailwindClasses(
          "border-t border-gray-200 p-2 dark:border-gray-600",
        )}
        accessibilityLabel="chat-composer"
      >
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 8) + tabBarHeight,
          }}
        >
          <View style={tailwindClasses("flex-row items-end gap-2")}>
            <Pressable
              onPress={() => void pickAndAttachImage()}
              style={tailwindClasses("p-2")}
              accessibilityLabel="Attach image"
            >
              <Ionicons name="image-outline" size={26} color="#6366f1" />
            </Pressable>
            <View style={tailwindClasses("flex-1")}>
              <FormInput
                placeholder={t("chat.new")}
                value={draft}
                onChangeText={setDraft}
                multiline
              />
            </View>
          </View>
          <AppButton onPress={() => void send()}>
            {sending ? <ActivityIndicator color="#fff" /> : t("posts.publish")}
          </AppButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
