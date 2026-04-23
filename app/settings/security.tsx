import Text from "@/app_directories/components/app/Text";
import {
  gray_100,
  gray_200,
  gray_500,
  gray_600,
  gray_700,
  gray_800,
  gray_900,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import {
  getStoredDeviceId,
  listMyDevices,
  revokeDeviceOnServer,
  wipeLocalCrypto,
} from "@/app_directories/crypto/olm/deviceApi";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { DeviceBundle } from "@/app_directories/types/chat";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  useColorScheme,
  View,
} from "react-native";

function formatFingerprint(key: string): string {
  return key.match(/.{1,4}/g)?.join(" ") ?? key;
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function SecuritySettingsScreen() {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [devices, setDevices] = useState<DeviceBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  const palette = isDark
    ? {
        screen: "#0b1220",
        card: gray_800,
        border: gray_700,
        title: white,
        text: gray_200,
        muted: gray_500,
        code: gray_900,
        badgeBg: "rgba(16, 185, 129, 0.18)",
        badgeText: "#6ee7b7",
      }
    : {
        screen: gray_100,
        card: white,
        border: gray_200,
        title: gray_900,
        text: gray_700,
        muted: gray_600,
        code: gray_100,
        badgeBg: "#d1fae5",
        badgeText: "#065f46",
      };

  const load = useCallback(async () => {
    setLoading((prev) => (devices.length === 0 ? true : prev));
    try {
      const [list, id] = await Promise.all([
        listMyDevices(),
        getStoredDeviceId(),
      ]);
      setDevices(list);
      setCurrentDeviceId(id);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [devices.length]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const onRevoke = useCallback(
    async (device: DeviceBundle) => {
      if (device.revokedAt) return;
      setBusyId(device.id);
      try {
        await revokeDeviceOnServer(device.id);
        if (device.id === currentDeviceId) {
          await wipeLocalCrypto();
          setCurrentDeviceId(null);
        }
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [currentDeviceId, load],
  );

  if (loading) {
    return (
      <View
        style={[
          tailwindClasses("flex-1 items-center justify-center"),
          { backgroundColor: palette.screen },
        ]}
      >
        <ActivityIndicator color={palette.muted} />
      </View>
    );
  }

  return (
    <View
      style={[tailwindClasses("flex-1"), { backgroundColor: palette.screen }]}
    >
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={tailwindClasses("p-4")}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={tailwindClasses("mb-4")}>
            <Text
              className="text-xl font-bold"
              style={{ color: palette.title, marginBottom: 6 }}
            >
              {t("security.devices_title")}
            </Text>
            <Text className="text-sm" style={{ color: palette.muted }}>
              {t("security.devices_hint")}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const isCurrent = item.id === currentDeviceId;
          const isRevoked = !!item.revokedAt;
          return (
            <View
              style={{
                backgroundColor: palette.card,
                borderColor: palette.border,
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <View
                style={tailwindClasses(
                  "flex-row items-center justify-between mb-2",
                )}
              >
                <View style={tailwindClasses("flex-row items-center flex-1")}>
                  <Text
                    className="text-base font-semibold"
                    style={{ color: palette.title, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {isCurrent && (
                    <View
                      style={{
                        backgroundColor: palette.badgeBg,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginLeft: 8,
                      }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: palette.badgeText }}
                      >
                        {t("security.this_device")}
                      </Text>
                    </View>
                  )}
                  {isRevoked && (
                    <View
                      style={{
                        backgroundColor: palette.border,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginLeft: 8,
                      }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: palette.muted }}
                      >
                        {t("security.revoked")}
                      </Text>
                    </View>
                  )}
                </View>
                {!isRevoked && (
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => onRevoke(item)}
                    style={{
                      borderWidth: 1,
                      borderColor: "#fecaca",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      opacity: busyId === item.id ? 0.5 : 1,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: "#dc2626" }}
                    >
                      {t("security.revoke_device")}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text
                className="text-xs"
                style={{ color: palette.muted, marginBottom: 8 }}
              >
                {t("security.last_seen")}: {formatDate(item.lastSeenAt)}
              </Text>
              <Text
                className="text-xs"
                style={{ color: palette.muted, marginBottom: 4 }}
              >
                {t("security.fingerprint")}
              </Text>
              <View
                style={{
                  backgroundColor: palette.code,
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Text
                  className="text-xs"
                  style={{
                    color: palette.text,
                    fontFamily: "Courier",
                  }}
                >
                  {formatFingerprint(item.identityKeyEd25519)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
