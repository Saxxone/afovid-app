import { useI18n } from "@/app_directories/context/I18nProvider";
import { Stack } from "expo-router";

export default function PostLayout() {
  const { t } = useI18n();
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
          title: t("posts.post"),
        }}
      />
    </Stack>
  );
}
