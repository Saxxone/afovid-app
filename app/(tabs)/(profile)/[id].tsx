import Text from "@/app_directories/components/app/Text";
import ProfileTop from "@/app_directories/components/profile/ProfileTop";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { DarkStyle, LightStyle } from "@/app_directories/constants/Theme";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post, postContainsVideo } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import type { User } from "@/app_directories/types/user";
import { jwtUserId } from "@/app_directories/utils/jwtPayload";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  View,
  useColorScheme,
  type ViewToken,
} from "react-native";

const POSTS_PAGE = 10;

export default function ProfileByIdScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string | string[] }>();
  const profileUserId = useMemo(
    () => (Array.isArray(idParam) ? idParam[0] : idParam) ?? "",
    [idParam],
  );

  const color_scheme = useColorScheme();
  const pageBg = useMemo(
    () =>
      color_scheme === "dark"
        ? DarkStyle.backgroundColor.backgroundColor
        : LightStyle.backgroundColor.backgroundColor,
    [color_scheme],
  );

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { access_token } = await getTokens();
      if (cancelled) return;
      setSessionUserId(access_token ? jwtUserId(access_token) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: profileUser,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ["user-profile", profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => {
      const res = await ApiConnectService<Partial<User>>({
        url: api_routes.users.get(profileUserId),
        method: FetchMethod.GET,
      });
      if (res.error || !res.data) {
        throw new Error("Profile not found");
      }
      return res.data;
    },
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["user-posts", profileUserId],
    enabled: !!profileUserId && !!profileUser,
    queryFn: async ({ pageParam = 0 }) => {
      return await ApiConnectService<Post[]>({
        url: api_routes.posts.getUserPosts(profileUserId),
        method: FetchMethod.GET,
        query: {
          skip: pageParam * POSTS_PAGE,
          take: POSTS_PAGE,
        },
      });
    },
    getNextPageParam: (lastPage, pages) => {
      const len = lastPage.data?.length ?? 0;
      return len === POSTS_PAGE ? pages.length : undefined;
    },
    initialPageParam: 0,
  });

  const posts = useMemo(
    () =>
      data?.pages
        .flatMap((p) => p.data ?? [])
        .filter((x): x is Post => x != null) ?? [],
    [data?.pages],
  );

  useEffect(() => {
    if (posts.length === 0) return;
    setActivePostId((prev) => prev ?? posts[0]?.id ?? null);
  }, [posts]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 20,
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

  const isSameUser =
    !!sessionUserId && !!profileUserId && sessionUserId === profileUserId;

  const listHeader = useMemo(() => {
    if (!profileUser) return null;
    return (
      <View style={tailwindClasses("px-3 pt-2")}>
        <ProfileTop user={profileUser} isSameUser={isSameUser} />
        <View style={tailwindClasses("h-4")} />
      </View>
    );
  }, [profileUser, isSameUser]);

  if (!profileUserId) {
    return (
      <View
        style={[tailwindClasses("flex-1 p-4"), { backgroundColor: pageBg }]}
      >
        <Text>Invalid profile.</Text>
      </View>
    );
  }

  if (userLoading) {
    return (
      <View
        style={[
          tailwindClasses("flex-1 items-center justify-center"),
          { backgroundColor: pageBg },
        ]}
      >
        <ActivityIndicator color={violet_500} size="large" />
      </View>
    );
  }

  if (userError || !profileUser) {
    return (
      <View
        style={[tailwindClasses("flex-1 p-4"), { backgroundColor: pageBg }]}
      >
        <Text className="text-center text-gray-500">
          No profile to display.
        </Text>
      </View>
    );
  }

  return (
    <View style={[tailwindClasses("flex-1"), { backgroundColor: pageBg }]}>
      <FlashList
        data={posts}
        ListHeaderComponent={listHeader}
        keyExtractor={(item) => item?.id ?? ""}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListEmptyComponent={
          isFetching ? null : (
            <View style={tailwindClasses("px-3 py-8")}>
              <Text className="text-center text-gray-500">No posts yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PostDisplay
            key={item?.id}
            post={item}
            ellipsis
            actions
            isFetching={isFetching && !isFetchingNextPage}
            emphasizeVideo={postContainsVideo(item)}
            isFeedVideoActive={activePostId === item?.id}
          />
        )}
        refreshControl={
          <RefreshControl
            colors={[violet_500]}
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={() => {
              void refetchUser();
              void refetch();
            }}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={tailwindClasses("py-4")}>
              <ActivityIndicator color={violet_500} />
            </View>
          ) : null
        }
      />
    </View>
  );
}
