import ImageViewer from "@/app_directories/components/app/ImageViewer";
import Text from "@/app_directories/components/app/Text";
import VideoViewer from "@/app_directories/components/app/VideoViewer";
import PaidVideoUnlockModal from "@/app_directories/components/coins/PaidVideoUnlockModal";
import CoinTopUpModal from "@/app_directories/components/coins/CoinTopUpModal";
import PostActions from "@/app_directories/components/post/PostActions";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { MediaType } from "@/app_directories/types/types";
import type { Post, PostMediaMetadata } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import {
  pickVideoPlaybackSource,
  resolvePlaybackUrl,
} from "@/app_directories/utils/playbackUrl";
import { writeCoinUnlockResume } from "@/app_directories/utils/coinCheckoutResume";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W } = Dimensions.get("window");

type MediaEntry = {
  media: string;
  mediaPlayback?: string;
  mediaMetadata?: PostMediaMetadata;
  mediaType: MediaType;
};

function buildEntries(post: Post): MediaEntry[] {
  if (post.type === "SHORT") {
    return post.media.map((m, i) => ({
      media: m,
      mediaPlayback: post.mediaPlayback?.[i],
      mediaMetadata: post.mediaMetadata?.[i],
      mediaType: post.mediaTypes[i] ?? "image",
    }));
  }
  const out: MediaEntry[] = [];
  for (const block of post.longPost?.content ?? []) {
    const med = block.media ?? [];
    for (let i = 0; i < med.length; i++) {
      out.push({
        media: med[i] as string,
        mediaPlayback: block.mediaPlayback?.[i],
        mediaMetadata: block.mediaMetadata?.[i],
        mediaType: (block.mediaTypes?.[i] as MediaType) ?? "image",
      });
    }
  }
  return out;
}

export default function PostMediaViewerScreen() {
  const { id, mediaIndex: mediaIndexParam } = useLocalSearchParams<{
    id: string;
    mediaIndex?: string;
  }>();
  const postId = Array.isArray(id) ? id[0] : (id ?? "");
  const initialIndex = useMemo(() => {
    const raw = Array.isArray(mediaIndexParam)
      ? mediaIndexParam[0]
      : mediaIndexParam;
    const n = raw != null ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [mediaIndexParam]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () =>
      await ApiConnectService<Post>({
        url: api_routes.posts.getPostById(postId),
        method: FetchMethod.GET,
      }),
    enabled: !!postId,
    retry: false,
  });

  const post = data?.data;
  const entries = useMemo(() => (post ? buildEntries(post) : []), [post]);
  const [page, setPage] = useState(initialIndex);
  const [token, setToken] = useState("");

  useEffect(() => {
    void getTokens().then((t) => setToken(t.access_token ?? ""));
  }, []);

  useEffect(() => {
    setPage(Math.min(initialIndex, Math.max(0, entries.length - 1)));
  }, [initialIndex, entries.length]);

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const resolveEntry = useCallback(
    (e: MediaEntry) => {
      if (e.mediaType === "image") {
        if (!token) return "";
        return resolvePlaybackUrl(e.media, token, {
          requiresAuth: e.mediaMetadata?.requiresAuth,
          fileId: e.mediaMetadata?.fileId,
        });
      }
      if (e.mediaMetadata?.paywalled && e.mediaMetadata?.trailerPlayback) {
        return resolvePlaybackUrl(e.mediaMetadata.trailerPlayback, token, {
          requiresAuth: false,
          fileId: e.mediaMetadata?.fileId,
        });
      }
      if (e.mediaMetadata?.paywalled) return "";
      const raw = pickVideoPlaybackSource(e.mediaPlayback, e.media);
      if (!token || !raw) return "";
      return resolvePlaybackUrl(raw, token, {
        requiresAuth: e.mediaMetadata?.requiresAuth,
        fileId: e.mediaMetadata?.fileId,
      });
    },
    [token],
  );

  const current = entries[page];
  const needsUnlock =
    current?.mediaType === "video" &&
    (current.mediaMetadata?.paywalled === true ||
      (post?.monetizationEnabled === true &&
        !(current.mediaPlayback ?? "").trim() &&
        current.mediaMetadata?.requiresAuth !== false));

  const onUnlocked = useCallback(() => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  }, [refetch, queryClient]);

  if (!postId) {
    return (
      <View style={tailwindClasses("flex-1 p-4")}>
        <Text>Missing post</Text>
      </View>
    );
  }

  if (isFetching && !post) {
    return (
      <View style={tailwindClasses("flex-1 items-center justify-center")}>
        <ActivityIndicator color={violet_500} size="large" />
      </View>
    );
  }

  if (!post || entries.length === 0) {
    return (
      <View style={tailwindClasses("flex-1 p-4")}>
        <Text>Could not load media.</Text>
      </View>
    );
  }

  return (
    <View style={tailwindClasses("flex-1 bg-black")}>
      <View
        style={[
          tailwindClasses("flex-row items-center justify-between px-3"),
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={tailwindClasses("text-white text-sm")}>
          {page + 1} / {entries.length}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(ev) => {
          const x = ev.nativeEvent.contentOffset.x;
          const idx = Math.round(x / SCREEN_W);
          setPage(Math.max(0, Math.min(entries.length - 1, idx)));
        }}
        contentOffset={{ x: page * SCREEN_W, y: 0 }}
      >
        {entries.map((e, i) => (
          <View
            key={`${e.media}-${i}`}
            style={{ width: SCREEN_W, flex: 1, justifyContent: "center" }}
          >
            {e.mediaType === "image" ? (
              <ImageViewer source={resolveEntry(e)} />
            ) : !resolveEntry(e) ? (
              <Pressable
                onPress={() => setUnlockOpen(true)}
                style={tailwindClasses(
                  "flex-1 items-center justify-center min-h-96",
                )}
              >
                <Ionicons name="lock-closed" size={48} color="#fff" />
                <Text style={tailwindClasses("text-white mt-2")}>
                  Tap to unlock
                </Text>
              </Pressable>
            ) : (
              <VideoViewer
                source={resolveEntry(e)}
                controls
                autoplay
                shouldPlay={page === i}
                allowFullscreen
                recordWatchPostId={post.id}
              />
            )}
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 8 }}>
        <PostActions post={post} />
      </View>

      <PaidVideoUnlockModal
        visible={unlockOpen}
        postId={post.id}
        mediaIndex={page}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => {
          setUnlockOpen(false);
          void onUnlocked();
        }}
        onRequestTopUp={async () => {
          await writeCoinUnlockResume({ postId: post.id, mediaIndex: page });
          setUnlockOpen(false);
          setTopUpOpen(true);
        }}
      />
      <CoinTopUpModal visible={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </View>
  );
}
