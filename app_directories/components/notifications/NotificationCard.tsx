import Text from "@/app_directories/components/app/Text";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import type { Notification } from "@/app_directories/types/notification";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useMemo } from "react";
import {
  Image,
  Pressable,
  useColorScheme,
  View,
  type ViewStyle,
} from "react-native";
import { useI18n } from "@/app_directories/context/I18nProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import {
  gray_100,
  gray_200,
  gray_300,
  gray_400,
  gray_500,
  gray_600,
  gray_700,
  gray_800,
  gray_900,
  violet_400,
  violet_600,
  white,
} from "@/app_directories/constants/Colors";

const AVATAR = 40;

type Props = {
  item: Notification;
  onOpenPost: (item: Notification) => void;
  onDelete: (id: string) => void;
  deletePending: boolean;
};

function targetPostId(n: Notification): string | null {
  const c = n.commentId;
  const p = n.postId;
  if (c) return c;
  if (p) return p;
  return null;
}

const NotificationCard = memo(
  ({ item, onOpenPost, onDelete, deletePending }: Props) => {
    const { t } = useI18n();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const unread = item.read !== true;

    const canOpenPost = useMemo(() => Boolean(targetPostId(item)), [item]);
    const author = item.author;

    const cardBg = isDark ? gray_900 : white;
    const cardBorder = isDark ? gray_700 : gray_200;
    const placeholderBg = isDark ? gray_800 : gray_100;
    const nameColor = isDark ? white : gray_900;
    const iconMuted = isDark ? gray_400 : gray_500;
    const descriptionClass = unread
      ? "font-semibold text-gray-900 dark:text-gray-100"
      : "text-gray-800 dark:text-gray-200";

    const openPost = useCallback(() => {
      onOpenPost(item);
    }, [item, onOpenPost]);

    const openAuthor = useCallback(() => {
      if (author?.id) {
        router.push(app_routes.profile.view(author.id));
      }
    }, [author?.id, router]);

    const cardStyle: ViewStyle = {
      marginBottom: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cardBorder,
      backgroundColor: cardBg,
      padding: 16,
    };

    if (unread) {
      cardStyle.borderLeftWidth = 3;
      cardStyle.borderLeftColor = violet_600;
      cardStyle.paddingLeft = 13;
    }

    return (
      <View style={cardStyle}>
        <View style={tailwindClasses("flex-row items-start")}>
          <Pressable
            accessibilityRole={author?.id ? "button" : undefined}
            disabled={!author?.id}
            onPress={openAuthor}
            style={tailwindClasses("flex-1 flex-row items-start min-w-0")}
          >
            {author?.img ? (
              <Image
                source={{ uri: author.img as string }}
                style={tailwindClasses("avatar shrink-0")}
                accessibilityLabel={author.name}
              />
            ) : (
              <View
                style={{
                  width: AVATAR,
                  height: AVATAR,
                  borderRadius: AVATAR / 2,
                  backgroundColor: placeholderBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="notifications"
                  size={22}
                  color={isDark ? gray_300 : gray_600}
                />
              </View>
            )}
            {author ? (
              <View
                style={tailwindClasses(
                  "ml-3 flex-1 min-w-0 flex-row flex-wrap items-center gap-1",
                )}
              >
                <Text
                  className="text-base font-medium"
                  numberOfLines={1}
                  style={{ color: nameColor }}
                >
                  {author.name}
                </Text>
                {author.verified ? (
                  <MaterialIcons
                    name="verified"
                    size={16}
                    color={violet_400}
                    style={tailwindClasses("mt-0.5")}
                  />
                ) : null}
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => onDelete(item.id)}
            hitSlop={12}
            disabled={deletePending}
            accessibilityLabel={t("notifications.delete")}
            style={tailwindClasses("ml-2 shrink-0 p-1")}
          >
            <Ionicons name="trash-outline" size={22} color={iconMuted} />
          </Pressable>
        </View>

        {canOpenPost ? (
          <Pressable onPress={openPost} style={tailwindClasses("mt-2")}>
            <Text className={descriptionClass} numberOfLines={6}>
              {item.description}
            </Text>
            <Text
              className="text-sm font-medium mt-1"
              style={{ color: violet_600 }}
            >
              {t("notifications.open_post")}
            </Text>
          </Pressable>
        ) : (
          <View style={tailwindClasses("mt-2")}>
            <Text className={descriptionClass} numberOfLines={6}>
              {item.description}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

export { targetPostId };
export default NotificationCard;
