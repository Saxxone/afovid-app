import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { useSession } from "@/app_directories/context/AppContext";
import { useI18n } from "@/app_directories/context/I18nProvider";
import {
  NOTIFICATIONS_QUERY_KEY,
  useNotificationSse,
} from "@/app_directories/hooks/useNotificationSse";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import {
  mapApiRowToNotification,
  type ApiNotificationRow,
  type Notification,
} from "@/app_directories/types/notification";
import { FetchMethod } from "@/app_directories/types/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigation, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  useColorScheme,
  View,
} from "react-native";
const PAGE_SIZE = 25;

type NotificationListPage = {
  data: ApiNotificationRow[] | null;
  error: unknown;
};

export default function NotificationsScreen() {
  const { t } = useI18n();
  const color_scheme = useColorScheme();
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async ({ pageParam = 0 }) => {
      return await ApiConnectService<ApiNotificationRow[]>({
        url: api_routes.notifications.get,
        method: FetchMethod.GET,
        query: {
          skip: pageParam * PAGE_SIZE,
          take: PAGE_SIZE,
        },
      });
    },
    getNextPageParam: (lastPage, pages) => {
      const len = lastPage.data?.length ?? 0;
      return len === PAGE_SIZE ? pages.length : undefined;
    },
    initialPageParam: 0,
    enabled: !!session,
  });

  const rows = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data ?? []).filter(Boolean) ?? [];
    return flat.map(mapApiRowToNotification);
  }, [data?.pages]);

  const hasUnread = useMemo(() => rows.some((n) => n.read !== true), [rows]);

  const markAllMutation = useMutation({
    mutationFn: async () => {
      return await ApiConnectService<{ count: number }>({
        url: api_routes.notifications.readAll,
        method: FetchMethod.PATCH,
      });
    },
    onSuccess: () => {
      queryClient.setQueryData<InfiniteData<NotificationListPage>>(
        NOTIFICATIONS_QUERY_KEY,
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data:
                p.data?.map((r) => ({
                  ...r,
                  read: true,
                })) ?? null,
            })),
          };
        },
      );
    },
  });

  const markAllRead = markAllMutation.mutate;

  useFocusEffect(
    useCallback(() => {
      if (session) {
        markAllRead();
      }
    }, [session, markAllRead]),
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await ApiConnectService<unknown>({
        url: api_routes.notifications.delete(id),
        method: FetchMethod.DELETE,
      });
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<InfiniteData<NotificationListPage>>(
        NOTIFICATIONS_QUERY_KEY,
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data?.filter((r) => r.id !== id) ?? null,
            })),
          };
        },
      );
    },
  });

  const markOneRead = useCallback(
    async (id: string) => {
      await ApiConnectService<unknown>({
        url: api_routes.notifications.update(id),
        method: FetchMethod.PATCH,
        body: { read: true },
      });
      queryClient.setQueryData<InfiniteData<NotificationListPage>>(
        NOTIFICATIONS_QUERY_KEY,
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data:
                p.data?.map((r) => (r.id === id ? { ...r, read: true } : r)) ??
                null,
            })),
          };
        },
      );
    },
    [queryClient],
  );

  const onPressRow = useCallback(
    async (item: Notification) => {
      if (item.read !== true) {
        await markOneRead(item.id);
      }
      if (item.postId) {
        router.push(app_routes.post.view(item.postId));
      }
    },
    [markOneRead, router],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("notifications.page_title"),
      headerRight: () => (
        <Pressable
          onPress={() => {
            if (hasUnread && !markAllMutation.isPending) {
              markAllMutation.mutate();
            }
          }}
          style={tailwindClasses("px-3 py-2")}
          disabled={!hasUnread || markAllMutation.isPending}
        >
          <Text
            className={
              hasUnread ? "text-indigo-500 font-medium" : "text-gray-400"
            }
          >
            {t("notifications.mark_all_read")}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, hasUnread, markAllMutation, t]);

  useNotificationSse(queryClient, !!session);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => {
      const unread = item.read !== true;
      return (
        <View
          style={tailwindClasses(
            "flex-row items-center border-b border-gray-300 dark:border-gray-600 px-3 py-3",
          )}
        >
          <Pressable
            onPress={() => onPressRow(item)}
            style={tailwindClasses("flex-1 flex-row items-start")}
          >
            <View
              style={tailwindClasses(
                `mt-1.5 h-2 w-2 rounded-full mr-2 ${unread ? "bg-indigo-500" : "bg-transparent"}`,
              )}
            />
            <View style={tailwindClasses("flex-1")}>
              <Text
                className={
                  unread ? "font-semibold text-gray-900 dark:text-gray-100" : ""
                }
                numberOfLines={4}
              >
                {item.description}
              </Text>
              {item.postId ? (
                <Text className="text-xs text-indigo-500 mt-1">
                  {t("notifications.open_post")}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => deleteMutation.mutate(item.id)}
            hitSlop={12}
            disabled={deleteMutation.isPending}
            accessibilityLabel="Delete notification"
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={color_scheme === "dark" ? "#9ca3af" : "#6b7280"}
            />
          </Pressable>
        </View>
      );
    },
    [color_scheme, deleteMutation, onPressRow, t],
  );

  const footer = isFetchingNextPage ? (
    <View style={tailwindClasses("py-4")}>
      <ActivityIndicator color={violet_500} />
    </View>
  ) : null;

  return (
    <View style={tailwindClasses("flex-1 bg-gray-200 dark:bg-gray-800")}>
      <FlashList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          isFetching ? null : (
            <View style={tailwindClasses("p-6")}>
              <Text className="text-center text-gray-500">
                {t("notifications.no_results")}
              </Text>
            </View>
          )
        }
        ListFooterComponent={footer}
        refreshControl={
          <RefreshControl
            colors={[violet_500]}
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={refetch}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
      />
    </View>
  );
}
