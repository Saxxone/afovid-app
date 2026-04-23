import {
  search_shell_screen_bg,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { headerDark, headerLight } from "@/app_directories/styles/main";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function ExploreLayout() {
  const { t } = useI18n();
  const color_scheme = useColorScheme();
  const base = color_scheme === "dark" ? headerDark : headerLight;

  const screenOptions = {
    ...base,
    headerShown: true,
    /** Native stack content must flex or nested flex:1 children get 0 height (blank screen). */
    contentStyle: {
      flex: 1,
      backgroundColor: search_shell_screen_bg,
    },
    headerStyle: {
      ...base.headerStyle,
      backgroundColor: search_shell_screen_bg,
    },
    headerTintColor: white,
    headerTitleStyle: {
      color: white,
      fontFamily: "Outfit SemiBold",
      fontWeight: "600" as const,
    },
    headerShadowVisible: false,
  };

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: t("explore.page_title"),
        }}
      />
    </Stack>
  );
}
