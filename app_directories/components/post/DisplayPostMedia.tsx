import CoinTopUpModal from "@/app_directories/components/coins/CoinTopUpModal";
import PaidVideoUnlockModal from "@/app_directories/components/coins/PaidVideoUnlockModal";
import Text from "@/app_directories/components/app/Text";
import ImageViewer from "@/app_directories/components/app/ImageViewer";
import VideoViewer from "@/app_directories/components/app/VideoViewer";
import type { PostMediaMetadata } from "@/app_directories/types/post";
import type { MediaType } from "@/app_directories/types/types";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { writeCoinUnlockResume } from "@/app_directories/utils/coinCheckoutResume";
import {
  pickVideoPlaybackSource,
  resolvePlaybackUrl,
} from "@/app_directories/utils/playbackUrl";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

interface Props {
  media: string[];
  mediaPlayback?: string[];
  mediaMetadata?: PostMediaMetadata[];
  mediaTypes?: MediaType[];
  postId: string;
  readonly className?: string;
  readonly emphasizeVideo?: boolean;
  readonly isFeedVideoActive?: boolean;
  readonly showVideoMuteToggle?: boolean;
  readonly recordWatchPostId?: string;
  monetizationEnabled?: boolean;
  pricedCostMinor?: number | null;
  paidVideoClickInterstitial?: boolean;
  feedTrailerAutoplay?: boolean;
}

const cellFillStyle = { flex: 1, width: "100%" as const, minHeight: 0 };

function resolveMediaTypes(
  media: string[],
  mediaTypes?: MediaType[],
  mediaMetadata?: PostMediaMetadata[],
): MediaType[] {
  return media.map((_, i) => {
    const fromTypes = mediaTypes?.[i];
    if (fromTypes) return fromTypes;
    const mime = mediaMetadata?.[i]?.mimeType ?? "";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("image/")) return "image";
    return "image";
  });
}

