import Text from "@/app_directories/components/app/Text";
import { DarkStyle, LightStyle } from "@/app_directories/constants/Theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useCallback, useMemo, useState } from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";
import { gray_900, white } from "../../constants/Colors";
import { useValidation, ValidationRule } from "../../hooks/useValidation";
import tailwindClasses from "@/app_directories/services/ClassTransformer";

type IconNames =
  | "lock-closed-outline"
  | "person-outline"
  | "eye-outline"
  | "eye-off-outline";

interface Props extends Omit<TextInputProps, "style"> {
  readonly value: string;
  readonly label?: string;
  readonly placeholder: string;
  readonly secureTextEntry?: boolean;
  readonly prependIcon?: IconNames;
  readonly appendIcon?: IconNames;
  readonly validationRules?: ValidationRule[];
  readonly autoComplete?: "email" | "password" | "username";
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly inputStyle?: StyleProp<TextStyle>;
  readonly onChangeText: (text: string) => void;
  readonly onPrependPressed?: (event: GestureResponderEvent) => void;
  readonly onAppendPressed?: (event: GestureResponderEvent) => void;
  readonly onValidationError?: (errors: Record<string, string> | null) => void;
  readonly validationType?: "lazy" | "eager" | "none";
}

const FormInput = memo(
  ({
    label,
    value,
    placeholder,
    secureTextEntry,
    prependIcon,
    appendIcon,
    style,
    inputStyle,
    autoComplete,
    validationRules,
    validationType,
    onPrependPressed,
    onAppendPressed,
    onChangeText,
    onValidationError,
    className,
    ...props
  }: Props) => {
    const color_scheme = useColorScheme();

    const classes = useMemo(
      () => tailwindClasses(className ?? ""),
      [className],
    );

    const text_color = useMemo(
      () =>
        color_scheme === "dark" ? DarkStyle.textColor : LightStyle.textColor,
      [color_scheme],
    );

    const muted_text_color = useMemo(
      () =>
        color_scheme === "dark"
          ? DarkStyle.mutedTextColor.color
          : LightStyle.mutedTextColor.color,
      [color_scheme],
    );

    const background_color = useMemo(
      () => (color_scheme === "dark" ? gray_900 : white),
      [color_scheme],
    );

    const [isInputValid, setIsInputValid] = useState({});

    const { validate, errors, setErrors } = useValidation();

    const validateInput = useCallback(() => {
      if (!validationRules) return;

      const new_errors = validate(value, validationRules);

      setErrors(new_errors);

      setIsInputValid(Object.keys(new_errors).length === 0);

      if (onValidationError) {
        onValidationError(
          Object.keys(new_errors).length > 0 ? new_errors : null,
        );
      }
    }, [value, validationRules, onValidationError, validate, setErrors]);

    // if (validationType && validationType === "eager") validateInput();

    const memoPrependIcon = useMemo(() => {
      if (!prependIcon) return null;

      return (
        <Pressable
          onPress={onPrependPressed}
          style={tailwindClasses("m-0 px-0.5")}
        >
          <Ionicons name={prependIcon} size={18} color={text_color.color} />
        </Pressable>
      );
    }, [prependIcon, text_color, onPrependPressed]);

    const memoAppendIcon = useMemo(() => {
      if (!appendIcon) return null;

      return (
        <Pressable
          onPress={onAppendPressed}
          style={tailwindClasses("m-0 px-0.5")}
        >
          <Ionicons name={appendIcon} size={18} color={text_color.color} />
        </Pressable>
      );
    }, [appendIcon, text_color, onAppendPressed]);

    return (
      <View style={[tailwindClasses("mb-4"), classes, style]}>
        {label ? <Text>{label}</Text> : null}

        <View
          style={[
            tailwindClasses(
              "px-3 border border-transparent rounded-lg w-full flex flex-row items-center flex-wrap items-center gap-x-2",
            ),
            isInputValid ? null : tailwindClasses("border-rose-500 border"),
            { backgroundColor: background_color },
          ]}
        >
          {prependIcon ? memoPrependIcon : null}
          <TextInput
            placeholder={placeholder}
            style={[
              tailwindClasses("flex-1 font-light border-transparent"),
              props.multiline
                ? tailwindClasses("min-h-[88px] py-3 px-1")
                : tailwindClasses("h-14 px-1"),
              text_color,
              { backgroundColor: background_color },
            ]}
            value={value}
            placeholderTextColor={muted_text_color}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            autoCapitalize="none"
            autoCorrect={props.autoCorrect}
            numberOfLines={props.multiline ? 6 : 1}
            onBlur={validateInput}
            {...props}
          />
          {appendIcon ? memoAppendIcon : null}
        </View>
        <View>
          {Object.values(errors).map((error) => (
            <Text
              key={`${errors.name}-error-message`}
              style={tailwindClasses("my-1 text-red-400")}
            >
              {error}
            </Text>
          ))}
        </View>
      </View>
    );
  },
);

FormInput.displayName = "FormInput";

export default FormInput;
