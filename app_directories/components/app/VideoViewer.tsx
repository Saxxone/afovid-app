import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { violet_500 } from "@/app_directories/constants/Colors";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { FetchMethod } from "@/app_directories/types/types";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useEvent } from "expo";
import {
  allowScreenCaptureAsync,
  preventScreenCaptureAsync,
} from "expo-screen-capture";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

interface Props {
  source: string;
  /** When false, native controls are hidden. Defaults to true when omitted. */
  controls?: boolean;
  autoplay?: boolean;
  /** When false, playback stays paused (e.g. feed row off-screen). Defaults to true. */
  shouldPlay?: boolean;
  /** When false, fullscreen is disabled on the native player. Defaults to true. */
  allowFullscreen?: boolean;
  /**
   * Feed-style inline: show unmute control (matches web `showMuteToggle`).
   * Defaults false so detail / MediaViewer stays unchanged unless opted in.
   */
  showMuteToggle?: boolean;
  /** When set, POST watch history after ~4s cumulative playback while playing. */
  recordWatchPostId?: string;
}

const WATCH_RECORD_THRESHOLD_SEC = 4;

export default function VideoScreen({
  source,
  controls,
  autoplay = true,
  shouldPlay = true,
  allowFullscreen = true,
  showMuteToggle = false,
  recordWatchPostId,
}: Props) {
  const nativeControls = controls ?? true;
  const isFocused = useIsFocused();

  const isFeedInline = autoplay === true && nativeControls === false;
  const [feedUserWantsUnmuted, setFeedUserWantsUnmuted] = useState(false);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  const shouldForceMute = useMemo(
    () => isFeedInline && !(showMuteToggle === true && feedUserWantsUnmuted),
    [isFeedInline, showMuteToggle, feedUserWantsUnmuted],
  );

  const showMuteToggleUi = useMemo(
    () =>
      showMuteToggle === true && autoplay === true && nativeControls === false,
    [showMuteToggle, autoplay, nativeControls],
  );

  /** Feed mute chip only after first frame; avoids showing it on the loading overlay. */
  const showMuteToggleWhenViewable = useMemo(
    () => showMuteToggleUi && hasRenderedFrame,
    [showMuteToggleUi, hasRenderedFrame],
  );

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
  });

  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const watchRecordedRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", setAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      try {
        player.pause();
      } catch {
        // Best-effort cleanup during teardown.
      }
    };
  }, [player]);

  useEffect(() => {
    setHasRenderedFrame(false);
    setFeedUserWantsUnmuted(false);
    watchRecordedRef.current = false;
  }, [source]);

  useEffect(() => {
    watchRecordedRef.current = false;
  }, [recordWatchPostId]);

  useEffect(() => {
    if (!recordWatchPostId || !isPlaying || watchRecordedRef.current) {
      return;
    }
    const tick = setInterval(() => {
      if (player.currentTime < WATCH_RECORD_THRESHOLD_SEC) {
        return;
      }
      watchRecordedRef.current = true;
      void ApiConnectService<{ recorded: boolean }>({
        url: api_routes.posts.recordWatch(recordWatchPostId),
        method: FetchMethod.POST,
      }).then((res) => {
        if (res.error) {
          watchRecordedRef.current = false;
        }
      });
      clearInterval(tick);
    }, 400);
    return () => clearInterval(tick);
  }, [isPlaying, recordWatchPostId, player]);

  useEffect(() => {
    if (isPlaying && nativeControls === false) {
      setHasRenderedFrame(true);
    }
  }, [isPlaying, nativeControls]);

  useEffect(() => {
    if (!isFeedInline) {
      player.muted = false;
      return;
    }
    player.muted = shouldForceMute;
  }, [player, isFeedInline, shouldForceMute]);

  const screenCaptureKey = `video-fullscreen-${useId()}`;

  const handleFullscreenEnter = useCallback(() => {
    preventScreenCaptureAsync(screenCaptureKey).catch(() => {});
  }, [screenCaptureKey]);

  const handleFullscreenExit = useCallback(() => {
    allowScreenCaptureAsync(screenCaptureKey).catch(() => {});
  }, [screenCaptureKey]);

  useEffect(() => {
    return () => {
      allowScreenCaptureAsync(screenCaptureKey).catch(() => {});
    };
  }, [screenCaptureKey]);

  useEffect(() => {
    if (shouldPlay === false || !isFocused || appState !== "active") {
      player.pause();
      return;
    }
    if (autoplay === false) {
      return;
    }
    if (status === "error") {
      return;
    }
    try {
      const maybePlayResult = player.play() as unknown;
      if (
        typeof maybePlayResult === "object" &&
        maybePlayResult !== null &&
        "catch" in maybePlayResult
      ) {
        void (maybePlayResult as Promise<void>).catch(() => {
          if (unmountedRef.current) return;
          // Android can reject keep-awake activation when the Activity is already
          // torn down during fast navigation/background transitions.
        });
      }
    } catch {
      // Best-effort playback start; avoid bubbling lifecycle race exceptions.
    }
    if (shouldForceMute) {
      player.muted = true;
    }
  }, [
    player,
    shouldPlay,
    autoplay,
    shouldForceMute,
    status,
    isFocused,
    appState,
  ]);

  const toggleFeedMute = useCallback(() => {
    if (!showMuteToggleWhenViewable) return;
    setFeedUserWantsUnmuted((v) => !v);
  }, [showMuteToggleWhenViewable]);

  const fullscreenOptions = useMemo(
    () => ({ enable: allowFullscreen }),
    [allowFullscreen],
  );

  const showLoadingOverlay = nativeControls === false && !hasRenderedFrame;

  return (
    <View
      style={tailwindClasses(
        "mx-auto flex w-full flex-1 items-center justify-center",
      )}
    >
      <View style={styles.videoHost}>
        <VideoView
          player={player}
          nativeControls={nativeControls}
          fullscreenOptions={fullscreenOptions}
          allowsPictureInPicture
          allowsVideoFrameAnalysis
          startsPictureInPictureAutomatically={false}
          onFullscreenEnter={handleFullscreenEnter}
          onFullscreenExit={handleFullscreenExit}
          onFirstFrameRender={() => setHasRenderedFrame(true)}
          contentFit="cover"
          style={[tailwindClasses("rounded-lg w-full h-full object-cover")]}
        />
        {showLoadingOverlay ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={violet_500} />
            <Text className="font-medium" style={styles.loadingLabel}>
              Loading video…
            </Text>
          </View>
        ) : null}
        {showMuteToggleWhenViewable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              feedUserWantsUnmuted ? "Mute video" : "Unmute video"
            }
            accessibilityState={{ selected: feedUserWantsUnmuted }}
            onPress={toggleFeedMute}
            style={styles.muteButton}
            hitSlop={12}
          >
            <Ionicons
              name={feedUserWantsUnmuted ? "volume-high" : "volume-mute"}
              size={16}
              color="#fff"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoHost: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17, 24, 39, 0.88)",
    zIndex: 4,
    borderRadius: 8,
  },
  loadingLabel: {
    marginTop: 10,
    fontSize: 12,
    color: "#d1d5db",
  },
  muteButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
