import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import {
  gray_100,
  gray_200,
  gray_400,
  gray_500,
  gray_600,
  gray_700,
  gray_800,
  gray_900,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { FetchMethod } from "@/app_directories/types/types";
import type { User } from "@/app_directories/types/user";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEBOUNCE_MS = 800;

export default function NewDirectMessage() {
  const { t } = useI18n();
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const screenBg = isDark ? gray_800 : gray_200;
  const backBtnBg = isDark ? gray_900 : white;
  const titleColor = isDark ? white : gray_900;
  const searchWellBg = isDark ? gray_900 : white;
  const searchWellBorder = isDark ? "transparent" : gray_200;
  const inputTextColor = isDark ? gray_100 : gray_900;
  const placeholderColor = isDark ? gray_500 : gray_400;
  const searchIconColor = isDark ? gray_500 : gray_400;
  const cardBg = isDark ? gray_900 : white;
  const cardBorder = isDark ? gray_700 : gray_200;
  const nameColor = isDark ? white : gray_900;
  const subColor = isDark ? gray_400 : gray_600;
  const emptyColor = isDark ? gray_500 : gray_600;
  const activityColor = isDark ? white : gray_800;

  const searchPlaceholder = useMemo(() => t("explore.placeholder"), [t]);

  const { fromKeySetup } = useLocalSearchParams<{
    fromKeySetup?: string;
  }>();
  const fromPostKeygenSetup = fromKeySetup === "1";

  const goBackFromNew = useCallback(() => {
    if (fromPostKeygenSetup) {
      const href: Href = app_routes.messages.root;
      router.replace(href);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const href: Href = app_routes.messages.root;
    router.replace(href);
  }, [fromPostKeygenSetup, navigation, router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBackFromNew();
        return true;
      });
      return () => sub.remove();
    }, [goBackFromNew]),
  );

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    if (!debounced.length) {
      setUsers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const base = api_routes.users.search(debounced.toLowerCase());
      const url = `${base}&skip=0&take=20`;
      const res = await ApiConnectService<User[]>({
        url,
        method: FetchMethod.POST,
      });
      if (!cancelled) {
        setUsers(res.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: screenBg }}
      edges={["top", "left", "right"]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={goBackFromNew}
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            backgroundColor: backBtnBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDark ? white : gray_800}
          />
        </Pressable>
        <Text
          className="ml-3 text-xl font-bold flex-1"
          style={{ color: titleColor }}
        >
          {t("chat.direct_message")}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 48,
            backgroundColor: searchWellBg,
            borderWidth: isDark ? 0 : 1,
            borderColor: searchWellBorder,
          }}
        >
          <Ionicons
            name="search"
            size={20}
            color={searchIconColor}
            style={{ marginRight: 8 }}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={placeholderColor}
            style={[
              tailwindClasses("font-normal"),
              {
                flex: 1,
                fontSize: 16,
                paddingVertical: 0,
                color: inputTextColor,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {loading ? (
        <View style={tailwindClasses("flex-1 items-center justify-center")}>
          <ActivityIndicator size="small" color={activityColor} />
        </View>
      ) : (
        <FlatList
          style={tailwindClasses("flex-1")}
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            debounced ? (
              <Text className="mt-4 text-center" style={{ color: emptyColor }}>
                {t("explore.no_results")}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(app_routes.messages.room({ u: item.id }))
              }
              style={{
                marginBottom: 8,
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: cardBorder,
              }}
            >
              <View style={tailwindClasses("flex-1")}>
                <Text
                  className="font-medium text-base"
                  style={{ color: nameColor }}
                >
                  {item.name}
                </Text>
                <Text style={{ color: subColor, fontSize: 14, marginTop: 2 }}>
                  @{item.username}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
