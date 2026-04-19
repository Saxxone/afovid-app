import Text from "@/app_directories/components/app/Text";
import FormInput from "@/app_directories/components/form/FormInput";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { User } from "@/app_directories/types/user";
import { FetchMethod } from "@/app_directories/types/types";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";

const DEBOUNCE_MS = 800;

export default function NewDirectMessage() {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    if (!debounced.length) {
      setUsers([]);
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
    <View style={tailwindClasses("flex-1 px-3 pt-2")}>
      <FormInput
        label={t("explore.placeholder")}
        placeholder={t("explore.placeholder")}
        value={search}
        onChangeText={setSearch}
      />
      {loading ? (
        <ActivityIndicator style={tailwindClasses("mt-4")} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          ListEmptyComponent={
            debounced ? (
              <Text style={tailwindClasses("mt-4 text-center text-gray-500")}>
                {t("explore.no_results")}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(app_routes.messages.room({ u: item.id }))
              }
              style={tailwindClasses(
                "mb-2 flex-row items-center rounded-lg bg-white p-3 dark:bg-gray-700",
              )}
            >
              <View style={tailwindClasses("flex-1")}>
                <Text
                  style={tailwindClasses(
                    "font-medium text-gray-900 dark:text-white",
                  )}
                >
                  {item.name}
                </Text>
                <Text style={tailwindClasses("text-sm text-gray-500")}>
                  @{item.username}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
