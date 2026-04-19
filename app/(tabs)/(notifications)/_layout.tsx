import { useI18n } from "@/app_directories/context/I18nProvider";
import { headerDark, headerLight } from "@/app_directories/styles/main";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function NotificationsLayout() {
  const { t } = useI18n();
  const color_scheme = useColorScheme();
  const header = color_scheme === "dark" ? headerDark : headerLight;

  return (
    <Stack
      screenOptions={{
        ...header,
        headerShown: true,
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