const SocialDisplayPostMedia = memo(
  ({
    media,
    className,
    mediaTypes,
    mediaPlayback,
    mediaMetadata,
    postId,
    emphasizeVideo = false,
    isFeedVideoActive,
    showVideoMuteToggle = true,
    recordWatchPostId,
    monetizationEnabled = false,
    paidVideoClickInterstitial = true,
    feedTrailerAutoplay = false,
  }: Props) => {
    const router = useRouter();
    const classes = useMemo(
      () => tailwindClasses(className ?? ""),
      [className],
    );

    const [accessToken, setAccessToken] = useState("");
    useEffect(() => {
      void getTokens().then((t) => {
        setAccessToken(t.access_token ?? "");
      });
    }, []);

    const [interstitialOpen, setInterstitialOpen] = useState(false);
    const [topUpOpen, setTopUpOpen] = useState(false);
    const [pendingMediaIndex, setPendingMediaIndex] = useState<number | null>(
      null,
    );

    const hasVideo = useMemo(
      () => mediaTypes?.some((t) => t === "video") ?? false,
      [mediaTypes],
    );

    const resolvedTypes = useMemo(
      () => resolveMediaTypes(media, mediaTypes, mediaMetadata),
      [media, mediaTypes, mediaMetadata],
    );

    const dynamicGridClasses = useMemo(() => {
      switch (media.length) {
        case 1:
          return "grid-cols-1";
        case 2:
          return "grid-cols-2 p-1";
        case 3:
          return "grid-cols-2 p-1";
        default:
          return "grid-cols-2 p-1 grid-rows-2";
      }
    }, [media.length]);

    function dynamicGridRows(index: number) {
      if (index === 0 && media.length === 3) return "row-span-2";
      if (index >= 1 && index <= 2 && media.length === 3) return "row-span-1";
      else return "";
    }

    function isPaywalledVideoAt(index: number): boolean {
      return mediaMetadata?.[index]?.paywalled === true;
    }

    function rawTrailerPlaybackField(index: number): string {
      const meta = mediaMetadata?.[index];
      return meta?.trailerPlayback?.trim() || meta?.trailerUrl?.trim() || "";
    }

    function trailerVideoSrc(index: number): string {
      const raw = rawTrailerPlaybackField(index);
      if (!raw || !accessToken) return "";
      return resolvePlaybackUrl(raw, accessToken, {
        requiresAuth: false,
        fileId: mediaMetadata?.[index]?.fileId,
      });
    }

    function showPaywallVideoPlaceholder(index: number): boolean {
      return isPaywalledVideoAt(index) && !rawTrailerPlaybackField(index);
    }

    function fullVideoPlaybackSrc(index: number): string {
      if (isPaywalledVideoAt(index)) return "";
      const raw = pickVideoPlaybackSource(
        mediaPlayback?.[index],
        media[index] as string,
      );
      if (!raw || !accessToken) return "";
      return resolvePlaybackUrl(raw, accessToken, {
        requiresAuth: mediaMetadata?.[index]?.requiresAuth,
        fileId: mediaMetadata?.[index]?.fileId,
      });
    }

    function displayVideoPlaybackSrc(index: number): string {
      const tr = trailerVideoSrc(index);
      if (isPaywalledVideoAt(index) && tr) {
        return tr;
      }
      if (feedTrailerAutoplay && tr) {
        return tr;
      }
      return fullVideoPlaybackSrc(index);
    }

    function imageMediaSrc(index: number): string {
      const raw = media[index] as string;
      if (!raw || !accessToken) return "";
      return resolvePlaybackUrl(raw, accessToken, {
        requiresAuth: mediaMetadata?.[index]?.requiresAuth,
        fileId: mediaMetadata?.[index]?.fileId,
      });
    }

    function needsPaidUnlockInterstitialAt(index: number): boolean {
      if (resolvedTypes[index] !== "video") return false;
      if (mediaMetadata?.[index]?.paywalled === true) return true;
      const playback = mediaPlayback?.[index]?.trim() ?? "";
      if (playback) return false;
      if (mediaMetadata?.[index]?.requiresAuth === false) return false;
      return monetizationEnabled === true;
    }

    const goToMediaViewer = useCallback(
      (index: number) => {
        router.push({
          pathname: "/(tabs)/(home)/(post)/media/[id]",
          params: { id: postId, mediaIndex: String(index) },
        });
      },
      [router, postId],
    );

    const selectMedia = useCallback(
      (index: number) => {
        if (
          paidVideoClickInterstitial &&
          needsPaidUnlockInterstitialAt(index)
        ) {
          setPendingMediaIndex(index);
          setInterstitialOpen(true);
          return;
        }
        goToMediaViewer(index);
      },
      [paidVideoClickInterstitial, goToMediaViewer],
    );

    const onUnlockedFromModal = useCallback(() => {
      const idx = pendingMediaIndex ?? 0;
      setPendingMediaIndex(null);
      goToMediaViewer(idx);
    }, [pendingMediaIndex, goToMediaViewer]);

    const onRequestTopUp = useCallback(async () => {
      const idx = pendingMediaIndex ?? 0;
      await writeCoinUnlockResume({ postId, mediaIndex: idx });
      setInterstitialOpen(false);
      setTopUpOpen(true);
    }, [postId, pendingMediaIndex]);

    return (
      <View
        style={[
          emphasizeVideo && hasVideo
            ? tailwindClasses(
                "rounded-lg h-96 overflow-hidden flex flex-row flex-wrap",
              )
            : tailwindClasses(
                "rounded-lg h-64 overflow-hidden flex flex-row flex-wrap",
              ),
          classes,
        ]}
      >
        {media.map((m, index) => (
          <View
            key={m + index}
            style={[
              cellFillStyle,
              tailwindClasses(dynamicGridClasses),
              tailwindClasses(dynamicGridRows(index)),
            ]}
          >
            <Pressable
              onPress={() => selectMedia(index)}
              style={[
                cellFillStyle,
                tailwindClasses(
                  "overflow-hidden rounded-lg block cursor-pointer h-full",
                ),
              ]}
            >
              {resolvedTypes[index] === "image" ? (
                <ImageViewer source={imageMediaSrc(index)} />
              ) : showPaywallVideoPlaceholder(index) ? (
                <View
                  style={tailwindClasses(
                    "flex-1 items-center justify-center bg-black/80",
                  )}
                >
                  <Ionicons name="lock-closed" size={40} color="#fff" />
                  <Text style={tailwindClasses("text-white text-xs mt-2")}>
                    Unlock to watch
                  </Text>
                </View>
              ) : !displayVideoPlaybackSrc(index) ? (
                <View
                  style={tailwindClasses(
                    "flex-1 items-center justify-center bg-black",
                  )}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <VideoViewer
                  source={displayVideoPlaybackSrc(index)}
                  controls={false}
                  autoplay={true}
                  shouldPlay={isFeedVideoActive !== false}
                  showMuteToggle={showVideoMuteToggle}
                  allowFullscreen={false}
                  recordWatchPostId={recordWatchPostId}
                />
              )}
            </Pressable>
          </View>
        ))}

        <PaidVideoUnlockModal
          visible={interstitialOpen}
          postId={postId}
          mediaIndex={pendingMediaIndex ?? 0}
          onClose={() => {
            setInterstitialOpen(false);
            setPendingMediaIndex(null);
          }}
          onUnlocked={onUnlockedFromModal}
          onRequestTopUp={onRequestTopUp}
        />
        <CoinTopUpModal
          visible={topUpOpen}
          onClose={() => setTopUpOpen(false)}
        />
      </View>
    );
  },
);

export default SocialDisplayPostMedia;
