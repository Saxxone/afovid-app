import { useSession } from "@/app_directories/context/AppContext";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import {
  isProtectedRouteWithoutAuth,
  scheduleNavigateToLogin,
} from "@/app_directories/services/authNavigation";
import { useSegments } from "expo-router";
import { useEffect } from "react";

/**
 * If both session context and keychain are cleared but the user is still on a
 * protected screen (e.g. `router.replace` after logout failed), send them to login.
 * Skips when any token is still present to avoid false redirects on storage desync.
 */
export default function SessionUnauthenticatedGuard() {
  const { session, isLoading } = useSession();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    if (session) return;
    if (!isProtectedRouteWithoutAuth(segments as string[])) return;

    let cancelled = false;
    void (async () => {
      const { access_token, refresh_token } = await getTokens();
      if (cancelled) return;
      if (access_token || refresh_token) return;
      scheduleNavigateToLogin();
    })();

    return () => {
      cancelled = true;
    };
  }, [session, isLoading, segments]);

  return null;
}
