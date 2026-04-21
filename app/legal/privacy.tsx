import Text from "@/app_directories/components/app/Text";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Linking, Pressable, ScrollView } from "react-native";

const PRIVACY_URL = "https://afovid.com/privacy";

export default function PrivacyScreen() {
  return (
    <ScrollView style={tailwindClasses("flex-1 p-4")}>
      <Text className="text-xl font-bold mb-3">Privacy</Text>
      <Text className="mb-4 text-gray-700 dark:text-gray-300">
        Our full privacy policy is published on the website. Tap below to open
        it in your browser.
      </Text>
      <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
        <Text style={tailwindClasses("text-indigo-600 underline")}>
          {PRIVACY_URL}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
