import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { primary } from "@/app_directories/constants/Colors";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { CoinUnlockResponse } from "@/app_directories/types/coins";
import type { Post } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import {
  clearCoinUnlockResume,
  readCoinUnlockResume,
} from "@/app_directories/utils/coinCheckoutResume";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

type PageStatus = "working" | "done" | "error" | "timeout";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function isApiError(
  res: unknown,
): res is { status?: number; statusCode?: number; message?: string } {
  return (
    typeof res === "object" &&
    res !== null &&
    ("status" in res || "statusCode" in res)
  );
}

function isInsufficientCoins(res: unknown): boolean {
  if (!isApiError(res)) return false;
  return (res as { status?: number }).status === 402;
}

export default function CoinCheckoutSuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const sid = Array.isArray(session_id) ? session_id[0] : session_id;

  const [status, setStatus] = useState<PageStatus>("working");
  const [errorMessage, setErrorMessage] = useState("");

  const retryUnlockOnce = useCallback(async () => {
    const resume = await readCoinUnlockResume();
    if (!resume?.postId) return;
    setStatus("working");
    setErrorMessage("");
    const mediaIndex = Number.isFinite(resume.mediaIndex)
      ? Number(resume.mediaIndex)
      : 0;
    const res = await ApiConnectService<CoinUnlockResponse>({
      url: api_routes.coins.unlock(resume.postId),
      method: FetchMethod.POST,
    });
    if (!res.error) {
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({
        queryKey: ["post", resume.postId],
      });
      await clearCoinUnlockResume();
      setStatus("done");
      router.replace({
        pathname: "/(tabs)/(home)/(post)/media/[id]",
        params: { id: resume.postId, mediaIndex: String(mediaIndex) },
      });
      return;
    }
    if (isInsufficientCoins(res.error)) {
      setStatus("timeout");
      return;
    }
    setErrorMessage((res.error as { message?: string })?.message ?? "Error");
    setStatus("error");
  }, [queryClient, router]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const resume = await readCoinUnlockResume();

      if (resume?.postId) {
        const mediaIndex = Number.isFinite(resume.mediaIndex)
          ? Number(resume.mediaIndex)
          : 0;
        for (let i = 0; i < 30; i++) {
          if (cancelled) return;
          const res = await ApiConnectService<CoinUnlockResponse>({
            url: api_routes.coins.unlock(resume.postId),
            method: FetchMethod.POST,
          });
          if (!res.error) {
            await queryClient.invalidateQueries({ queryKey: ["feed"] });
            await queryClient.invalidateQueries({
              queryKey: ["post", resume.postId],
            });
            await clearCoinUnlockResume();
            setStatus("done");
            router.replace({
              pathname: "/(tabs)/(home)/(post)/media/[id]",
              params: { id: resume.postId, mediaIndex: String(mediaIndex) },
            });
            return;
          }
          if (!isInsufficientCoins(res.error)) {
            setErrorMessage(
              (res.error as { message?: string })?.message ?? "Error",
            );
            setStatus("error");
            return;
          }
          await sleep(1500);
        }
        if (!cancelled) setStatus("timeout");
        return;
      }

      if (resume?.profileUserId) {
        const uid = resume.profileUserId;
        await clearCoinUnlockResume();
        await queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
        setStatus("done");
        router.replace(app_routes.profile.view(uid));
        return;
      }

      if (sid) {
        await queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      }
      await clearCoinUnlockResume();
      if (!cancelled) setStatus("done");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [queryClient, router, sid]);

  return (
    <View
      style={tailwindClasses("flex-1 px-4 py-12 items-center justify-center")}
    >
      {status === "working" ? (
        <>
          <ActivityIndicator color={primary} size="large" />
          <Text className="text-lg font-medium mt-4 text-center">
            Processing payment…
          </Text>
        </>
      ) : null}
      {status === "done" ? (
        <>
          <Text className="text-lg font-medium text-center">
            You are all set.
          </Text>
          <AppButton
            theme="primary"
            onPress={() => router.replace(app_routes.post.home)}
          >
            Back to home
          </AppButton>
        </>
      ) : null}
      {status === "error" ? (
        <>
          <Text className="text-lg font-medium text-center">
            Something went wrong
          </Text>
          <Text className="text-sm text-gray-500 mt-2 text-center">
            {errorMessage}
          </Text>
          <AppButton
            theme="primary"
            onPress={() => router.replace(app_routes.post.home)}
          >
            Back to home
          </AppButton>
        </>
      ) : null}
      {status === "timeout" ? (
        <>
          <Text className="text-lg font-medium text-center">
            Still processing
          </Text>
          <Text className="text-sm text-gray-500 mt-2 text-center">
            Try unlocking again in a moment.
          </Text>
          <AppButton theme="primary" onPress={() => void retryUnlockOnce()}>
            Retry unlock
          </AppButton>
        </>
      ) : null}
    </View>
  );
}
