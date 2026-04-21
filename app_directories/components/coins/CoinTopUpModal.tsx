import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import {
  violet_100,
  violet_500,
  violet_600,
  violet_700,
  white,
} from "@/app_directories/constants/Colors";
import { DarkStyle, LightStyle } from "@/app_directories/constants/Theme";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type {
  CoinPackage,
  CoinStripeCheckoutResponse,
} from "@/app_directories/types/coins";
import { FetchMethod } from "@/app_directories/types/types";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";

type Props = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

export default function CoinTopUpModal({ visible, onClose }: Props) {
  const scheme = useColorScheme();
  const { setSnackBar } = useSnackBar();
  const queryClient = useQueryClient();

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

  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const webPackages = useMemo(
    () => packages.filter((p) => p.stripePriceId),
    [packages],
  );

  const loadPackages = useCallback(async () => {
    setLoadError(false);
    setPackagesLoading(true);
    try {
      const res = await ApiConnectService<CoinPackage[]>({
        url: api_routes.coins.packages,
        method: FetchMethod.GET,
      });
      if (res.error || !res.data) {
        setLoadError(true);
        setPackages([]);
        setSelectedId(null);
        return;
      }
      setPackages(res.data);
      const first = res.data.find((p) => p.stripePriceId);
      setSelectedId(first?.id ?? null);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadPackages();
    }
  }, [visible, loadPackages]);

  const onBackdrop = useCallback(() => {
    if (checkoutLoading) return;
    onClose();
  }, [checkoutLoading, onClose]);

  const onCheckout = useCallback(async () => {
    if (!selectedId || checkoutLoading || !webPackages.length) return;
    setCheckoutLoading(true);
    try {
      const res = await ApiConnectService<CoinStripeCheckoutResponse>({
        url: api_routes.coins.checkoutStripe,
        method: FetchMethod.POST,
        body: { packageId: selectedId, client: "native" },
      });
      if (res.error || !res.data?.url) {
        setSnackBar({
          visible: true,
          title: "Checkout",
          type: "error",
          message:
            (res.error as { message?: string })?.message ??
            "Could not start checkout.",
        });
        return;
      }
      await WebBrowser.openBrowserAsync(res.data.url);
      await queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      onClose();
    } finally {
      setCheckoutLoading(false);
    }
  }, [
    selectedId,
    checkoutLoading,
    webPackages.length,
    setSnackBar,
    queryClient,
    onClose,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onBackdrop}
    >
      <Pressable
        style={tailwindClasses(
          "flex-1 items-center justify-center bg-black/55 p-4",
        )}
        onPress={onBackdrop}
      >
        <Pressable
          style={[
            tailwindClasses("max-w-md w-full rounded-xl p-6 shadow-lg"),
            { backgroundColor: surface },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={tailwindClasses("mb-4 flex-row items-center gap-2")}>
            <Ionicons name="wallet-outline" size={28} color={mainText} />
            <Text
              className="text-lg font-semibold leading-snug"
              style={{ color: mainText }}
            >
              Top up coins
            </Text>
          </View>

          <Text
            className="mb-4 text-sm leading-relaxed"
            style={{ color: muted }}
          >
            Choose a package. You will complete payment in your browser, then
            return here — your balance updates when you come back.
          </Text>

          {loadError ? (
            <Text className="mb-4 text-sm" style={{ color: muted }}>
              Could not load packages. Try again later.
            </Text>
          ) : null}

          {packagesLoading ? (
            <View style={tailwindClasses("py-8 items-center")}>
              <ActivityIndicator color={violet_500} />
            </View>
          ) : null}

          {!packagesLoading && !packages.length && visible ? (
            <Text className="mb-4 text-sm" style={{ color: muted }}>
              No packages available.
            </Text>
          ) : null}

          {!packagesLoading &&
          packages.length > 0 &&
          !webPackages.length &&
          visible ? (
            <Text
              className="mb-4 text-sm leading-relaxed"
              style={{ color: muted }}
            >
              No web checkout packages are configured. Use in-app purchase on
              supported builds when available.
            </Text>
          ) : null}

          {!packagesLoading && packages.length > 0 ? (
            <ScrollView
              style={{ maxHeight: 240 }}
              contentContainerStyle={tailwindClasses("gap-2 pb-2")}
              showsVerticalScrollIndicator
            >
              {packages.map((pkg) => {
                const selectable = !!pkg.stripePriceId;
                const selected = selectedId === pkg.id && selectable;
                return (
                  <Pressable
                    key={pkg.id}
                    disabled={!selectable}
                    onPress={() => {
                      if (selectable) setSelectedId(pkg.id);
                    }}
                    style={[
                      tailwindClasses(
                        "flex-row items-center justify-between rounded-lg border px-4 py-3",
                      ),
                      {
                        borderColor: selected
                          ? violet_600
                          : "rgba(148, 163, 184, 0.35)",
                        backgroundColor: selected
                          ? scheme === "dark"
                            ? "rgba(76, 29, 149, 0.35)"
                            : violet_100
                          : "transparent",
                        opacity: selectable ? 1 : 0.55,
                      },
                    ]}
                  >
                    <Text
                      className="font-medium text-sm shrink pr-2"
                      style={{ color: mainText }}
                    >
                      {pkg.name}
                    </Text>
                    <View style={tailwindClasses("items-end shrink-0")}>
                      <Text
                        className="text-sm text-right"
                        style={{ color: selected ? violet_700 : muted }}
                      >
                        {pkg.coinsMinor.toLocaleString()} coins
                      </Text>
                      {!pkg.stripePriceId ? (
                        <Text className="text-xs" style={{ color: muted }}>
                          Mobile / other
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View
            style={tailwindClasses("mt-6 flex-row flex-wrap justify-end gap-2")}
          >
            <Pressable
              onPress={onBackdrop}
              disabled={checkoutLoading}
              style={tailwindClasses("rounded-lg px-4 py-2")}
            >
              <Text className="text-sm font-medium" style={{ color: muted }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void onCheckout()}
              disabled={
                !selectedId ||
                checkoutLoading ||
                !webPackages.length ||
                packagesLoading
              }
              style={[
                tailwindClasses("rounded-lg px-4 py-2"),
                {
                  backgroundColor: violet_600,
                  opacity:
                    !selectedId || checkoutLoading || !webPackages.length
                      ? 0.55
                      : 1,
                },
              ]}
            >
              {checkoutLoading ? (
                <ActivityIndicator color={white} size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">Pay</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
