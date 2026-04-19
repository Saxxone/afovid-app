import { useI18n } from "@/app_directories/context/I18nProvider";
import { Stack } from "expo-router";

export default function MessagesLayout() {
  const { t } = useI18n();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: t("messages.page_title") }}
      />
      <Stack.Screen name="new" options={{ title: t("chat.direct_message") }} />
      <Stack.Screen name="room" options={{ title: t("chat.page_title") }} />
    </Stack>
  );
}
