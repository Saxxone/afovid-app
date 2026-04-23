import Text from "@/app_directories/components/app/Text";
import { primary, white } from "@/app_directories/constants/Colors";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
} from "react-native";

type Props = {
  readonly busy: boolean;
  readonly onPress: () => void;
  /** i18n label, e.g. t("chat.generate_keys") */
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
};

const MIN_HEIGHT = 52;
const RADIUS = 12;

/**
 * Primary CTA for E2EE key generation — same visual language as the web
 * `EncryptionSetupCard` (indigo, icon + label, min height, shadow).
 */
export default function GenerateEncryptionKeysButton({
  busy,
  style,
  onPress,
  label,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        tailwindClasses(
          "w-full flex-row items-center justify-center gap-2.5 rounded-xl px-4",
        ),
        {
          minHeight: MIN_HEIGHT,
          borderRadius: RADIUS,
          backgroundColor: primary,
          opacity: busy ? 0.92 : pressed ? 0.9 : 1,
        },
        !isDark
          ? {
              shadowColor: "#4338ca", // indigo-700 — soft glow
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }
          : {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 3,
            },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={white} size="small" />
      ) : (
        <>
          <Ionicons name="key" size={20} color={white} />
          <Text
            className="text-base font-semibold"
            style={{ color: white, letterSpacing: 0.2 }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
