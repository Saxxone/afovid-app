import { useI18n } from "@/app_directories/context/I18nProvider";
import { Stack } from "expo-router";

export default function ProfileTabLayout() {
  const { t } = useI18n();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="edit"
        options={{
          headerShown: true,
          title: t("profile.edit"),
        }}
      />
    </Stack>
  );
}
