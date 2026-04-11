import Button from "@/app_directories/components/form/Button";
import LongPostBuilder from "@/app_directories/components/post/LongPostBuilder";
import PostDisplay from "@/app_directories/components/post/PostDisplay";
import SelectPostType from "@/app_directories/components/post/SelectPostType";
import ShortPostBuilder from "@/app_directories/components/post/ShortPostBuilder";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { LongPostBlock, Post, PostType } from "@/app_directories/types/post";
import { FetchMethod } from "@/app_directories/types/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

export default function Compose() {
  const { id, is_comment } = useLocalSearchParams();
  const { snackBar, setSnackBar } = useSnackBar();
  const [post, setPost] = useState<Partial<Post>>({
    parentId: id as string,
    text: "",
    media: [],
    type: "SHORT",
  });
  const [isPosting, setIsPosting] = useState(false);
  const [postType, setPostType] = useState<PostType>("SHORT");
  const [postCreationType, setPostCreationType] = useState<"draft" | "publish">(
    "publish",
  );

  const [inputErrors, setInputErrors] = useState<Record<string, string> | null>(
    null,
  );

  const { isFetching: is_fetching_parent, data: parent_post } = useQuery({
    queryKey: ["post"],
    queryFn: async () => {
      return await ApiConnectService<Post>({
        url: id && api_routes.posts.getPostById(id as string),
        method: FetchMethod.GET,
      });
    },
    enabled: !!id,
    retry: false,
  });

  const {
    isFetching: is_creating_post,
    error: post_error,
    isError: is_post_error,
    refetch: createPost,
  } = useQuery({
    queryKey: ["new-post"],
    queryFn: async () => {
      return await ApiConnectService<Post>({
        url:
          postCreationType === "publish"
            ? api_routes.posts.create_post
            : api_routes.posts.create_draft,
        method: FetchMethod.POST,
        body: post,
      });
    },
    enabled: false,
    retry: false,
  });

  const handleValidationError = (errors: Record<string, string> | null) => {
    setInputErrors(errors);
  };

  function setLongPost(data: LongPostBlock[]) {
    setPost({ ...post, longPost: { content: data } });
  }

  function setShortPost(data: Partial<Post>) {
    setPost({ ...post, ...data });
  }

  function applyPostType(type: PostType) {
    setPostType(() => type);
    setPost({ ...post, type });
  }

  async function attemptCreatePost(type: "draft" | "publish") {
    const isShortPostEmpty =
      post.type === "SHORT" && !post.text && !post.media?.length;

    const isLongPostEmpty =
      post.type === "LONG" && !post?.longPost?.content?.length;

    if (isShortPostEmpty && isLongPostEmpty) {
      return;
    }

    setIsPosting(true);
    setPostCreationType(type);

    await createPost();

    if (is_post_error) {
      setSnackBar({
        ...snackBar,
        visible: true,
        message: post_error.message,
      });
    } else {
      if (is_comment) router.replace(app_routes.post.view(post.id));
      else router.replace(app_routes.post.home);
    }
    setIsPosting(false);
  }

  return (
    <ScrollView style={tailwindClasses("container")}>
      {useMemo(() => {
        return (
          is_comment &&
          parent_post?.data?.id && (
            <>
              <PostDisplay
                actions={false}
                ellipsis={true}
                post={parent_post?.data}
                isFetching={is_fetching_parent}
              />
              <Ionicons
                name="ellipsis-vertical"
                size={16}
                style={[tailwindClasses("text-gray-400 mb-4")]}
              />
            </>
          )
        );
      }, [is_comment, is_fetching_parent, parent_post?.data])}

      {!is_comment && (
        <SelectPostType type={postType} onSelected={applyPostType} />
      )}

      {postType === "SHORT" ? (
        <ShortPostBuilder
          post={post}
          setShortPost={setShortPost}
          is_comment={Number(is_comment)}
          onValidationError={handleValidationError}
        />
      ) : (
        <LongPostBuilder
          post={post.longPost}
          setLongPost={setLongPost}
          onValidationError={handleValidationError}
        />
      )}

      <View
        style={tailwindClasses(
          "mt-4 flex flex-row items-center space-4 justify-end",
        )}
      >
        {!is_comment && (
          <Button
            disabled={isPosting || is_creating_post || !!inputErrors}
            className="btn-primary-outline btn-md rounded-lg !px-8 text-white"
            onPress={() => attemptCreatePost("draft")}
          >
            {"Draft"}
          </Button>
        )}
        <Button
          disabled={isPosting || is_creating_post || !!inputErrors}
          className="btn-primary btn-md font-regular rounded-lg !px-8 text-white"
          onPress={() => attemptCreatePost("publish")}
        >
          {is_comment ? "Reply" : "Post"}
        </Button>
      </View>
    </ScrollView>
  );
}
