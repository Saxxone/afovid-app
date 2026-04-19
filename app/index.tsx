import { app_routes } from "@/app_directories/constants/AppRoutes";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function Index() {
  useEffect(() => {
    async function getAuthStatus() {
      const { access_token } = await getTokens();
      if (access_token) {
        router.replace(app_routes.post.home);
      } else {
        router.replace(app_routes.auth.login);
      }
    }
    getAuthStatus();
  }, []);

  return (
    <View
      style={tailwindClasses(
        "container flex h-full justify-center items-center",
      )}
    >
      <Image
        source={require("@/app_directories/assets/images/afovid.png")}
        contentFit="cover"
        style={[tailwindClasses("rounded-lg h-20 w-20 object-cover")]}
      />
    </View>
  );
}
