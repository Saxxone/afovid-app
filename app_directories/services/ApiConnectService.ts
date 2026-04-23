import * as Keychain from "react-native-keychain";
import { getExpoPublicApiBase } from "../constants/envPublic";
import { FetchMethod } from "../types/types";
import {
  authDebug,
  authLogUrlPath,
  authWarn,
  isPublicAuthRequestUrl,
} from "../utils/authDebugLog";
import { scheduleNavigateToLogin } from "./authNavigation";
import { notifySessionClearedInReact } from "./authSessionBridge";
import { queryClient } from "./queryClient";
import { setStorageItemAsync } from "./useStorageState";

interface Props {
  url: string;
  params?: Record<string, string | number>;
  query?: Record<string, string | number>;
  method: FetchMethod;
  body?: any;
  content_type?: string;
  headers?: Record<string, string>;
}

interface TokenPair {
  access_token: string | null;
  refresh_token: string | null;
}

interface PasswordPair {
  username: string;
  password: string;
}

const API_BASE = getExpoPublicApiBase();
const AUTH_REFRESH_URL = `${API_BASE}/auth/refresh`;
const ACCESS_TOKEN_URL = API_BASE + "_access_token";
const REFRESH_TOKEN_URL = API_BASE + "_refresh_token";

/** Single in-flight refresh so concurrent 401s share one token rotation. */
let refreshInFlight: Promise<string | null> | null = null;

/** Bumped in `logout` so a refresh started before sign-out cannot write new tokens. */
let sessionGeneration = 0;

/**
 * Single in-flight logout so nested/concurrent callers (e.g. a failing refresh
 * and a failing request both asking for logout) share one run instead of
 * re-entering dynamic imports, push-unregister, and keychain resets.
 */
let logoutInFlight: Promise<void> | null = null;

function runRefreshInFlight(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function httpError(
  status: number,
  message: string,
  data?: unknown,
): Error & { status: number; data?: unknown } {
  const e = new Error(message) as Error & { status: number; data?: unknown };
  e.status = status;
  e.data = data;
  return e;
}

/**
 * Parse the response as JSON but never let the raw Hermes `SyntaxError`
 * ("JSON Parse error: Unexpected ...") leak into the UI. Returns `null` data
 * plus a descriptive error that callers can surface. Only used on 2xx
 * responses; error bodies are already guarded with `.catch` at their call
 * sites.
 */
async function readJsonBody<T>(
  response: Response,
  full_url: string,
): Promise<{ data: T | null; error: any }> {
  const raw = await response.text();
  if (raw.length === 0) {
    return { data: null as unknown as T, error: null };
  }
  try {
    return { data: JSON.parse(raw) as T, error: null };
  } catch (parseErr) {
    const preview = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
    authWarn("api:non_json_success_body", {
      path: authLogUrlPath(full_url),
      status: response.status,
      contentType: response.headers.get("content-type"),
      bodyPreview: preview,
    });
    return {
      data: null,
      error: {
        message:
          "Server returned a non-JSON response. See logs for body preview.",
        status: response.status,
        bodyPreview: preview,
      },
    };
  }
}

function buildRequestUrl(
  url: string,
  params?: Record<string, string | number>,
  query?: Record<string, string | number>,
): string {
  let full_url = url;
  if (params) {
    const paramParts = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    full_url += `/${paramParts}`;
  }
  if (query) {
    const queryParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) =>
      queryParams.append(key, value.toString()),
    );
    full_url += `?${queryParams.toString()}`;
  }
  return full_url;
}

/**
 * Unauthenticated request (login, register, Google sign-in) — no Bearer token and no 401 refresh.
 */
async function publicApiRequest<T>({
  full_url,
  method,
  body,
  content_type,
  headers,
}: {
  full_url: string;
  method: FetchMethod;
  body?: any;
  content_type: string;
  headers?: Record<string, string>;
}): Promise<{ data: T | null; error: any }> {
  const parsed_body =
    content_type === "application/json" ? JSON.stringify(body) : body;
  const response = await fetch(`${full_url}`, {
    method,
    headers: {
      "Content-Type": content_type,
      ...headers,
    },
    body: method !== FetchMethod.GET ? parsed_body : undefined,
  });
  if (!response.ok) {
    const error_data = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    authDebug("api:public_response_not_ok", {
      path: authLogUrlPath(full_url),
      status: response.status,
      message: (error_data as { message?: string })?.message,
    });
    return { data: null, error: error_data };
  }
  return readJsonBody<T>(response, full_url);
}

