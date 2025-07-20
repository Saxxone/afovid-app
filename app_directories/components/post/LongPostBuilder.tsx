import api_routes from "@/app_directories/constants/ApiRoutes";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Ionicons } from "@expo/vector-icons";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useMutation } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { memo, useCallback, useState } from "react";
import { View } from "react-native";
import { ValidationRule } from "../../hooks/useValidation";
import { LongPost, LongPostBlock } from "../../types/post";
import FilePicker from "../app/FilePicker";
import PagerView from "../app/PagerView";
import PagerViewIndicator from "../app/PagerViewIndicator";
import Text from "../app/Text";
import Button from "../form/Button";
import FormInput from "../form/FormInput";
import FilePreview from "./FilePreview";

interface Props {
  readonly post: Partial<LongPost> | null | undefined;
  readonly setLongPost: (data: LongPostBlock[]) => void;
  readonly onValidationError: (errors: Record<string, string> | null) => void;
}

const LongPostBuilder = memo(({ ...props }: Props) => {
  const { snackBar, setSnackBar } = useSnackBar();
  const [placeholderFiles, setPlaceholderFiles] = useState<
    ImagePicker.ImagePickerAsset[][]
  >([]);

  const [contents, setContents] = useState<LongPostBlock[]>([
    {
      text: "",
      media: [],
    },
  ]);

  function setPostText(v: string, index: number) {
    const new_contents = [...contents];
    new_contents[index].text = v;
    setContents(new_contents);
    props.setLongPost(new_contents);
  }

  function removePage() {
    const new_contents = [...contents];
    new_contents.splice(currentPage, 1);
    setContents(new_contents);
    const newFiles = [...placeholderFiles];
    newFiles.splice(currentPage, 1);
    setPlaceholderFiles(newFiles);
    props.setLongPost(new_contents);
  }

  const removeFile = useCallback((contentIndex: number, fileIndex: number) => {
    setPlaceholderFiles((prevFiles) => {
      const newFiles = [...prevFiles];
      if (newFiles[contentIndex]) {
        newFiles[contentIndex].splice(fileIndex, 1);
      }
      return newFiles;
    });
    // ALSO remove the corresponding media URI from contents state:
    setContents((prevContents) => {
      const newContents = [...prevContents];
      if (newContents[contentIndex]) {
        newContents[contentIndex].media?.splice(fileIndex, 1);
      }
      return newContents;
    });
  }, []);

  const handleValidationError = (errors: Record<string, string> | null) => {
    props.onValidationError(errors);
  };

  const validation_rules: Record<string, ValidationRule[]> = {
    media: [{ type: "required", message: "Media file is required" }],
    text: [
      { type: "required", message: "Post text is required." },
      {
        type: "max",
        value: 300,
        message: "Post text must not exceeed 300 characters.",
      },
    ],
  };

  const [currentPage, setCurrentPage] = useState(0);

  function addPage() {
    if (contents.length < 7) {
      setContents([...contents, { text: "", media: [] }]);
    }
  }

  function setPostMedia(
    data: { paths: string[]; files: ImagePicker.ImagePickerAsset[] },
    index: number,
  ) {
    if (data.files.length > 0) {
      placeholderFiles[index] = data.files;
      setPlaceholderFiles([...placeholderFiles]);

      uploadMutation.mutate(data.files, {
        onSuccess: (upload_ids) => {
          setContents((prevContents) => {
            const newContents = [...prevContents];
            newContents[index].media = upload_ids as string[];
            return newContents;
          });
        },
        onError: (error) => {
          console.error("File upload failed:", error);
          setSnackBar({
            ...snackBar,
            visible: true,
            title: "Error",
            type: "error",
            message: "Failed to upload",
          });
        },
      });
    }
  }

  const uploadMutation = useMutation({
    mutationFn: async (files: ImagePicker.ImagePickerAsset[]) => {
      const { access_token } = await getTokens();

      try {
        const uploadPromises = files.map(async (file) => {
          const task = new FileSystem.UploadTask(
            api_routes.files.upload,
            file.uri,
            {
              headers: {
                Authorization: "Bearer " + access_token,
              },
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: "app_files",
            },
          );

          const result = await task.uploadAsync();

          if (result?.status !== 201) {
            throw new Error(
              `Upload failed with status ${result?.status}: ${result?.body}`,
            );
          }

          return JSON.parse(result.body);
        });

        const results = await Promise.all(uploadPromises);
        const upload_ids = results.flat();

        return upload_ids;
      } catch (error: any) {
        throw new Error(error);
      }
    },
    onError: (
      error,
      _,
      context: { contentIndex: number; fileIndex: number } | undefined,
    ) => {
      console.error("Mutation error:", error);
      setSnackBar({
        visible: true,
        title: "Error",
        message: error?.message || "Failed to upload",
        type: "error",
      });
      console.log(context);
      if (
        context?.contentIndex !== undefined &&
        context?.fileIndex !== undefined
      ) {
        removeFile(context.contentIndex, context.fileIndex);
      }
    },
  });

  return (
    <>
      <View
        style={tailwindClasses("flex flex-row justify-between items-center")}
      >
        <View style={tailwindClasses("h-7 w-7")}>
          {contents.length > 1 ? (
            <Button
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 px-0 py-0"
              onPress={removePage}
              disabled={contents.length === 1}
            >
              <Ionicons
                name="close-outline"
                size={20}
                style={tailwindClasses("text-gray-300")}
              />
            </Button>
          ) : null}
        </View>

        <View
          style={tailwindClasses(
            "text-main bg-base-white flex mx-auto h-8 w-8 items-center justify-center rounded-full",
          )}
        >
          <Text className="text-sm">{currentPage + 1}</Text>
        </View>

        <View style={tailwindClasses("w-6 mr-2")}>
          {contents.length < 7 ? (
            <AntDesign
              name="plussquare"
              size={24}
              style={tailwindClasses("text-blue-300 ")}
              onPress={addPage}
            />
          ) : null}
        </View>
      </View>

      <PagerView
        initialPage={0}
        onPageScroll={(e) => setCurrentPage(e)}
        spacing={32}
      >
        {contents.map((content, index) => {
          return (
            <View
              style={[tailwindClasses("rounded-md")]}
              key={"content-" + index + "-long-post"}
            >
              <View style={tailwindClasses("h-6")}>
                {contents.length > 1 ? (
                  <PagerViewIndicator
                    currentPage={currentPage}
                    length={contents.length}
                    className="mb-4"
                  />
                ) : null}
              </View>
              <FilePicker
                onSelected={(media) => setPostMedia(media, index)}
                maxFiles={1}
                ratio={[5, 3]}
                validationRules={validation_rules.media}
                onValidationError={handleValidationError}
                className="text-main mb-4 flex h-56 flex-row items-center justify-center rounded-lg border border-gray-600 text-center"
              >
                {placeholderFiles[index] ? (
                  <FilePreview
                    removable={false}
                    files={placeholderFiles[index]}
                    fullScreen={true}
                  />
                ) : (
                  <View style={[tailwindClasses("p-3 mb-3 ")]}>
                    <Text className="text-center text-gray-500">
                      Select File to Upload
                    </Text>
                  </View>
                )}
              </FilePicker>

              <FormInput
                placeholder={"What's on your mind?"}
                value={content.text}
                validationType="eager"
                validationRules={validation_rules.text}
                autoComplete="username"
                keyboardType="email-address"
                inputMode="text"
                textAlignVertical="top"
                onChangeText={(text) => setPostText(text, index)}
                multiline={true}
                numberOfLines={7}
                onValidationError={handleValidationError}
              />
              <Text className="text-right text-sm text-gray-400">
                {props.post?.content?.[index]?.text?.length ?? 0}/300
              </Text>
            </View>
          );
        })}
      </PagerView>
    </>
  );
});

export default LongPostBuilder;
