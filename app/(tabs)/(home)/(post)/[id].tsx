import Text from "@/app_directories/components/app/Text";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { Post } from "@/app_directories/types/post";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { FetchMethod } from "@/app_directories/types/types";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

const POSTS_PER_PAGE = 9;

export default function PostScreen() {
  const { id } = useLocalSearchParams();

  const {
    isFetching: is_fetching_post,
    isError: is_post_error,
    error: post_error,
    data: post,
  } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      return await ApiConnectService<Post>({
        url: api_routes.posts.getPostById(id as string),
        method: FetchMethod.GET,
      });
    },
    enabled: true,
    retry: false,
  });

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={tailwindClasses("py-4")}>
        <ActivityIndicator color={violet_500} />
      </View>
    );
  };

  const {
    isFetching: is_fetching_comments,
    isError: is_comments_error,
    data: comments,
    error: comment_error,
    refetch: refetchComments,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["comments"],
    queryFn: async () => {
      return await ApiConnectService<Post[]>({
        url: api_routes.posts.getComments(id as string),
        method: FetchMethod.GET,
        query: {
          skip: 0,
          take: 10,
        },
      });
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.data?.length === POSTS_PER_PAGE
        ? pages.length
        : undefined;
    },
    initialPageParam: 0,
    enabled: true,
    retry: false,
  });

  const {
    isFetching: is_fetching_parent_post,
    isError: is_parent_post_error,
    error: parent_post_error,
    data: parent_post,
  } = useQuery({
    queryKey: ["parent_post", post?.data?.parentId],
    queryFn: async () => {
      return await ApiConnectService<Post>({
        url: api_routes.posts.getPostById(post?.data?.parentId as string),
        method: FetchMethod.GET,
      });
    },
    enabled: !!post?.data?.parentId,
    retry: false,
  });

  const ParentPost = useMemo(() => {
    return parent_post?.data ? (
      <View>
        <PostDisplay
          key={`parent-${parent_post?.data?.id}`}
          ellipsis={false}
          actions={true}
          isFetching={is_fetching_parent_post}
          post={parent_post?.data}
        />
      </View>
    ) : null;
  }, [is_fetching_parent_post, parent_post?.data]);

  const Post = useMemo(() => {
    return post?.data ? (
      <View>
        <PostDisplay
          key={`main-${post?.data?.id}`}
          ellipsis={false}
          actions={true}
          isFetching={is_fetching_post}
          post={post?.data}
          recordWatchForPost
        />
      </View>
    ) : null;
  }, [is_fetching_post, is_post_error, post, post_error]);

  const all_comments = comments?.pages.flatMap((page) => page.data) ?? [];

  const Comments = useMemo(() => {
    return all_comments.length > 0 && post ? (
      <View>
        <FlashList
          data={all_comments}
          ListEmptyComponent={
            is_fetching_comments ? null : (
              <View style={tailwindClasses("p-4 mb-3")}>
                <Text className="text-center text-gray-500">.</Text>
              </View>
            )
          }
          keyExtractor={(item) => item?.id ?? ""}
          renderItem={({ item: post }) => (
            <PostDisplay
              actions={true}
              key={`comment-${post?.id}`}
              isFetching={is_fetching_comments && !isFetchingNextPage}
              post={post}
              ellipsis={true}
            />
          )}
          refreshControl={
            <RefreshControl
              colors={[violet_500]}
              refreshing={is_fetching_comments}
              onRefresh={refetchComments}
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
    ) : (
      <View style={[tailwindClasses("px-4 mb-3 ")]}>
        <Text
          style={tailwindClasses("text-center text-xl font-bold text-gray-500")}
        >
          .
        </Text>
      </View>
    );
  }, [
    is_fetching_comments,
    refetchComments,
    post,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  ]);
  return (
    <ScrollView style={tailwindClasses("container")}>
      {ParentPost}
      {Post}
      {all_comments.length > 0 && (
        <>
          <Text className="-mt-3 mb-3 text-center text-xl font-bold text-gray-500">
            ...
          </Text>
          <View className="pb-6">{Comments}</View>
        </>
      )}
    </ScrollView>
  );
}