async function savePassword(pair: PasswordPair) {
  try {
    await Keychain.setGenericPassword(pair.username, pair.password);
  } catch (error) {
    throw error;
  }
}
/**
 * Saves tokens to keychain
 */
async function saveTokens(tokens: TokenPair): Promise<void> {
  try {
    if (tokens.access_token)
      await Keychain.setInternetCredentials(
        ACCESS_TOKEN_URL,
        "access_token",
        tokens.access_token,
        {
          service: ACCESS_TOKEN_URL,
        },
      );

    if (tokens.refresh_token)
      await Keychain.setInternetCredentials(
        REFRESH_TOKEN_URL,
        "refresh_token",
        tokens.refresh_token,
        {
          service: REFRESH_TOKEN_URL,
        },
      );
  } catch (error) {
    console.error("Failed to save tokens to Keychain:", error);
    throw error;
  }
}

/**
 * Retrieves access and refresh tokens from keychain independently. A partial
 * write (e.g. refresh save failed) must not strand the user — return whichever
 * tokens are present so callers (`SessionUnauthenticatedGuard`, `makeRequest`,
 * `refreshToken`) can decide what to do with each one.
 */
const getTokens = async (): Promise<TokenPair> => {
  const EMPTY_RESPONSE: TokenPair = {
    access_token: null,
    refresh_token: null,
  };
  try {
    const [access_credentials, refresh_credentials] = await Promise.all([
      Keychain.getInternetCredentials(ACCESS_TOKEN_URL),
      Keychain.getInternetCredentials(REFRESH_TOKEN_URL),
    ]);

    return {
      access_token: access_credentials ? access_credentials.password : null,
      refresh_token: refresh_credentials ? refresh_credentials.password : null,
    };
  } catch (error) {
    console.error("Failed to get tokens from Keychain:", error);
    return EMPTY_RESPONSE;
  }
};

/**
 * Clears tokens, session, cache, and sends user to sign-in.
 *
 * Re-entrancy guarded: if a logout is already running (e.g. a failing
 * `refreshToken` triggered us, and the push-unregister step inside here would
 * otherwise trigger another logout on its own 401), concurrent callers share
 * the single in-flight promise. Without this guard the two calls can circular
 * await each other via `refreshInFlight` and hang the app.
 */
const logout = async (): Promise<void> => {
  if (logoutInFlight) return logoutInFlight;
  logoutInFlight = runLogout().finally(() => {
    logoutInFlight = null;
  });
  return logoutInFlight;
};

const runLogout = async () => {
  sessionGeneration += 1;
  try {
    // Isolated: Metro/Hermes on Android can throw during dynamic import
    // (`registerBundle` / `.reload` undefined in dev). Must not block keychain.
    try {
      const { unregisterPushBeforeLogout } =
        await import("@/app_directories/services/pushRegistration");
      await unregisterPushBeforeLogout();
    } catch (pushError) {
      if (__DEV__) {
        console.warn(
          "[logout] Push unregistration skipped (import or device):",
          pushError,
        );
      }
    }

    // Best-effort server-side revoke of the current device before we drop
    // local credentials. If the call fails we still proceed with the wipe.
    try {
      const { getStoredDeviceId, revokeDeviceOnServer, wipeLocalCrypto } =
        await import("@/app_directories/crypto/olm/deviceApi");
      const existingDeviceId = await getStoredDeviceId();
      if (existingDeviceId) {
        try {
          await revokeDeviceOnServer(existingDeviceId);
        } catch {
          // server may already consider us revoked
        }
      }
      await wipeLocalCrypto();
    } catch (e) {
      if (__DEV__) {
        console.warn("[logout] crypto wipe skipped:", e);
      }
    }

    await Promise.all([
      Keychain.resetGenericPassword(),
      Keychain.resetInternetCredentials({
        service: ACCESS_TOKEN_URL,
      }),
      Keychain.resetInternetCredentials({ service: REFRESH_TOKEN_URL }),
    ]);
    await setStorageItemAsync("session", null);
    queryClient.clear();
    notifySessionClearedInReact();
  } catch (error) {
    console.error("Failed to logout and clear credentials:", error);
  } finally {
    try {
      scheduleNavigateToLogin();
    } catch (navError) {
      if (__DEV__) {
        console.warn("[logout] scheduleNavigateToLogin:", navError);
      }
    }
  }
};

