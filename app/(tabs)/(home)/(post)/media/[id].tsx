import Text from "@/app_directories/components/app/Text";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Post } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const { snackBar, setSnackBar } = useSnackBar();

  const {
    isFetching: is_fetching_post,
    isError: is_post_error,
    error: post_error,
    data: post,
  } = useQuery({
    queryKey: ["post"],
    queryFn: async () => {
      return await ApiConnectService<Post>({
        url: api_routes.posts.getPostById(id as string),
        method: FetchMethod.GET,
      });
    },
    enabled: true,
    retry: false,
  });

  const Post = useMemo(() => {
    if (is_post_error) {
      setSnackBar({
        ...snackBar,
        visible: true,
        title: t("common.error"),
        type: "error",
        message: post_error.message,
      });
    } else {
      return is_post_error ? (
        <View style={[tailwindClasses("p-3 mb-3 ")]}>
          <Text>{t("posts.display_error")}</Text>
        </View>
      ) : (
        <View style={tailwindClasses("container")}>
          <PostDisplay
            key={post?.data?.id}
            ellipsis={false}
            actions={true}
            isFetching={is_fetching_post}
            post={post?.data}
            recordWatchForPost
          />
        </View>
      );
    }
  }, [
    is_fetching_post,
    is_post_error,
    post,
    post_error,
    setSnackBar,
    snackBar,
    t,
  ]);

  return <ScrollView>{Post}</ScrollView>;
}
