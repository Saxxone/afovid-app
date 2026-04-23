import {
  gray_200,
  gray_800,
  messages_screen_bg,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function MessagesLayout() {
  const { t } = useI18n();
  const color_scheme = useColorScheme();
  const isDark = color_scheme === "dark";
  const headerBg = isDark ? messages_screen_bg : gray_200;
  const headerTint = isDark ? white : gray_800;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerTint,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: "Outfit SemiBold",
          fontWeight: "600",
        },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="new"
        options={{ headerShown: false, title: t("chat.direct_message") }}
      />
      <Stack.Screen
        name="room"
        options={{ title: t("chat.page_title"), headerShown: true }}
      />
    </Stack>
  );
}
