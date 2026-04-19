import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * IP/hostname the Metro bundler used when this device loaded the bundle (e.g. `192.168.1.5:8081`).
 * Use it so the same machine is reachable on port 3000 for bree-api / Socket.IO.
 */
function metroDevHostIp(): string | null {
  const dbg =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  if (typeof dbg !== "string" || !dbg.trim()) {
    return null;
  }
  const host = dbg.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return null;
  }
  return host;
}

/** In dev, swap loopback host for the LAN IP Metro used (so phones reach your Mac/PC). */
function rewriteLoopbackWithLanHost(url: string, lanIp: string | null): string {
  if (!lanIp || !__DEV__) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      u.hostname = lanIp;
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * Expo only inlines `EXPO_PUBLIC_*` into the JS bundle.
 * @see https://docs.expo.dev/guides/environment-variables/
 */
export function getExpoPublicApiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
  const lan = "192.168.1.248"; //  metroDevHostIp();

  if (raw) {
    const fixed = rewriteLoopbackWithLanHost(raw, lan);
    return fixed.replace(/\/$/, "");
  }

  if (__DEV__) {
    if (lan) {
      return `http://${lan}:3000/api`;
    }
    if (Platform.OS === "android") {
      return "http://192.168.1.248:3000/api";
    }
    return "http://192.168.1.248:3000/api";
  }

  console.error(
    "Missing EXPO_PUBLIC_API_BASE_URL. Set it in .env (include /api), e.g. http://192.168.1.10:3000/api",
  );
  return "";
}

export function getExpoPublicWsUrl(): string {
  const raw = process.env.EXPO_PUBLIC_WS_URL?.trim() ?? "";
  const lan = metroDevHostIp();

  if (raw) {
    return rewriteLoopbackWithLanHost(raw, lan).replace(/\/$/, "");
  }

  if (__DEV__) {
    if (lan) {
      return `http://${lan}:3000`;
    }
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000";
    }
    return "http://localhost:3000";
  }

  console.error(
    "Missing EXPO_PUBLIC_WS_URL. Set it in .env (Socket.IO origin), e.g. http://192.168.1.10:3000",
  );
  return "";
}
