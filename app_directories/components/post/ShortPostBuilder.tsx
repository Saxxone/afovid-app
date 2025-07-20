import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import { useMutation } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { memo, useState } from "react";
import { ValidationRule } from "../../hooks/useValidation";
import { Post } from "../../types/post";
import FilePicker from "../app/FilePicker";
import FormInput from "../form/FormInput";
import FilePreview from "./FilePreview";

interface Props {
  post: Partial<Post>;
  is_comment: number;
  setShortPost: (post: Partial<Post>) => void;
  readonly onValidationError: (errors: Record<string, string> | null) => void;
}

const ShortPostBuilder = memo(({ ...props }: Props) => {
  const [placeholderFiles, setPlaceholderFiles] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const { snackBar, setSnackBar } = useSnackBar();
  const [shortPost, setShortPost] = useState<Partial<Post>>({});

  function removeFile(index: number) {
    const newFiles = [...placeholderFiles];
    newFiles.splice(index, 1);
    setPlaceholderFiles(newFiles);
  }

  function setPostText(text: string) {
    setShortPost((prev_post) => {
      const new_post = prev_post;
      new_post.text = text;
      return new_post;
    });
    props.setShortPost(shortPost);
  }

  function setPostMedia(data: {
    paths: string[];
    files: ImagePicker.ImagePickerAsset[];
  }) {
    if (data.files.length > 0) {
      setPlaceholderFiles([...data.files]);

      uploadMutation.mutate(data.files, {
        onSuccess: (upload_ids) => {
          console.log(upload_ids);

          setShortPost((prev_post) => {
            const new_post = prev_post;
            new_post.media = upload_ids as string[];
            return new_post;
          });
          props.setShortPost(shortPost);
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
        files.forEach((_, index) => {
          removeFile(index);
        });

        setSnackBar({
          visible: true,
          title: "Error",
          message: error?.message || "Failed to upload",
          type: "error",
        });
        throw error;
      }
    },
  });

  const handleValidationError = (errors: Record<string, string> | null) => {
    props.onValidationError(errors);
  };

  //TODO make validation for one of two values to be present, i.e either media or text is required
  const validation_rules: Record<string, ValidationRule[]> = {
    media: [{ type: "required", message: "Media file is required" }],
    text: [
      { type: "required", message: "Post text is required." },
      {
        type: "max",
        value: 300,
        message: "Content must not exceeed 300 characters.",
      },
    ],
  };
  return (
    <>
      <FilePreview
        placeholder={placeholderFiles}
        removable={true}
        files={placeholderFiles}
        removeFile={(index) => removeFile(index)}
      />
      <FormInput
        placeholder={
          props.is_comment ? "Reply to this post" : "What's on your mind?"
        }
        value={props.post.text as string}
        validationType="eager"
        validationRules={validation_rules.text}
        autoComplete="username"
        keyboardType="email-address"
        inputMode="text"
        textAlignVertical="top"
        onChangeText={setPostText}
        multiline={true}
        numberOfLines={7}
        onValidationError={handleValidationError}
      />
      <Text className="text-right text-sm text-gray-400">
        {props.post.text?.length ?? 0}/300
      </Text>
      <FilePicker onSelected={setPostMedia} maxFiles={4} ratio={[5, 3]} />
    </>
  );
});

export default ShortPostBuilder;
