import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import {
  ApiConnectService,
  getTokens,
} from "@/app_directories/services/ApiConnectService";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { FetchMethod } from "@/app_directories/types/types";
import { authDebug, authWarn } from "@/app_directories/utils/authDebugLog";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function Index() {
  useEffect(() => {
    let cancelled = false;

    async function routeUnauthenticated() {
      if (cancelled) return;
      router.replace(app_routes.auth.login);
    }

    async function bootstrapSession() {
      const { access_token, refresh_token } = await getTokens();
      if (cancelled) return;

      // No local credentials at all → straight to login, no protected UI
      // mounted, no stale `?token=...` media fetches.
      if (!access_token && !refresh_token) {
        await routeUnauthenticated();
        return;
      }

      // Validate the stored token against the server BEFORE we mount `(tabs)`.
      // On 401, `ApiConnectService` runs the shared refresh path; if the
      // refresh also fails it triggers `logout()` + `scheduleNavigateToLogin`,
      // so we never render protected screens with a stale token (and avoid
      // the fan-out of media `/file?token=...` 401s we saw previously).
      authDebug("index:session_probe_start");
      const res = await ApiConnectService<unknown>({
        url: api_routes.profile,
        method: FetchMethod.GET,
      });
      if (cancelled) return;

      if (res.error) {
        authWarn("index:session_probe_failed", {
          message: (res.error as { message?: string })?.message ?? "unknown",
        });
        // If the probe failed because the session is gone (ApiConnectService
        // already ran the refresh → logout path, which wiped credentials and
        // scheduled a login redirect), go to login and do NOT render tabs.
        // This is the case we care about: it stops the fan-out of media
        // `/file?token=<stale>` 401s that we'd otherwise see on home.
        const { access_token: after, refresh_token: afterRefresh } =
          await getTokens();
        if (cancelled) return;
        if (!after && !afterRefresh) {
          await routeUnauthenticated();
          return;
        }

        // Probe failed for a non-auth reason (offline, server 5xx). Tokens
        // are still present locally — fall through to home rather than force
        // a logout the user can't recover from without network.
        router.replace(app_routes.post.home);
        return;
      }

      authDebug("index:session_probe_ok");
      router.replace(app_routes.post.home);
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
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
