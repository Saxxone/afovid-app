import Text from "@/app_directories/components/app/Text";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Linking, Pressable, ScrollView } from "react-native";

const TOS_URL = "https://afovid.com/tos";

export default function TermsScreen() {
  return (
    <ScrollView style={tailwindClasses("flex-1 p-4")}>
      <Text className="text-xl font-bold mb-3">Terms of service</Text>
      <Text className="mb-4 text-gray-700 dark:text-gray-300">
        The latest terms are hosted on the website. Tap below to open them in
        your browser.
      </Text>
      <Pressable onPress={() => void Linking.openURL(TOS_URL)}>
        <Text style={tailwindClasses("text-indigo-600 underline")}>
          {TOS_URL}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
