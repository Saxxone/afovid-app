import api_routes from "@/app_directories/constants/ApiRoutes";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { NotificationPermissionsStatus } from "expo-notifications";
import { Platform } from "react-native";
import { ApiConnectService, getTokens } from "./ApiConnectService";
import { FetchMethod } from "../types/types";
import { authDebug } from "../utils/authDebugLog";

function notificationsAllowed(
  settings: NotificationPermissionsStatus,
): boolean {
  const s = settings as NotificationPermissionsStatus & {
    granted?: boolean;
    status?: string;
  };
  if (s.granted) return true;
  if (s.status === "granted") return true;
  if (settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED)
    return true;
  if (settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL)
    return true;
  return false;
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId;
}

export async function registerPushAfterAuth(): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (!notificationsAllowed(existing)) {
      const req = await Notifications.requestPermissionsAsync();
      if (!notificationsAllowed(req)) return;
    }

    const projectId = easProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    const platform =
      Platform.OS === "ios"
        ? "ios"
        : Platform.OS === "android"
          ? "android"
          : "unknown";

    await ApiConnectService<unknown>({
      url: api_routes.notifications.pushToken,
      method: FetchMethod.POST,
      body: { token, platform },
    });
  } catch (e) {
    if (__DEV__) {
      console.warn(
        "[push] register failed (Android needs google-services.json + rebuild):",
        e,
      );
    }
  }
}

/**
 * Best-effort server-side unregister of the current Expo push token before the
 * local session is wiped.
 *
 * IMPORTANT: this is called from inside `logout()`, which itself may have been
 * triggered by a failed token refresh. We must NOT route through
 * `ApiConnectService` here, because that pipeline intercepts 401s and
 * re-enters the refresh/logout cycle — when the caller is already holding the
 * in-flight refresh promise, that creates a circular await and the app hangs.
 *
 * So we issue a raw `fetch` with the current access token and ignore failures.
 */
export async function unregisterPushBeforeLogout(): Promise<void> {
  if (!Device.isDevice) return;
  const { access_token } = await getTokens();
  if (!access_token) return;

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!notificationsAllowed(perm)) return;
    const projectId = easProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 3000)
      : null;
    try {
      const res = await fetch(api_routes.notifications.pushToken, {
        method: FetchMethod.DELETE,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ token }),
        signal: controller?.signal,
      });
      authDebug("push:unregister_before_logout", { status: res.status });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch {
    /* best-effort: network error, abort, or invalid token — ignore */
  }
}
