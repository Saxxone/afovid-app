import AppButton from "@/app_directories/components/form/Button";
import Text from "@/app_directories/components/app/Text";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { useSession } from "@/app_directories/context/AppContext";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import {
  ApiConnectService,
  saveTokens,
} from "@/app_directories/services/ApiConnectService";
import { registerPushAfterAuth } from "@/app_directories/services/pushRegistration";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import type { User } from "@/app_directories/types/user";
import { FetchMethod } from "@/app_directories/types/types";
import {
  authDebug,
  authLogUrlPath,
  authWarn,
} from "@/app_directories/utils/authDebugLog";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { memo, useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

type Mode = "signin" | "signup";

type Props = {
  readonly mode: Mode;
};

type AuthResponse = User & {
  access_token?: string;
  refresh_token?: string;
};

const GoogleAuthButtonInner = memo(function GoogleAuthButtonInner({
  mode,
  webClientId,
}: Props & { webClientId: string }) {
  const router = useRouter();
  const { signIn } = useSession();
  const { snackBar, setSnackBar } = useSnackBar();

  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;
  const androidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined;

  const redirectUri = useMemo(() => makeRedirectUri({ scheme: "myapp" }), []);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
    redirectUri,
  });

  useEffect(() => {
    async function handle() {
      if (response?.type === "error" || response?.type === "cancel") {
        authDebug("google:flow_finished", { type: response.type });
        return;
      }
      if (response?.type !== "success") return;
      const idToken = response.params?.id_token;
      if (!idToken || typeof idToken !== "string") {
        authWarn("google:missing_id_token", { hasParams: !!response.params });
        setSnackBar({
          ...snackBar,
          visible: true,
          title: "Google",
          type: "error",
          message: "No ID token from Google.",
        });
        return;
      }
      const url =
        mode === "signin" ? api_routes.google_login : api_routes.google_signup;
      authDebug("google:exchanging_id_token", {
        mode,
        path: authLogUrlPath(url),
      });
      const res = await ApiConnectService<AuthResponse>({
        url,
        method: FetchMethod.POST,
        body: { token: idToken },
      });
      if (res.error || !res.data?.access_token) {
        authWarn("google:backend_failed", {
          hasData: !!res.data,
          message: (res.error as { message?: string })?.message,
        });
        setSnackBar({
          ...snackBar,
          visible: true,
          title: "Google",
          type: "error",
          message:
            (res.error as { message?: string })?.message ??
            "Google sign-in failed.",
        });
        return;
      }
      const d = res.data;
      try {
        await saveTokens({
          access_token: d.access_token!,
          refresh_token: d.refresh_token ?? "",
        });
      } catch (e) {
        authWarn("google:post_token_failed", {
          name: e instanceof Error ? e.name : "Error",
          message: e instanceof Error ? e.message : String(e),
        });
        setSnackBar({
          ...snackBar,
          visible: true,
          title: "Google",
          type: "error",
          message: "Could not complete sign-in. Try again.",
        });
        return;
      }
      authDebug("google:success");
      signIn();
      void registerPushAfterAuth();
      router.replace("/(tabs)/(home)");
    }
    void handle();
  }, [response, mode, router, signIn, setSnackBar, snackBar]);

  return (
    <View style={tailwindClasses("w-full mt-3")}>
      <AppButton
        theme="primary"
        disabled={!request}
        onPress={() => void promptAsync()}
      >
        {!request ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={tailwindClasses("text-white")}>
            {mode === "signin" ? "Continue with Google" : "Sign up with Google"}
          </Text>
        )}
      </AppButton>
    </View>
  );
});

const GoogleAuthButton = memo(function GoogleAuthButton(props: Props) {
  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
  if (!webClientId) {
    return null;
  }
  return <GoogleAuthButtonInner {...props} webClientId={webClientId} />;
});

export default GoogleAuthButton;
