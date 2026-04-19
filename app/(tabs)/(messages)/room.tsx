import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import FormInput from "@/app_directories/components/form/FormInput";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import {
  decryptChatBody,
  encryptChatPayloadHybrid,
  generateRsaKeyPair,
} from "@/app_directories/crypto/chatE2ee";
import {
  getStoredPrivateJwk,
  setStoredPrivateJwk,
} from "@/app_directories/crypto/securePrivateKey";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { Chat, Room } from "@/app_directories/types/chat";
import type { User } from "@/app_directories/types/user";
import { FetchMethod, type Snack } from "@/app_directories/types/types";
import { getUserIdFromAccessToken } from "@/app_directories/utils/jwtPayload";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { io, type Socket } from "socket.io-client";
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
  View,
} from "react-native";

const RSA_ALG = "RSA-OAEP";
const RSA_HASH = "SHA-256";

function sortChatsAsc(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
}

function parsePublicKeyString(raw: User["publicKey"]): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  }
  return JSON.stringify(raw);
}

function ChatLine({
  item,
  selfId,
  privateJwk,
}: {
  item: Chat;
  selfId: string;
  privateJwk: JsonWebKey | null;
}) {
  const [lineText, setLineText] = useState("…");
  const from =
    typeof item.fromUserId === "string"
      ? item.fromUserId
      : (item.fromUserId as User | undefined)?.id;
  const mine = from === selfId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!privateJwk) {
        setLineText("—");
        return;
      }
      const row = item.userEncryptedMessages?.find((m) => m.userId === selfId);
      if (!row?.encryptedMessage) {
        setLineText("—");
        return;
      }
      const plain = await decryptChatBody({
        encryptedPayload: item.encryptedPayload,
        userCiphertextBase64: row.encryptedMessage,
        algorithm: RSA_ALG,
        hash: RSA_HASH,
        private_key: privateJwk,
      });
      if (!cancelled) setLineText(plain ?? "—");
    })();
    return () => {
      cancelled = true;
    };
  }, [item, privateJwk, selfId]);

  return (
    <View
      style={tailwindClasses(
        `mb-2 max-w-[85%] rounded-lg px-3 py-2 ${mine ? "self-end bg-indigo-600" : "self-start bg-gray-200 dark:bg-gray-600"}`,
      )}
    >
      <Text
        style={tailwindClasses(
          mine ? "text-white" : "text-gray-900 dark:text-white",
        )}
      >
        {lineText}
      </Text>
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
  const { snackBar, setSnackBar } = useSnackBar();

  const showSnack = useCallback(
    (patch: Partial<Snack>) => {
      setSnackBar({ ...snackBar, ...patch, visible: true });
    },
    [setSnackBar, snackBar],
  );

  const [selfId, setSelfId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [privateJwk, setPrivateJwk] = useState<JsonWebKey | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const receiver = useMemo(() => {
    if (!room?.participants || !selfId) return null;
    return room.participants.find((p) => p.id !== selfId) ?? null;
  }, [room, selfId]);

  const peerTitle = receiver?.name ?? room?.name ?? t("chat.page_title");

  useLayoutEffect(() => {
    navigation.setOptions({ title: peerTitle });
  }, [navigation, peerTitle]);

  const loadPrivate = useCallback(async () => {
    setPrivateJwk(await getStoredPrivateJwk());
  }, []);

  const refreshMe = useCallback(async (userId: string) => {
    const res = await ApiConnectService<User>({
      url: api_routes.users.get(userId),
      method: FetchMethod.GET,
    });
    if (res.data) setMe(res.data);
  }, []);

  const refetchRoom = useCallback(async () => {
    if (!selfId) return;
    if (rid) {
      const res = await ApiConnectService<Room>({
        url: api_routes.room.room(rid),
        method: FetchMethod.GET,
      });
      if (res.data) setRoom(res.data);
    } else if (uidPeer) {
      const res = await ApiConnectService<Room>({
        url: api_routes.room.findRoomByParticipantsOrCreate(uidPeer, selfId),
        method: FetchMethod.POST,
      });
      if (res.data) setRoom(res.data);
    }
  }, [rid, selfId, uidPeer]);

  const initRoom = useCallback(async () => {
    setLoading(true);
    const { access_token } = await getTokens();
    if (!access_token) {
      setLoading(false);
      return;
    }
    const uid = getUserIdFromAccessToken(access_token);
    setSelfId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }

    await loadPrivate();
    await refreshMe(uid);

    try {
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
    } catch {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: t("messages.no_results"),
      });
    }
    setLoading(false);
  }, [loadPrivate, refreshMe, rid, showSnack, t, uidPeer]);

  useEffect(() => {
    void initRoom();
  }, [initRoom]);

  const loadMessages = useCallback(async () => {
    if (!room?.id) return;
    const url = `${api_routes.room.chats(room.id)}?skip=0&take=100`;
    const res = await ApiConnectService<Chat[]>({
      url,
      method: FetchMethod.GET,
    });
    if (res.data) setMessages(sortChatsAsc(res.data));
  }, [room?.id]);

  useEffect(() => {
    if (room?.id) void loadMessages();
  }, [loadMessages, room?.id]);

  const canEncrypt =
    !!me &&
    !!parsePublicKeyString(me.publicKey) &&
    !!receiver &&
    !!parsePublicKeyString(receiver.publicKey) &&
    !!privateJwk;

  const needsKeys = !me || !parsePublicKeyString(me.publicKey) || !privateJwk;

  const createOrRotateKeys = useCallback(async () => {
    if (!selfId) return;
    setKeyBusy(true);
    try {
      const { public_key, private_key } = await generateRsaKeyPair(
        RSA_ALG,
        RSA_HASH,
      );
      await setStoredPrivateJwk(private_key);
      setPrivateJwk(private_key);
      const res = await ApiConnectService<User>({
        url: api_routes.users.update(selfId),
        method: FetchMethod.PUT,
        body: { publicKey: JSON.stringify(public_key) },
      });
      if (res.error) {
        showSnack({
          type: "error",
          title: t("common.error"),
          message: (res.error as { message?: string })?.message ?? "—",
        });
      } else {
        await refreshMe(selfId);
        await loadPrivate();
        await refetchRoom();
      }
    } finally {
      setKeyBusy(false);
    }
  }, [loadPrivate, refetchRoom, refreshMe, selfId, showSnack, t]);

  useEffect(() => {
    if (!room?.id || !selfId) return;
    const s = io(api_routes.chats.base, {
      transports: ["websocket"],
      autoConnect: true,
    });
    socketRef.current = s;
    s.emit("join-room", { roomId: room.id, userId: selfId });
    s.on("receive-message", (chat: Chat) => {
      setMessages((prev) => sortChatsAsc([...prev, chat]));
    });
    s.on("exception", (err: { message?: string }) => {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: err?.message ?? t("chat.send_failed"),
      });
    });
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [room?.id, selfId, showSnack, t]);

  const send = useCallback(async () => {
    if (!draft.trim() || !room?.id || !selfId || !me || !receiver) return;
    const myPk = parsePublicKeyString(me.publicKey);
    const theirPk = parsePublicKeyString(receiver.publicKey);
    if (!myPk || !theirPk || !privateJwk) {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: t("chat.missing_peer_key"),
      });
      return;
    }

    const hybrid = await encryptChatPayloadHybrid({
      sender_public_key: myPk,
      receiver_public_key: theirPk,
      message: draft,
      algorithm: RSA_ALG,
      hash: RSA_HASH,
    });
    if (!hybrid) {
      showSnack({
        type: "error",
        title: t("common.error"),
        message: t("chat.encryption_failed"),
      });
      return;
    }

    const payload = {
      fromUserId: selfId,
      toUserId: receiver.id,
      roomId: room.id,
      senderEncryptedMessage: hybrid.senderEncryptedMessage,
      receiverEncryptedMessage: hybrid.receiverEncryptedMessage,
      encryptedPayload: hybrid.encryptedPayload,
      read: false,
    };

    socketRef.current?.emit("send-message", payload);
    setDraft("");
  }, [draft, me, privateJwk, receiver, room?.id, selfId, showSnack, t]);

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

  const peerMissingKey =
    !!receiver && !parsePublicKeyString(receiver.publicKey);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={tailwindClasses("flex-1")}
      keyboardVerticalOffset={80}
    >
      {needsKeys ? (
        <View style={tailwindClasses("p-4")}>
          <Text
            style={tailwindClasses(
              "mb-3 text-center text-gray-600 dark:text-gray-300",
            )}
          >
            {t("chat.setup_keys_hint")}
          </Text>
          <AppButton
            disabled={keyBusy}
            onPress={() => void createOrRotateKeys()}
          >
            {t("chat.generate_keys")}
          </AppButton>
        </View>
      ) : null}

      {peerMissingKey ? (
        <View style={tailwindClasses("p-4")}>
          <Text style={tailwindClasses("text-center text-amber-600")}>
            {t("chat.missing_peer_key")}
          </Text>
        </View>
      ) : null}

      <FlatList
        style={tailwindClasses("flex-1 px-3")}
        data={messages}
        keyExtractor={(m, i) => m.id ?? `m-${i}`}
        renderItem={({ item }) => (
          <ChatLine item={item} selfId={selfId} privateJwk={privateJwk} />
        )}
      />

      {canEncrypt && !peerMissingKey ? (
        <View
          style={tailwindClasses(
            "border-t border-gray-200 p-2 dark:border-gray-600",
          )}
        >
          <FormInput
            placeholder={t("chat.new")}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <AppButton onPress={() => void send()}>
            {t("posts.publish")}
          </AppButton>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
