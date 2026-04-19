import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { memo, useMemo, useState } from "react";
import { Alert, Pressable, Share, useColorScheme, View } from "react-native";

type Props = {
  readonly post: Post;
  readonly className?: string;
};
type IconName =
  | "heart-outline"
  | "arrow-undo-outline"
  | "share-social-outline"
  | "bookmark-outline"
  | "heart"
  | "bookmark";

interface Action {
  icon: IconName;
  key?: keyof Post;
  active: boolean;
  route?: "like" | "bookmark";
  command: () => void | Promise<void>;
}

const PostActions = memo(({ post, className }: Props) => {
  const classes = useMemo(() => tailwindClasses(className ?? ""), [className]);
  const color_scheme = useColorScheme();
  const color = color_scheme === "dark" ? "text-gray-300" : "text-gray-500";

  const [action, setAction] = useState<Partial<Action> | null>(null);
  const [state, setState] = useState<Partial<Post>>({
    likedByMe: post.likedByMe,
    bookmarkedByMe: post.bookmarkedByMe,
    commentCount: post.commentCount,
    likeCount: post.likeCount,
    bookmarkCount: post.bookmarkCount,
  });

  const {
    isFetching: in_progress,
    data: action_data,
    error: action_error,
    isError: is_action_error,
    refetch: postAction,
  } = useQuery({
    queryKey: [action?.key],
    queryFn: async () => {
      return await ApiConnectService<Post>({
        url: api_routes.posts[action?.route ?? "like"](post.id),
        method: FetchMethod.PUT,
        body: post,
      });
    },
    enabled: false,
    retry: false,
  });

  async function likePost() {
    setAction({
      key: "likeCount",
      route: "like",
    });
    const response = await postAction();
    setState((prev_state) => {
      return {
        ...prev_state,
        likedByMe: response.data?.data?.likedByMe ?? prev_state.likedByMe,
        likeCount: response.data?.data?.likeCount ?? prev_state.likeCount,
      };
    });
  }

  function comment() {
    router.push({
      pathname: app_routes.post.compose,
      params: { id: post.id, is_comment: 1 },
    });
  }

  async function sharePost() {
    try {
      const result = await Share.share({
        message: `See this post on afovid: ${api_routes.posts.getPostById(post.id)}`,
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log(result.activityType);
        } else {
          console.log(result);
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
        console.log(result);
      }
    } catch (error: any) {
      Alert.alert(error.message);
    }
  }

  async function bookmarkPost() {
    setAction({
      key: "bookmarkCount",
      route: "bookmark",
    });
    const response = await postAction();
    setState((prev_state) => {
      return {
        ...prev_state,
        bookmarkedByMe:
          response.data?.data?.bookmarkedByMe ?? prev_state.bookmarkedByMe,
        bookmarkCount:
          response.data?.data?.bookmarkCount ?? prev_state.bookmarkCount,
      };
    });
  }

  const actions = useMemo<Action[]>(
    () => [
      {
        icon: "heart-outline",
        key: "likeCount",
        active: state.likedByMe ?? false,
        command: likePost,
      },
      {
        icon: "arrow-undo-outline",
        key: "commentCount",
        active: false,
        command: comment,
      },
      {
        icon: "share-social-outline",
        active: false,
        command: sharePost,
      },
      {
        icon: "bookmark-outline",
        key: "bookmarkCount",
        active: state.bookmarkedByMe ?? false,
        command: bookmarkPost,
      },
    ],
    [post, state],
  );
  return (
    <View
      style={[
        tailwindClasses("flex flex-row w-full items-center mt-2"),
        classes,
      ]}
    >
      {actions.map((action, index) => {
        let iconColorStyle;
        if (action.active && action.key === "likeCount") {
          iconColorStyle = tailwindClasses("text-red-500");
        } else if (action.active && action.key !== "likeCount") {
          iconColorStyle = tailwindClasses("text-purple-500");
        } else {
          iconColorStyle = tailwindClasses(color);
        }

        let icon: IconName;
        if (action.active && action.key === "likeCount") icon = "heart";
        else if (action.active && action.key !== "likeCount") icon = "bookmark";
        else icon = action.icon;

        return (
          <Pressable
            key={action.icon + action.key + post.id}
            onPress={(e) => {
              e.stopPropagation();
              action.command();
            }}
            style={[
              tailwindClasses("p-2 flex flex-row items-center cursor-pointer"),
              index === 2
                ? tailwindClasses("ml-auto mr-1")
                : tailwindClasses("mr-1"),
            ]}
          >
            <Ionicons name={icon} size={16} style={[iconColorStyle]} />
            {action?.key && state[action.key] ? (
              <Text style={tailwindClasses("ml-1 text-sm font-light")}>
                {String(state[action.key])}{" "}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
});

export default PostActions;
