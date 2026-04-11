import FloatingActionButton from "@/app_directories/components/app/FloatingActionButton";
import Text from "@/app_directories/components/app/Text";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post, postContainsVideo } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";

const POSTS_PER_PAGE = 9;

function postCreatedAtSortKey(post: Post): number {
  if (!post.createdAt) return 0;
  const t = new Date(post.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function HomeScreen() {
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

  const all_posts =
    data?.pages
      .flatMap((page) => page.data ?? [])
      .filter((p): p is Post => p != null) ?? [];

  const feed_posts = useMemo(() => {
    const copy = [...all_posts];
    copy.sort((a, b) => {
      const av = postContainsVideo(a) ? 1 : 0;
      const bv = postContainsVideo(b) ? 1 : 0;
      if (av !== bv) return bv - av;
      const ad = postCreatedAtSortKey(a);
      const bd = postCreatedAtSortKey(b);
      if (ad !== bd) return bd - ad;
      return a.id.localeCompare(b.id);
    });
    return copy;
  }, [all_posts]);

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
          ListEmptyComponent={
            isFetching ? null : (
              <View style={tailwindClasses("p-3 mb-3")}>
                <Text className="text-center text-gray-500">
                  No posts found.
                </Text>
                <Text className="text-center text-gray-500">
                  {feed_posts.length}
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
