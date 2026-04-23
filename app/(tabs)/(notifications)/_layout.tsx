import { gray_200, gray_800 } from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { headerDark, headerLight } from "@/app_directories/styles/main";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function NotificationsLayout() {
  const { t } = useI18n();
  const color_scheme = useColorScheme();
  const isDark = color_scheme === "dark";
  const header = isDark ? headerDark : headerLight;
  const sceneBg = isDark ? gray_800 : gray_200;

  return (
    <Stack
      screenOptions={{
        ...header,
        headerShown: true,
        contentStyle: { backgroundColor: sceneBg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("notifications.page_title"),
        }}
      />
    </Stack>
  );
}
