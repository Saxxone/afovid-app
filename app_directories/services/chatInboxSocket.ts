import { io, type Socket } from "socket.io-client";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { getTokens } from "@/app_directories/services/ApiConnectService";
import { getStoredDeviceId } from "@/app_directories/crypto/olm/deviceApi";

let shared: Socket | null = null;

/**
 * Single Socket.IO client shared by the inbox listener and the room screen.
 * The Nest gateway disconnects any socket whose handshake does not carry a
 * token, so handshake `auth.token` must be populated before `connect()`.
 */
export function getChatInboxSocket(): Socket {
  if (!shared) {
    shared = io(api_routes.chats.base, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return shared;
}

/**
 * Pull the latest access token from Keychain and update the socket handshake
 * so subsequent (re)connects use a fresh token. Call this right before
 * `socket.connect()` and again when a token rotation is known to have
 * happened.
 */
export async function refreshChatSocketAuth(): Promise<string | null> {
  const s = getChatInboxSocket();
  try {
    const { access_token } = await getTokens();
    const deviceId = await getStoredDeviceId();
    const auth: Record<string, string> = {};
    if (access_token) auth.token = access_token;
    if (deviceId) auth.deviceId = deviceId;
    s.auth = auth;
    return access_token ?? null;
  } catch {
    s.auth = {};
    return null;
  }
}

/**
 * Reset the shared socket on sign-out so a new session starts from a clean
 * connection with the next user's token.
 */
export function disconnectChatSocket(): void {
  if (!shared) return;
  try {
    shared.removeAllListeners();
    shared.disconnect();
  } finally {
    shared = null;
  }
}
