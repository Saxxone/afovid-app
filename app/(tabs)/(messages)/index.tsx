import FloatingActionButton from "@/app_directories/components/app/FloatingActionButton";
import Text from "@/app_directories/components/app/Text";
import EncryptionSetupPanel from "@/app_directories/components/messages/EncryptionSetupPanel";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import {
  gray_200,
  gray_300,
  gray_500,
  gray_600,
  gray_700,
  gray_800,
  gray_900,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { useMessageUnread } from "@/app_directories/context/MessageUnreadContext";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import {
  ensureOlmReady,
  getStoredDeviceId,
  registerDeviceWithServer,
  replenishOtksIfNeeded,
} from "@/app_directories/crypto/olm/deviceApi";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import {
  getChatInboxSocket,
  refreshChatSocketAuth,
} from "@/app_directories/services/chatInboxSocket";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { Chat, Room } from "@/app_directories/types/chat";
import { FetchMethod } from "@/app_directories/types/types";
import { getUserIdFromAccessToken } from "@/app_directories/utils/jwtPayload";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useFocusEffect,
  useRouter,
  type RelativePathString,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AVATAR_SIZE = 40;
const FAB_SIZE = 56;

export default function MessagesIndex() {
  const { t } = useI18n();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const color_scheme = useColorScheme();
  const isDark = color_scheme === "dark";
  const canGoBack = navigation.canGoBack();

  const { clearUnread } = useMessageUnread();
  const { snackBar, setSnackBar } = useSnackBar();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const screenBg = isDark ? gray_800 : gray_200;
  const backBtnBg = isDark ? gray_900 : white;
  const titleColor = isDark ? white : gray_900;
  const nameColor = isDark ? white : gray_900;
  const emptyColor = isDark ? gray_500 : gray_600;
  const avatarPlaceholderBg = isDark ? gray_600 : gray_300;
  const activityColor = isDark ? white : gray_800;
  const roomCardBg = isDark ? gray_900 : white;
  const roomCardBorder = isDark ? gray_700 : gray_300;

  const showSnack = useCallback(
    (message: string) => {
      setSnackBar({
        ...snackBar,
        visible: true,
        type: "error",
        title: t("common.error"),
        message,
      });
    },
    [setSnackBar, snackBar, t],
  );

  const loadRooms = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) setLoading(true);
      const { access_token } = await getTokens();
      if (!access_token) {
        setRooms([]);
        setSelfId(null);
        if (!silent) setLoading(false);
        return;
      }
      const uid = getUserIdFromAccessToken(access_token);
      setSelfId(uid);
      if (!uid) {
        if (!silent) setLoading(false);
        return;
      }

      await ensureOlmReady();
      setDeviceId(await getStoredDeviceId());

      const roomsRes = await ApiConnectService<Room[]>({
        url: `${api_routes.room.rooms}?skip=0&take=50&deviceId=${encodeURIComponent((await getStoredDeviceId()) ?? "")}`,
        method: FetchMethod.GET,
      });

      if (roomsRes.error) {
        if (!silent) {
          setSnackBar({
            ...snackBar,
            visible: true,
            type: "error",
            title: t("common.error"),
            message:
              (roomsRes.error as { message?: string })?.message ??
              t("messages.no_results"),
          });
          setRooms([]);
        }
      } else {
        setRooms(roomsRes.data ?? []);
      }
      if (!silent) setLoading(false);
    },
    [setSnackBar, snackBar, t],
  );

  const registerDevice = useCallback(async () => {
    if (!selfId) return;
    setRegistering(true);
    try {
      const id = await registerDeviceWithServer();
      setDeviceId(id);
      await refreshChatSocketAuth();
      await loadRooms();
      void replenishOtksIfNeeded();
    } catch (e) {
      showSnack(
        e instanceof Error ? e.message : t("security.device_not_registered"),
      );
    } finally {
      setRegistering(false);
    }
  }, [loadRooms, selfId, showSnack, t]);

  const loadRoomsRef = useRef(loadRooms);
  loadRoomsRef.current = loadRooms;

  useEffect(() => {
    const s = getChatInboxSocket();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onReceive = (_chat: Chat) => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void loadRoomsRef.current({ silent: true });
      }, 400);
    };
    s.on("receive-message", onReceive);
    void (async () => {
      await refreshChatSocketAuth();
      if (!s.connected) s.connect();
    })();
    return () => {
      if (debounce) clearTimeout(debounce);
      s.off("receive-message", onReceive);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearUnread();
      void loadRooms();
    }, [loadRooms, clearUnread]),
  );

  const needsRegister = !loading && !!selfId && !deviceId;

  const fabBottom = useMemo(
    () => Math.max(insets.bottom, 8) + 8,
    [insets.bottom],
  );
  const listPadBottom = useMemo(
    () => (needsRegister ? 24 : fabBottom + FAB_SIZE + 20),
    [needsRegister, fabBottom],
  );

  const otherParticipant = useCallback(
    (room: Room) => {
      if (!selfId) return room.participants?.[0] ?? null;
      return (
        room.participants?.find((p) => p.id !== selfId) ??
        room.participants?.[0] ??
        null
      );
    },
    [selfId],
  );

  const header = (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: screenBg,
      }}
    >
      {canGoBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: backBtnBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDark ? white : gray_800}
          />
        </Pressable>
      ) : (
        <View style={{ width: 40, height: 40 }} />
      )}
      <Text
        className="ml-3 text-xl font-bold flex-1"
        style={{ color: titleColor }}
      >
        {t("messages.page_title")}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg }}>
        {header}
        <View style={tailwindClasses("flex-1 items-center justify-center")}>
          <ActivityIndicator size="large" color={activityColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {header}

      {needsRegister ? (
        <View
          style={[
            tailwindClasses("flex-1 px-4"),
            { paddingTop: 8, paddingBottom: insets.bottom + 8 },
          ]}
        >
          <EncryptionSetupPanel
            busy={registering}
            onRegister={() => void registerDevice()}
          />
        </View>
      ) : (
        <>
          <FlatList
            style={tailwindClasses("flex-1")}
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: listPadBottom,
              flexGrow: 1,
            }}
            ListEmptyComponent={
              <Text
                className="mt-6 text-center text-base-sm font-normal"
                style={{ color: emptyColor }}
              >
                {t("messages.no_results")}
              </Text>
            }
            renderItem={({ item }) => {
              const other = otherParticipant(item);
              const name = item.name ?? other?.name ?? t("messages.page_title");
              const img = other?.img;
              return (
                <Pressable
                  onPress={() =>
                    router.push(app_routes.messages.room({ r: item.id }))
                  }
                  style={{
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: roomCardBg,
                    borderWidth: 1,
                    borderColor: roomCardBorder,
                  }}
                >
                  {img ? (
                    <Image
                      source={{ uri: img as string }}
                      style={{
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                        borderRadius: AVATAR_SIZE / 2,
                        backgroundColor: gray_700,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                        borderRadius: AVATAR_SIZE / 2,
                        backgroundColor: avatarPlaceholderBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="person"
                        size={22}
                        color={isDark ? gray_300 : gray_500}
                      />
                    </View>
                  )}
                  <Text
                    numberOfLines={1}
                    className="ml-3 text-base font-semibold flex-1"
                    style={{ color: nameColor }}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            }}
          />
          <FloatingActionButton
            to={app_routes.messages.new as RelativePathString}
            bottom={fabBottom}
            right={16}
          />
        </>
      )}
    </View>
  );
}
