import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { Room } from "@/app_directories/types/chat";
import { FetchMethod } from "@/app_directories/types/types";
import { getUserIdFromAccessToken } from "@/app_directories/utils/jwtPayload";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";

export default function MessagesIndex() {
  const { t } = useI18n();
  const router = useRouter();
  const { snackBar, setSnackBar } = useSnackBar();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    const { access_token } = await getTokens();
    if (!access_token) {
      setRooms([]);
      setSelfId(null);
      setLoading(false);
      return;
    }
    setSelfId(getUserIdFromAccessToken(access_token));
    const url = `${api_routes.room.rooms}?skip=0&take=50`;
    const res = await ApiConnectService<Room[]>({
      url,
      method: FetchMethod.GET,
    });
    if (res.error) {
      setSnackBar({
        ...snackBar,
        visible: true,
        type: "error",
        title: t("common.error"),
        message:
          (res.error as { message?: string })?.message ??
          t("messages.no_results"),
      });
      setRooms([]);
    } else {
      setRooms(res.data ?? []);
    }
    setLoading(false);
  }, [setSnackBar, snackBar, t]);

  useFocusEffect(
    useCallback(() => {
      void loadRooms();
    }, [loadRooms]),
  );

  return (
    <View style={tailwindClasses("flex-1 px-3 pt-2")}>
      <AppButton onPress={() => router.push(app_routes.messages.new)}>
        {t("chat.direct_message")}
      </AppButton>
      {loading ? (
        <ActivityIndicator style={tailwindClasses("mt-6")} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={tailwindClasses("mt-6 text-center text-gray-500")}>
              {t("messages.no_results")}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(app_routes.messages.room({ r: item.id }))
              }
              style={tailwindClasses(
                "mb-3 rounded-lg bg-white p-4 dark:bg-gray-700",
              )}
            >
              <Text
                style={tailwindClasses(
                  "font-semibold text-gray-900 dark:text-white",
                )}
              >
                {item.name ??
                  item.participants?.find((p) => p.id !== selfId)?.name ??
                  t("messages.page_title")}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
