import Text from "@/app_directories/components/app/Text";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { useSession } from "@/app_directories/context/AppContext";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
} from "react-native";

const PAGE_SIZE = 10;

type HistoryTab = 0 | 1 | 2;

function listUrl(tab: HistoryTab): string {
  if (tab === 0) return api_routes.posts.myWatchHistory;
  if (tab === 1) return api_routes.posts.myLikedVideos;
  return api_routes.posts.myUnlocked;
}

export default function HistoryScreen() {
  const { t } = useI18n();
  const { session } = useSession();
  const [tab, setTab] = useState<HistoryTab>(0);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["history_lists", tab],
    queryFn: async ({ pageParam = 0 }) => {
      return await ApiConnectService<Post[]>({
        url: listUrl(tab),
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

  const posts = useMemo(
    () =>
      data?.pages.flatMap((p) => p.data ?? []).filter((x): x is Post => !!x) ??
      [],
    [data?.pages],
  );

  const emptyMessage = useMemo(() => {
    if (tab === 0) return t("history.empty_history");
    if (tab === 1) return t("history.empty_liked");
    return t("history.empty_paid");
  }, [tab, t]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={tailwindClasses("py-4")}>
        <ActivityIndicator color={violet_500} />
      </View>
    );
  }, [isFetchingNextPage]);

  if (!session) {
    return (
      <View style={tailwindClasses("flex-1 px-4 py-8")}>
        <Text className="text-center text-gray-500">
          {t("history.login_prompt")}
        </Text>
        <Link href={app_routes.auth.login} asChild>
          <Pressable
            style={tailwindClasses(
              "mt-6 self-center rounded-lg bg-violet-600 px-6 py-3",
            )}
          >
            <Text className="font-medium text-white">{t("login.login")}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={tailwindClasses("flex-1")}>
      <View style={tailwindClasses("flex-row gap-2 px-3 py-2")}>
        {(
          [
            [0, t("history.tab_history")],
            [1, t("history.tab_liked")],
            [2, t("history.tab_paid")],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={tailwindClasses(
              `flex-1 rounded-lg py-2 px-2 ${tab === value ? "bg-violet-600" : "bg-gray-800"}`,
            )}
          >
            <Text
              className={`text-center text-sm font-medium ${tab === value ? "text-white" : "text-gray-300"}`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isFetching && !posts.length ? (
        <View
          style={tailwindClasses("flex-1 items-center justify-center py-12")}
        >
          <ActivityIndicator color={violet_500} size="large" />
        </View>
      ) : !posts.length ? (
        <View style={tailwindClasses("px-4 py-12")}>
          <Text className="text-center text-gray-500">{emptyMessage}</Text>
        </View>
      ) : (
        <FlashList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              colors={[violet_500]}
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={() => void refetch()}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          renderItem={({ item }) => (
            <PostDisplay
              post={item}
              actions
              ellipsis={false}
              isFetching={false}
              emphasizeVideo
            />
          )}
        />
      )}
    </View>
  );
}
