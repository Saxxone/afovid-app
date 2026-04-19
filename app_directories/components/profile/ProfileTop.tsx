import CoinTopUpModal from "@/app_directories/components/coins/CoinTopUpModal";
import Text from "@/app_directories/components/app/Text";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import api_routes from "@/app_directories/constants/ApiRoutes";
import {
  violet_400,
  violet_600,
  violet_700,
  violet_900,
} from "@/app_directories/constants/Colors";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { CoinBalanceResponse } from "@/app_directories/types/coins";
import { FetchMethod } from "@/app_directories/types/types";
import type { User } from "@/app_directories/types/user";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
  useColorScheme,
} from "react-native";
import { DarkStyle, LightStyle } from "@/app_directories/constants/Theme";

type Props = {
  readonly user: Partial<User>;
  readonly isSameUser: boolean;
};

const ProfileTop = memo(({ user, isSameUser }: Props) => {
  const scheme = useColorScheme();
  const focused = useIsFocused();
  const [topUpOpen, setTopUpOpen] = useState(false);

  const {
    data: balanceMinor,
    isPending: balancePending,
    isError: balanceError,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ["coin-balance", user.id],
    enabled: isSameUser && !!user.id,
    queryFn: async () => {
      const res = await ApiConnectService<CoinBalanceResponse>({
        url: api_routes.coins.balance,
        method: FetchMethod.GET,
      });
      if (res.error || res.data == null) {
        throw new Error("balance");
      }
      return res.data.balanceMinor;
    },
  });

  useEffect(() => {
    if (focused && isSameUser && user.id) {
      void refetchBalance();
    }
  }, [focused, isSameUser, user.id, refetchBalance]);

  const muted = useMemo(
    () =>
      scheme === "dark"
        ? DarkStyle.mutedTextColor.color
        : LightStyle.mutedTextColor.color,
    [scheme],
  );
  const mainText = useMemo(
    () =>
      scheme === "dark"
        ? DarkStyle.textColor.color
        : LightStyle.textColor.color,
    [scheme],
  );

  const avatarUri = user.img ?? undefined;

  return (
    <View style={tailwindClasses("py-3")}>
      <View style={tailwindClasses("flex-row items-center justify-end gap-3")}>
        <Image
          source={
            avatarUri
              ? { uri: avatarUri }
              : require("@/app_directories/assets/images/afovid.png")
          }
          style={[
            tailwindClasses("rounded-full"),
            {
              width: 100,
              height: 100,
              borderWidth: 2,
              borderColor: violet_900,
            },
          ]}
          contentFit="cover"
        />
        <View style={tailwindClasses("flex-1 min-w-0")}>
          <View style={tailwindClasses("mb-1 flex-row items-center flex-wrap")}>
            <Text
              className="text-2xl font-medium leading-none"
              style={{ color: mainText }}
            >
              {user.name ?? "—"}
            </Text>
            {user.verified ? (
              <MaterialIcons
                name="verified"
                size={26}
                color={violet_700}
                style={tailwindClasses("ml-2")}
              />
            ) : null}
          </View>

          {isSameUser ? (
            <View style={tailwindClasses("gap-2")}>
              <View style={tailwindClasses("flex-row items-center gap-1")}>
                <Text className="text-sm" style={{ color: muted }}>
                  @{user.username ?? "—"}
                </Text>
                <Link href={app_routes.profile.edit as never} asChild>
                  <Pressable hitSlop={8} accessibilityLabel="Edit profile">
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={violet_400}
                    />
                  </Pressable>
                </Link>
              </View>

              <View
                style={tailwindClasses(
                  "mt-1 flex-row flex-wrap items-center justify-between gap-2",
                )}
              >
                <View style={tailwindClasses("flex-row items-center gap-1")}>
                  <Ionicons name="wallet-outline" size={16} color={muted} />
                  <Text
                    className="text-sm font-medium"
                    style={{ color: mainText }}
                  >
                    {balancePending
                      ? "Loading balance…"
                      : balanceError
                        ? "Balance unavailable"
                        : `${(balanceMinor ?? 0).toLocaleString()} coins`}
                  </Text>
                  {balancePending ? (
                    <ActivityIndicator size="small" color={violet_400} />
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setTopUpOpen(true)}
                  style={tailwindClasses("rounded-lg px-2 py-1")}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: violet_600 }}
                  >
                    Top up
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={tailwindClasses(
                "mt-2 self-start rounded-full bg-violet-700 px-6 py-2",
              )}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Follow"
            >
              <Text className="font-medium capitalize text-white">Follow</Text>
            </Pressable>
          )}
        </View>
      </View>

      {user.bio ? (
        <Text className="py-4 text-sm" style={{ color: muted }}>
          {user.bio}
        </Text>
      ) : null}

      {isSameUser ? (
        <View
          style={tailwindClasses("mt-2 gap-2 border-t border-gray-700/30 pt-4")}
        >
          <Pressable
            onPress={() => router.push(app_routes.profile.signOut as never)}
            style={tailwindClasses(
              "flex-row items-center justify-between py-2",
            )}
          >
            <Text style={{ color: violet_400 }} className="text-sm font-medium">
              Sign out
            </Text>
            <Ionicons name="log-out-outline" size={20} color={violet_600} />
          </Pressable>
        </View>
      ) : null}

      <CoinTopUpModal visible={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </View>
  );
});

export default ProfileTop;
