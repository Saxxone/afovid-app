import { app_routes } from "@/app_directories/constants/AppRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Link, Stack } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ title: t("not_found.title") }} />
      <View style={tailwindClasses("container")}>
        <Link href={app_routes.post.home}>{t("not_found.go_home")}</Link>
      </View>
    </>
  );
}
