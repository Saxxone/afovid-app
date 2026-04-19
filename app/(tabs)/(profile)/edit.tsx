import Text from "@/app_directories/components/app/Text";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { View } from "react-native";

export default function ProfileEditScreen() {
  return (
    <View style={tailwindClasses("flex-1 p-4")}>
      <Text className="text-base" style={{ color: "#9ca3af" }}>
        Profile editing will be available in a future update. This screen
        matches the web route for consistency.
      </Text>
    </View>
  );
}
