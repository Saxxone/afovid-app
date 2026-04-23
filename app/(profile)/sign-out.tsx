import Text from "@/app_directories/components/app/Text";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { logout } from "@/app_directories/services/ApiConnectService";
import { authWarn } from "@/app_directories/utils/authDebugLog";
import { View } from "react-native";

export default function Index() {
  async function handleSignOut() {
    try {
      // Full sign-out: clears Keychain tokens, SecureStore session, React Query
      // cache, Olm device, push token, then navigates to login. The context
      // listener registered in SessionProvider clears the in-memory session.
      await logout();
    } catch (e) {
      authWarn("signout:failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <View style={tailwindClasses("container")}>
      <Text onPress={handleSignOut}>Sign Out</Text>
    </View>
  );
}
