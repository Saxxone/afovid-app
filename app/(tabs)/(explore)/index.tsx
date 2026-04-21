import Text from "@/app_directories/components/app/Text";
import FormInput from "@/app_directories/components/form/FormInput";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post, postContainsVideo } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  View,
  type ViewToken,
} from "react-native";

const POSTS_PER_PAGE = 9;
const SEARCH_DEBOUNCE_MS = 800;

/** Match bree-web `pages/explore.vue` query normalization before calling the API. */
function normalizeSearchForApi(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(" ")
    .join("+");
}

function postCreatedAtSortKey(post: Post): number {
  if (!post.createdAt) return 0;
  const t = new Date(post.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function ExploreSearchScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const qParam = Array.isArray(params.q) ? params.q[0] : params.q;

  const [search, setSearch] = useState(() =>
    qParam ? qParam.replace(/\+/g, " ") : "",
  );
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    if (qParam == null) return;
    const decoded = qParam.replace(/\+/g, " ");
    setSearch((prev) => (prev === decoded ? prev : decoded));
  }, [qParam]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQ(normalizeSearchForApi(search));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    router.setParams(debouncedQ ? { q: debouncedQ } : { q: "" });
  }, [debouncedQ, router]);

  const commitSearchToUrl = useCallback(() => {
    const norm = normalizeSearchForApi(search);
    router.setParams(norm ? { q: norm } : { q: "" });
  }, [router, search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
    isPending,
  } = useInfiniteQuery({
    queryKey: ["posts-search", debouncedQ],
    queryFn: async ({ pageParam = 0 }) => {
      const skip = pageParam * POSTS_PER_PAGE;
      const take = POSTS_PER_PAGE;
      const base = api_routes.posts.getSearchResults(
        encodeURIComponent(debouncedQ),
      );
      const url = `${base}&skip=${skip}&take=${take}`;
      return await ApiConnectService<Post[]>({
        url,
        method: FetchMethod.POST,
      });
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.data?.length === POSTS_PER_PAGE
        ? pages.length
        : undefined;
    },
    initialPageParam: 0,
    enabled: debouncedQ.length > 0,
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

  const [activePostId, setActivePostId] = useState<string | null>(null);

  useEffect(() => {
    setActivePostId(null);
  }, [debouncedQ]);

  useEffect(() => {
    if (feed_posts.length === 0) return;
    setActivePostId((prev) => prev ?? feed_posts[0].id);
  }, [feed_posts]);

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

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={tailwindClasses("py-4")}>
        <ActivityIndicator color={violet_500} />
      </View>
    );
  };

  const listLoading =
    debouncedQ.length > 0 &&
    (isPending || (isFetching && feed_posts.length === 0));

  const listEmpty = () => {
    if (!debouncedQ.length) {
      return (
        <View style={tailwindClasses("p-6")}>
          <Text className="text-center text-gray-500">
            {t("explore.hint_empty")}
          </Text>
        </View>
      );
    }
    if (listLoading) {
      return (
        <View style={tailwindClasses("py-12")}>
          <ActivityIndicator color={violet_500} />
        </View>
      );
    }
    return (
      <View style={tailwindClasses("p-6")}>
        <Text className="text-center text-gray-500">
          {t("explore.no_results")}
        </Text>
      </View>
    );
  };

  return (
    <View style={tailwindClasses("container flex-1")}>
      <View style={tailwindClasses("px-3 pt-2 pb-2")}>
        <FormInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={commitSearchToUrl}
          returnKeyType="search"
          placeholder={t("explore.placeholder")}
          validationType="none"
        />
      </View>
      <FlashList
        data={feed_posts}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListEmptyComponent={listEmpty}
        keyExtractor={(item) => item?.id ?? ""}
        renderItem={({ item }) => (
          <PostDisplay
            key={item?.id}
            post={item}
            ellipsis={true}
            actions={true}
            isFetching={listLoading}
            emphasizeVideo={postContainsVideo(item)}
            isFeedVideoActive={activePostId === item?.id}
          />
        )}
        refreshControl={
          <RefreshControl
            colors={[violet_500]}
            refreshing={
              isFetching && debouncedQ.length > 0 && feed_posts.length > 0
            }
            onRefresh={() => void refetch()}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage && debouncedQ.length > 0) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}
