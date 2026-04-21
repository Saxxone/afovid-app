import { app_routes } from "@/app_directories/constants/AppRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const FAB_SIZE = 56;
const FAB_BOTTOM = 128;
const FAB_RIGHT = 12;

const fabCircle = {
  width: FAB_SIZE,
  height: FAB_SIZE,
  borderRadius: FAB_SIZE / 2,
  backgroundColor: violet_500,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 6,
};

const HomeComposeSpeedDial = memo(function HomeComposeSpeedDial() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const goPost = useCallback(() => {
    close();
    router.push(app_routes.post.compose.post);
  }, [close, router]);

  const goVideo = useCallback(() => {
    close();
    router.push({
      pathname: app_routes.post.compose.post,
      params: { flow: "video" },
    });
  }, [close, router]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={close}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.2)" },
          ]}
        />
      ) : null}

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: FAB_RIGHT,
          bottom: FAB_BOTTOM,
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        {open ? (
          <View
            accessibilityRole="menu"
            accessibilityLabel={t("compose.speed_dial_actions")}
            style={tailwindClasses("flex flex-col items-end gap-3")}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("compose.create_video_aria")}
              onPress={goVideo}
              style={fabCircle}
            >
              <Ionicons name="videocam" size={26} color="white" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("compose.create_post_aria")}
              onPress={goPost}
              style={fabCircle}
            >
              <Ionicons name="create-outline" size={26} color="white" />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={
            open ? t("compose.close_menu_aria") : t("compose.open_menu_aria")
          }
          onPress={toggle}
          style={fabCircle}
        >
          <Ionicons name={open ? "close" : "add"} size={28} color="white" />
        </Pressable>
      </View>
    </View>
  );
});

export default HomeComposeSpeedDial;
