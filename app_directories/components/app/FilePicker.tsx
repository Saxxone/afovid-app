import Text from "@/app_directories/components/app/Text";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { MediaType } from "expo-image-picker";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { ValidationRule, useValidation } from "../../hooks/useValidation";

interface Props {
  readonly onSelected: (data: {
    paths: string[];
    files: ImagePicker.ImagePickerAsset[];
    base64?: string;
  }) => void;
  readonly children?: React.ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly maxFiles?: number;
  readonly ratio?: [number, number];
  readonly validationRules?: ValidationRule[];
  readonly onValidationError?: (errors: Record<string, string> | null) => void;
  /** Defaults to images and videos. Use `["videos"]` for video-only compose. */
  readonly pickerMediaTypes?: MediaType[];
}

export default function FilePicker({ onSelected, ...props }: Props) {
  const { snackBar, setSnackBar } = useSnackBar();
  const [file, setFile] = useState<ImagePicker.ImagePickerAsset[]>();

  const pickImageAsync = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Permission to access gallery was denied",
      );
      return;
    }

    const mediaTypes = props.pickerMediaTypes ?? ["images", "videos"];

    const result = await ImagePicker.launchImageLibraryAsync({
      ...(props.maxFiles &&
        props.maxFiles > 1 && {
          allowsMultipleSelection: true,
        }),
      selectionLimit: props.maxFiles ?? 1,
      mediaTypes,
      ...(props.maxFiles === 1 && {
        allowsEditing: false,
      }),
      ...(props.ratio && {
        aspect: props.ratio,
      }),
      quality: 1,
    });

    if (!result.canceled) {
      onSelected({
        paths: result.assets.map((asset) => asset.uri),
        files: result.assets,
      });
      setFile(result.assets);
      validateInput();
    } else {
      setSnackBar({
        ...snackBar,
        visible: true,
        title: "Info",
        type: "info",
        message: "No file selected.",
      });
    }
  };

  const [isInputValid, setIsInputValid] = useState({});

  const { validate, errors, setErrors } = useValidation();

  const validateInput = useCallback(() => {
    if (!file) return;
    const new_errors = file.map((f) => {
      if (!props.validationRules) return;
      return validate(f.fileName as string, props.validationRules);
    });

    const aggregated_errors = new_errors.reduce(
      (acc, fileErrors, index) => {
        if (fileErrors && acc) {
          acc[`file-${index}`] = Object.values(fileErrors).join(", ");
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    if (aggregated_errors) setErrors(aggregated_errors);

    setIsInputValid(Object.keys(new_errors).length === 0);

    if (props.onValidationError && aggregated_errors) {
      props.onValidationError(
        Object.keys(aggregated_errors).length > 0 ? aggregated_errors : null,
      );
    }
  }, [file, props, validate, setErrors]);

  const classes = useMemo(
    () => tailwindClasses(props.className ?? ""),
    [props.className],
  );
  return (
    <>
      <Pressable onPress={pickImageAsync} style={[classes]}>
        {props.children ? (
          props.children
        ) : (
          <Ionicons
            name="images"
            size={16}
            style={[tailwindClasses("text-gray-400 p-2")]}
          />
        )}
      </Pressable>
      <View>
        {isInputValid
          ? Object.values(errors).map((error, index) => (
              <Text
                key={`${errors.name}-error-message`}
                style={tailwindClasses("my-1 text-red-400")}
              >
                {error}
              </Text>
            ))
          : null}
      </View>
    </>
  );
}
