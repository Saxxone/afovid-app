import Text from "@/app_directories/components/app/Text";
import GenerateEncryptionKeysButton from "@/app_directories/components/messages/GenerateEncryptionKeysButton";
import {
  gray_50,
  gray_700,
  gray_800,
  gray_900,
  primary,
  white,
} from "@/app_directories/constants/Colors";
import { useI18n } from "@/app_directories/context/I18nProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, useColorScheme, View } from "react-native";

type Props = {
  readonly busy: boolean;
  readonly onRegister: () => void;
};

/**
 * Minimal setup card shown when the current device is not yet registered for
 * Olm E2EE. A tap on the action calls the Olm client's `registerDevice`, then
 * POSTs the public bundle to `/device`.
 */
export default function EncryptionSetupPanel({ busy, onRegister }: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const card = isDark
    ? {
        bg: gray_800,
        border: "#4b5563",
        title: gray_50,
        hint: "#cbd5e1",
        shieldWell: "rgba(129, 140, 248, 0.22)",
        shieldIcon: "#a5b4fc",
      }
    : {
        bg: white,
        border: "#d1d5db",
        title: gray_900,
        hint: gray_700,
        shieldWell: "#eef2ff",
        shieldIcon: primary,
      };

  return (
    <ScrollView
      style={tailwindClasses("flex-1 w-full")}
      contentContainerStyle={tailwindClasses(
        "flex-grow justify-center py-2 pb-6",
      )}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: card.bg,
          borderColor: card.border,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 24,
          ...(!isDark
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
                elevation: 3,
              }
            : { elevation: 0 }),
        }}
      >
        <View style={tailwindClasses("items-center mb-5")}>
          <View
            style={[
              tailwindClasses("items-center justify-center rounded-full mb-4"),
              {
                width: 72,
                height: 72,
                backgroundColor: card.shieldWell,
              },
            ]}
            accessibilityLabel={t("security.setup_title")}
          >
            <Ionicons
              name="shield-checkmark"
              size={36}
              color={card.shieldIcon}
            />
          </View>
          <Text
            className="text-xl font-bold text-center"
            style={{
              color: card.title,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}
          >
            {t("security.setup_title")}
          </Text>
          <Text
            className="text-center text-base leading-6"
            style={{ color: card.hint, paddingHorizontal: 2 }}
          >
            {t("security.setup_hint")}
          </Text>
        </View>

        <GenerateEncryptionKeysButton
          busy={busy}
          style={tailwindClasses("mt-4")}
          onPress={onRegister}
          label={t("security.register_device")}
        />
      </View>
    </ScrollView>
  );
}
