import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { clearCoinUnlockResume } from "@/app_directories/utils/coinCheckoutResume";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function CoinCheckoutCancelScreen() {
  const router = useRouter();

  useEffect(() => {
    void clearCoinUnlockResume();
  }, []);

  return (
    <View
      style={tailwindClasses("flex-1 px-4 py-12 items-center justify-center")}
    >
      <Text className="text-lg font-medium text-center">Checkout canceled</Text>
      <AppButton
        theme="primary"
        onPress={() => router.replace(app_routes.post.home)}
      >
        Back to home
      </AppButton>
    </View>
  );
}
