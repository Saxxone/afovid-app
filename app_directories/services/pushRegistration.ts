import api_routes from "@/app_directories/constants/ApiRoutes";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { NotificationPermissionsStatus } from "expo-notifications";
import { Platform } from "react-native";
import { ApiConnectService, getTokens } from "./ApiConnectService";
import { FetchMethod } from "../types/types";

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
}

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
    await ApiConnectService<unknown>({
      url: api_routes.notifications.pushToken,
      method: FetchMethod.DELETE,
      body: { token },
    });
  } catch {
    /* best-effort */
  }
}
