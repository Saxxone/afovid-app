import { app_routes } from "@/app_directories/constants/AppRoutes";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { jwtUserId } from "@/app_directories/utils/jwtPayload";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { violet_500 } from "@/app_directories/constants/Colors";

export default function ProfileTabIndex() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { access_token } = await getTokens();
      if (cancelled) return;
      const id = access_token ? jwtUserId(access_token) : null;
      setUserId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (userId === undefined) {
    return (
      <View style={tailwindClasses("flex-1 items-center justify-center")}>
        <ActivityIndicator color={violet_500} size="large" />
      </View>
    );
  }

  if (!userId) {
    return <Redirect href={app_routes.auth.login} />;
  }

  return <Redirect href={app_routes.profile.view(userId)} />;
}
