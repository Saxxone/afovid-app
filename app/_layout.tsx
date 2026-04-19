import { install } from "react-native-quick-crypto";
install();

import SnackBar from "@/app_directories/components/app/SnackBar";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { DarkTheme, LightTheme } from "@/app_directories/constants/Theme";
import { SessionProvider } from "@/app_directories/context/AppContext";
import { I18nProvider } from "@/app_directories/context/I18nProvider";
import {
  SnackBarProvider,
  useSnackBar,
} from "@/app_directories/context/SnackBarProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { headerDark, headerLight } from "@/app_directories/styles/main";
import { ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient();

function NotificationOpenPostBridge() {
  const router = useRouter();

  useEffect(() => {
    const navigateFromData = (data: Record<string, unknown> | undefined) => {
      const postId = typeof data?.postId === "string" ? data.postId : "";
      if (postId) router.push(app_routes.post.view(postId));
    };

    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      navigateFromData(
        res.notification.request.content.data as
          | Record<string, unknown>
          | undefined,
      );
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const color_scheme = useColorScheme();
  const [loaded] = useFonts({
    "Outfit Black": require("@/app_directories/assets/fonts/outfit/Outfit-Black.ttf"),
    "Outfit ExtraBold": require("@/app_directories/assets/fonts/outfit/Outfit-ExtraBold.ttf"),
    "Outfit Bold": require("@/app_directories/assets/fonts/outfit/Outfit-Bold.ttf"),
    "Outfit SemiBold": require("@/app_directories/assets/fonts/outfit/Outfit-SemiBold.ttf"),
    "Outfit Medium": require("@/app_directories/assets/fonts/outfit/Outfit-Medium.ttf"),
    "Outfit Regular": require("@/app_directories/assets/fonts/outfit/Outfit-Regular.ttf"),
    "Outfit Light": require("@/app_directories/assets/fonts/outfit/Outfit-Light.ttf"),
    "Outfit ExtraLight": require("@/app_directories/assets/fonts/outfit/Outfit-ExtraLight.ttf"),
    "Outfit Thin": require("@/app_directories/assets/fonts/outfit/Outfit-Thin.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SessionProvider>
      <I18nProvider>
        <ThemeProvider value={color_scheme === "dark" ? DarkTheme : LightTheme}>
          <QueryClientProvider client={queryClient}>
            <SnackBarProvider>
              <LayoutContents />
            </SnackBarProvider>
          </QueryClientProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </I18nProvider>
    </SessionProvider>
  );
}

function LayoutContents() {
  const color_scheme = useColorScheme();
  const header = color_scheme === "dark" ? headerDark : headerLight;
  const { snackBar, setSnackBar } = useSnackBar();
  const [showSnackBar, setShowSnackBar] = useState(false);

  const closeSnack = useCallback(() => {
    setSnackBar({
      ...snackBar,
      visible: false,
    });
  }, [snackBar, setSnackBar]);

  useEffect(() => {
    if (snackBar.visible !== showSnackBar) {
      setShowSnackBar(snackBar.visible);
    }
  }, [snackBar.visible, showSnackBar]);

  return (
    <>
      <NotificationOpenPostBridge />
      <SafeAreaView
        style={[
          tailwindClasses("flex-1"),
          color_scheme === "dark"
            ? tailwindClasses("bg-gray-800")
            : tailwindClasses("bg-gray-200"),
        ]}
      >
        <Stack
          screenOptions={{
            ...header,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="compose"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(profile)"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </SafeAreaView>
      {showSnackBar && <SnackBar snack={snackBar} onClose={closeSnack} />}
    </>
  );
}
