import PagerView from "@/app_directories/components/app/PagerView";
import PagerViewIndicator from "@/app_directories/components/app/PagerViewIndicator";
import Text from "@/app_directories/components/app/Text";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { DarkStyle, LightStyle } from "@/app_directories/constants/Theme";
import { Post } from "@/app_directories/types/post";
import type { MediaType } from "@/app_directories/types/types";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useMemo, useState } from "react";
import { Pressable, View, useColorScheme } from "react-native";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import PostSkeleton from "@/app_directories/components/skeletons/PostSkeleton";
import DisplayPostMedia from "./DisplayPostMedia";
import PostActions from "./PostActions";
import PostRichTextDisplay from "./PostRichTextDisplay";
import PostTop from "./PostTop";

function quotedPreviewText(q: Post): string | undefined {
  if (q.text?.trim()) return q.text.trim();
  const first = q.longPost?.content?.find((b) => b.text?.trim());
  return first?.text?.trim();
}

type Props = {
  readonly post?: Post | null;
  readonly actions: boolean;
  readonly ellipsis: boolean;
  readonly isFetching: boolean;
  readonly emphasizeVideo?: boolean;
  readonly isFeedVideoActive?: boolean;
  readonly recordWatchForPost?: boolean;
  /** Home feed: autoplay monetized trailer when present (web `feedTrailerAutoplay`). */
  readonly feedTrailerAutoplay?: boolean;
};

const PostDisplay = memo(
  ({
    post,
    ellipsis,
    actions,
    isFetching,
    emphasizeVideo = false,
    isFeedVideoActive,
    recordWatchForPost = false,
    feedTrailerAutoplay = false,
  }: Props) => {
    const color_scheme = useColorScheme();
    const bg_color = useMemo(
      () =>
        color_scheme === "dark"
          ? DarkStyle.cardBackgroundColor
          : LightStyle.cardBackgroundColor,
      [color_scheme],
    );
    const [currentPage, setCurrentPage] = useState(0);
    const router = useRouter();

    const quotedText = useMemo(
      () => (post?.quotedPost ? quotedPreviewText(post.quotedPost) : undefined),
      [post],
    );

    const openQuoted = useCallback(() => {
      if (post?.quotedPost?.id) {
        router.push(app_routes.post.view(post.quotedPost.id));
      }
    }, [router, post]);

    const openPost = useCallback(() => {
      router.push(app_routes.post.view(post!.id));
    }, [router, post]);

    return !isFetching && post ? (
      <Pressable
        onPress={openPost}
        style={[
          tailwindClasses(
            "px-3 pt-3 pb-1 mb-3 rounded-lg min-h-40 cursor-pointer",
          ),
          { backgroundColor: bg_color.backgroundColor },
        ]}
      >
        <View style={tailwindClasses("rounded-lg")}>
          <PostTop post={post} />
          {post.quotedPost?.id ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                openQuoted();
              }}
              style={tailwindClasses(
                "mt-2 mb-1 rounded-lg border border-gray-200 dark:border-gray-600 p-2",
              )}
            >
              <Text
                className="text-xs uppercase tracking-wide mb-1"
                style={tailwindClasses("text-gray-500")}
              >
                Quoted post
              </Text>
              <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">
                @{post.quotedPost.author?.username ?? "…"}
              </Text>
              {quotedText ? (
                <PostRichTextDisplay
                  text={quotedText}
                  numberOfLines={4}
                  className="text-sm mt-1 text-gray-700 dark:text-gray-300"
                />
              ) : null}
              {post.quotedPost.media?.length ? (
                <View style={tailwindClasses("mt-2 h-32")}>
                  <DisplayPostMedia
                    className="h-full"
                    media={post.quotedPost.media}
                    mediaPlayback={post.quotedPost.mediaPlayback}
                    mediaMetadata={post.quotedPost.mediaMetadata}
                    mediaTypes={post.quotedPost.mediaTypes}
                    postId={post.quotedPost.id}
                    emphasizeVideo={false}
                    isFeedVideoActive={false}
                    paidVideoClickInterstitial={false}
                    feedTrailerAutoplay={false}
                    monetizationEnabled={post.quotedPost.monetizationEnabled}
                  />
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {post.type === "SHORT" ? (
            <>
              {post.media.length ? (
                <DisplayPostMedia
                  className="mt-2"
                  media={post.media}
                  mediaPlayback={post.mediaPlayback}
                  mediaMetadata={post.mediaMetadata}
                  mediaTypes={post.mediaTypes}
                  postId={post.id}
                  emphasizeVideo={emphasizeVideo}
                  isFeedVideoActive={isFeedVideoActive}
                  recordWatchPostId={recordWatchForPost ? post.id : undefined}
                  monetizationEnabled={post.monetizationEnabled}
                  feedTrailerAutoplay={feedTrailerAutoplay}
                />
              ) : null}
              {post.text ? (
                <PostRichTextDisplay
                  text={String(post.text)}
                  numberOfLines={ellipsis ? 5 : undefined}
                  className="break-word mt-2 font-normal"
                />
              ) : null}
            </>
          ) : (
            <PagerView
              initialPage={0}
              onPageScroll={(e) => setCurrentPage(e)}
              spacing={56}
            >
              {post.longPost?.content?.map((content, index) => {
                return (
                  <View
                    style={[tailwindClasses("rounded-md")]}
                    key={post.id + "-long-post-" + index}
                  >
                    <DisplayPostMedia
                      className="mt-2"
                      media={content.media as string[]}
                      mediaPlayback={content.mediaPlayback}
                      mediaMetadata={content.mediaMetadata}
                      mediaTypes={content.mediaTypes as MediaType[]}
                      postId={post.id}
                      emphasizeVideo={emphasizeVideo}
                      isFeedVideoActive={isFeedVideoActive}
                      recordWatchPostId={
                        recordWatchForPost ? post.id : undefined
                      }
                      monetizationEnabled={post.monetizationEnabled}
                      feedTrailerAutoplay={feedTrailerAutoplay}
                    />

                    <PagerViewIndicator
                      currentPage={currentPage}
                      length={post.longPost?.content?.length as number}
                      ids={post.longPost?.content?.map((c) => c.id) as string[]}
                    />

                    <PostRichTextDisplay
                      text={String(content.text ?? "")}
                      numberOfLines={ellipsis ? 5 : undefined}
                      className="break-word mt-2 font-light"
                    />
                  </View>
                );
              })}
            </PagerView>
          )}
          {actions && <PostActions post={post} />}
        </View>
      </Pressable>
    ) : (
      <PostSkeleton />
    );
  },
);

export default PostDisplay;
