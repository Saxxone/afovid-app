import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { primary, violet_500, white } from "@/app_directories/constants/Colors";
import { DarkStyle, LightStyle } from "@/app_directories/constants/Theme";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type {
  CoinBalanceResponse,
  CoinQuoteResponse,
  CoinUnlockResponse,
} from "@/app_directories/types/coins";
import { FetchMethod } from "@/app_directories/types/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  View,
  useColorScheme,
} from "react-native";

type Props = {
  readonly visible: boolean;
  readonly postId: string;
  readonly mediaIndex: number;
  readonly onClose: () => void;
  readonly onUnlocked: () => void;
  readonly onRequestTopUp: () => void;
};

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
  const code = (res as { status?: number }).status;
  return code === 402;
}

export default function PaidVideoUnlockModal({
  visible,
  postId,
  mediaIndex,
  onClose,
  onUnlocked,
  onRequestTopUp,
}: Props) {
  const scheme = useColorScheme();
  const { setSnackBar } = useSnackBar();
  const queryClient = useQueryClient();
  const [balanceMinor, setBalanceMinor] = useState<number | null>(null);
  const [quote, setQuote] = useState<CoinQuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const surface = useMemo(
    () =>
      scheme === "dark"
        ? DarkStyle.cardBackgroundColor.backgroundColor
        : (LightStyle.cardBackgroundColor.backgroundColor ?? white),
    [scheme],
  );
  const mainText = useMemo(
    () =>
      scheme === "dark"
        ? DarkStyle.textColor.color
        : LightStyle.textColor.color,
    [scheme],
  );
  const muted = useMemo(
    () =>
      scheme === "dark"
        ? DarkStyle.mutedTextColor.color
        : LightStyle.mutedTextColor.color,
    [scheme],
  );

  const load = useCallback(async () => {
    if (!visible || !postId) return;
    setLoading(true);
    setQuote(null);
    setBalanceMinor(null);
    try {
      const [balRes, qRes] = await Promise.all([
        ApiConnectService<CoinBalanceResponse>({
          url: api_routes.coins.balance,
          method: FetchMethod.GET,
        }),
        ApiConnectService<CoinQuoteResponse>({
          url: api_routes.coins.quote(postId),
          method: FetchMethod.GET,
        }),
      ]);
      if (!balRes.error && balRes.data) {
        setBalanceMinor(balRes.data.balanceMinor);
      }
      if (!qRes.error && qRes.data) {
        setQuote(qRes.data);
        if (qRes.data.alreadyUnlocked) {
          await queryClient.invalidateQueries({ queryKey: ["feed"] });
          await queryClient.invalidateQueries({ queryKey: ["post"] });
          onUnlocked();
          onClose();
        }
      } else if (qRes.error) {
        setSnackBar({
          visible: true,
          title: "Coins",
          type: "error",
          message: (qRes.error as { message?: string })?.message ?? "Error",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [visible, postId, queryClient, onClose, onUnlocked, setSnackBar]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const onUnlock = useCallback(async () => {
    if (!postId || unlocking) return;
    setUnlocking(true);
    try {
      const res = await ApiConnectService<CoinUnlockResponse>({
        url: api_routes.coins.unlock(postId),
        method: FetchMethod.POST,
      });
      if (res.error) {
        if (isInsufficientCoins(res.error)) {
          setSnackBar({
            visible: true,
            title: "Coins",
            type: "info",
            message: "Not enough coins. Top up to continue.",
          });
          return;
        }
        setSnackBar({
          visible: true,
          title: "Unlock",
          type: "error",
          message: (res.error as { message?: string })?.message ?? "Failed",
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["post"] });
      await queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      onUnlocked();
      onClose();
    } finally {
      setUnlocking(false);
    }
  }, [postId, unlocking, queryClient, onClose, onUnlocked, setSnackBar]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        style={tailwindClasses("flex-1 justify-end bg-black/50")}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            tailwindClasses("rounded-t-2xl p-5 pb-8"),
            { backgroundColor: surface },
          ]}
        >
          <Text
            className="text-lg font-semibold mb-2"
            style={{ color: mainText }}
          >
            Paid video
          </Text>
          {loading ? (
            <View style={tailwindClasses("py-8 items-center")}>
              <ActivityIndicator color={violet_500} />
            </View>
          ) : (
            <>
              {quote ? (
                <Text className="mb-2" style={{ color: muted }}>
                  Unlock for{" "}
                  <Text style={{ color: mainText, fontWeight: "600" }}>
                    {quote.chargeMinor.toLocaleString()} coins
                  </Text>
                  {balanceMinor != null ? (
                    <>
                      {" "}
                      · Your balance:{" "}
                      <Text style={{ color: mainText, fontWeight: "600" }}>
                        {balanceMinor.toLocaleString()}
                      </Text>
                    </>
                  ) : null}
                </Text>
              ) : (
                <Text style={{ color: muted }}>Could not load price.</Text>
              )}
              <View style={tailwindClasses("flex-row flex-wrap gap-2 mt-4")}>
                <Pressable
                  onPress={onClose}
                  style={tailwindClasses(
                    "rounded-lg px-4 py-3 border border-gray-300",
                  )}
                >
                  <Text style={{ color: mainText }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onRequestTopUp}
                  style={tailwindClasses(
                    "rounded-lg px-4 py-3 border border-gray-300",
                  )}
                >
                  <Text style={{ color: mainText }}>Top up</Text>
                </Pressable>
                <Pressable
                  onPress={() => void onUnlock()}
                  disabled={unlocking || !quote}
                  style={[
                    tailwindClasses(
                      "rounded-lg px-4 py-3 min-w-[100px] items-center",
                    ),
                    {
                      backgroundColor: primary,
                      opacity: unlocking || !quote ? 0.5 : 1,
                    },
                  ]}
                >
                  {unlocking ? (
                    <ActivityIndicator color={white} size="small" />
                  ) : (
                    <Text style={{ color: white, fontWeight: "600" }}>
                      Unlock
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
