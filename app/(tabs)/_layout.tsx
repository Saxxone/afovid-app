import { useMessageUnread } from "@/app_directories/context/MessageUnreadContext";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import { registerPushAfterAuth } from "@/app_directories/services/pushRegistration";
import { headerDark, headerLight } from "@/app_directories/styles/main";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { View } from "react-native";

function MessagesTabBarIcon({ color }: { color: string }) {
  const { hasUnreadMessages } = useMessageUnread();
  return (
    <View style={{ position: "relative", paddingVertical: 2 }}>
      <Ionicons name="chatbubble-outline" size={24} color={color} />
      {hasUnreadMessages ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#7c3aed",
            borderWidth: 2,
            borderColor: "white",
          }}
        />
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { access_token } = await getTokens();
      if (!access_token || cancelled) return;
      await registerPushAfterAuth();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabBarIcon = useMemo(() => {
    return (
        icon:
          | "home-outline"
          | "search-outline"
          | "time-outline"
          | "notifications-outline"
          | "chatbubble-outline"
          | "person-outline",
      ) =>
      ({ color }: { color: string }) => (
        <Ionicons
          name={icon}
          size={24}
          style={{ paddingVertical: 2 }}
          color={color}
        />
      );
  }, []);

  const color_scheme = useColorScheme();
  const header = color_scheme === "dark" ? headerDark : headerLight;

  return (
    <Tabs screenOptions={header}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: "",
          tabBarIcon: tabBarIcon("home-outline"),
        }}
      />
      <Tabs.Screen
        name="(explore)"
        options={{
          title: "",
          tabBarIcon: tabBarIcon("search-outline"),
        }}
      />
      <Tabs.Screen
        name="(history)"
        options={{
          title: "",
          tabBarIcon: tabBarIcon("time-outline"),
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: "",
          tabBarIcon: tabBarIcon("notifications-outline"),
        }}
      />
      <Tabs.Screen
        name="(messages)"
        options={{
          title: "",
          tabBarIcon: (props) => <MessagesTabBarIcon color={props.color} />,
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: "",
          tabBarIcon: tabBarIcon("person-outline"),
        }}
      />
    </Tabs>
  );
}