/**
 * Refreshes the access token using the refresh token
 */
async function refreshToken(): Promise<string | null> {
  const startedGeneration = sessionGeneration;
  try {
    const tokens = await getTokens();
    if (!tokens?.refresh_token) {
      await logout();
      return null;
    }

    const response = await fetch(AUTH_REFRESH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });

    if (!response.ok) {
      authWarn("api:refresh_not_ok", { status: response.status });
      throw new Error("Token refresh failed");
    }

    const new_tokens: TokenPair = await response.json();
    if (startedGeneration !== sessionGeneration) {
      return null;
    }
    await saveTokens(new_tokens);
    return new_tokens.access_token;
  } catch (error) {
    await logout();
    return null;
  }
}

/**
 * Makes a network request to an API endpoint with token refresh handling
 */
export async function ApiConnectService<T>({
  url,
  params,
  query,
  method,
  body,
  headers,
  content_type = "application/json",
}: Props): Promise<{ data: T | null; error: any }> {
  const full_url = buildRequestUrl(url, params, query);
  try {
    const tokenPair = await getTokens();
    if (!tokenPair.access_token && !tokenPair.refresh_token) {
      if (isPublicAuthRequestUrl(url)) {
        authDebug("api:public_request", {
          path: authLogUrlPath(full_url),
          method,
        });
        return publicApiRequest<T>({
          full_url,
          method,
          body,
          content_type,
          headers,
        });
      }
      authDebug("api:unauthenticated_request_blocked", {
        path: authLogUrlPath(full_url),
        method,
      });
      scheduleNavigateToLogin();
      return {
        data: null,
        error: { message: "Not authenticated" },
      };
    }

    let tokenPairMutable = tokenPair;
    if (!tokenPairMutable.access_token && tokenPairMutable.refresh_token) {
      const rotated = await runRefreshInFlight();
      if (!rotated) {
        return { data: null, error: { message: "Session expired" } };
      }
      tokenPairMutable = await getTokens();
    }
    if (!tokenPairMutable.access_token) {
      return { data: null, error: { message: "Not authenticated" } };
    }

    const parsed_body =
      content_type === "application/json" ? JSON.stringify(body) : body;
    const makeRequest = async (access_token: string) => {
      const response = await fetch(`${full_url}`, {
        method,
        headers: {
          "Content-Type": content_type,
          ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
          ...headers,
        },
        body: method !== FetchMethod.GET ? parsed_body : undefined,
      });

      if (!response.ok) {
        const error_data = await response
          .json()
          .catch(() => ({ message: response.statusText }));

        if (response.status === 401) {
          authDebug("api:401_will_try_refresh", {
            path: authLogUrlPath(full_url),
            message: (error_data as { message?: string })?.message,
          });
          throw httpError(
            401,
            (error_data as { message?: string })?.message ?? "Unauthorized",
            error_data,
          );
        }

        authDebug("api:response_not_ok", {
          path: authLogUrlPath(full_url),
          status: response.status,
          message: (error_data as { message?: string })?.message,
        });

        return { data: null, error: error_data };
      }

      return readJsonBody<T>(response, full_url);
    };

    try {
      return await makeRequest(tokenPairMutable.access_token as string);
    } catch (error: any) {
      if (error?.status === 401) {
        return await handle401AfterRequest<T>(error, (new_access) =>
          makeRequest(new_access),
        );
      }
      return { data: null, error };
    }
  } catch (error: any) {
    return { data: null, error };
  }
}

type ApiResult<T> = { data: null; error: any } | { data: T; error: null };

async function handle401AfterRequest<T>(
  err: Error & { status: number; data?: unknown },
  retry: (access_token: string) => Promise<{ data: T | null; error: any }>,
): Promise<{ data: T | null; error: any }> {
  const new_access = await runRefreshInFlight();
  if (new_access) {
    return await retry(new_access);
  }
  scheduleNavigateToLogin();
  return {
    data: null,
    error: err.data ?? { message: err.message ?? "Session expired" },
  };
}

export { getTokens, logout, savePassword, saveTokens };
