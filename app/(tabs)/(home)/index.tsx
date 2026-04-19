import FloatingActionButton from "@/app_directories/components/app/FloatingActionButton";
import Text from "@/app_directories/components/app/Text";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post, postContainsVideo } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  View,
  type ViewToken,
} from "react-native";

const POSTS_PER_PAGE = 9;

export default function HomeScreen() {
  const { t } = useI18n();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam = 0 }) => {
      return await ApiConnectService<Post[]>({
        url: api_routes.posts.feed,
        method: FetchMethod.POST,
        query: {
          skip: pageParam * POSTS_PER_PAGE,
          take: POSTS_PER_PAGE,
        },
      });
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.data?.length === POSTS_PER_PAGE
        ? pages.length
        : undefined;
    },
    initialPageParam: 0,
  });

  const feed_posts =
    data?.pages
      .flatMap((page) => page.data ?? [])
      .filter((p): p is Post => p != null) ?? [];

  const [activePostId, setActivePostId] = useState<string | null>(null);

  useEffect(() => {
    if (feed_posts.length === 0) return;
    setActivePostId((prev) => prev ?? feed_posts[0].id);
  }, [feed_posts]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 20,
      /** Low enough to register the top row quickly; FlashList default is 250ms. */
      minimumViewTime: 100,
    }),
    [],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.filter(
        (t) => t.isViewable && t.item != null && t.index != null,
      );
      if (visible.length === 0) return;
      visible.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const top = visible[0];
      const item = top?.item;
      if (item && typeof item === "object" && "id" in item) {
        setActivePostId((item as Post).id);
      }
    },
    [],
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={tailwindClasses("py-4")}>
        <ActivityIndicator color={violet_500} />
      </View>
    );
  };

  return (
    <>
      <View style={tailwindClasses("container flex-1")}>
        <FlashList
          data={feed_posts}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          ListEmptyComponent={
            isFetching ? null : (
              <View style={tailwindClasses("p-3 mb-3")}>
                <Text className="text-center text-gray-500">
                  {t("home.empty_feed")}
                </Text>
              </View>
            )
          }
          keyExtractor={(item) => item?.id ?? ""}
          renderItem={({ item }) => (
            <PostDisplay
              key={item?.id}
              post={item}
              ellipsis={true}
              actions={true}
              isFetching={isFetching && !isFetchingNextPage}
              emphasizeVideo={postContainsVideo(item)}
              isFeedVideoActive={activePostId === item?.id}
            />
          )}
          refreshControl={
            <RefreshControl
              colors={[violet_500]}
              refreshing={isFetching}
              onRefresh={refetch}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      </View>
      <FloatingActionButton
        to={app_routes.post.compose}
        icon="pencil-outline"
      />
    </>
  );
}
