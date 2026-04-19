import * as SecureStore from "expo-secure-store";
import * as Keychain from "react-native-keychain";
import api_routes from "../constants/ApiRoutes";
import { getExpoPublicApiBase } from "../constants/envPublic";
import { FetchMethod } from "../types/types";

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
const ACCESS_TOKEN_URL = API_BASE + "_access_token";
const REFRESH_TOKEN_URL = API_BASE + "_refresh_token";
let is_refreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Subscribes callbacks to be executed once token refresh is complete
 */
function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

/**
 * Executes all pending callbacks with the new token
 */
function onTokenRefreshComplete(new_token: string) {
  refreshSubscribers.forEach((cb) => cb(new_token));
  refreshSubscribers = [];
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
 * Retrieves both access and refresh tokens from keychain
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

    if (access_credentials && refresh_credentials) {
      return {
        access_token: access_credentials.password,
        refresh_token: refresh_credentials.password,
      };
    } else {
      return EMPTY_RESPONSE;
    }
  } catch (error) {
    console.error("Failed to get tokens from Keychain:", error);
    return EMPTY_RESPONSE;
  }
};

/**
 * Clears all tokens from keychain and updates auth state
 */
const logout = async () => {
  try {
    const { unregisterPushBeforeLogout } =
      await import("@/app_directories/services/pushRegistration");
    await unregisterPushBeforeLogout();
    await Promise.all([
      Keychain.resetGenericPassword(),
      Keychain.resetInternetCredentials({
        service: ACCESS_TOKEN_URL,
      }),
      Keychain.resetInternetCredentials({ service: REFRESH_TOKEN_URL }),
    ]);
    await SecureStore.deleteItemAsync("isAuthenticated");
  } catch (error) {
    console.error("Failed to logout and clear credentials:", error);
  }
};

/**
 * Refreshes the access token using the refresh token
 */
async function refreshToken(): Promise<string | null> {
  try {
    const tokens = await getTokens();
    if (!tokens?.refresh_token) {
      await logout();
    }

    const response = await fetch(api_routes.token_refresh, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const new_tokens: TokenPair = await response.json();
    await saveTokens(new_tokens);
    return new_tokens.access_token;
  } catch (error) {
    console.error("Token refresh failed:", error);
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
  try {
    const tokens = await getTokens();
    if (!tokens) {
      await logout();
      return {
        data: null,
        error: { message: "No authentication tokens found" },
      };
    }

    let full_url = url;

    // Build URL with params and query
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

    const parsed_body =
      content_type === "application/json" ? JSON.stringify(body) : body;
    // Function to make the actual API call
    const makeRequest = async (token: string) => {
      const response = await fetch(`${full_url}`, {
        method,
        headers: {
          "Content-Type": content_type,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: method !== FetchMethod.GET ? parsed_body : undefined,
      });

      if (!response.ok) {
        const error_data = await response
          .json()
          .catch(() => ({ message: response.statusText }));

        if (response.status === 401) {
          await logout();
          throw new Error("Unauthorized");
        }

        return { data: null, error: error_data };
      }

      const data: T = await response.json();
      return { data, error: null };
    };

    try {
      return await makeRequest(tokens.access_token as string);
    } catch (error: any) {
      return await handleRequestError<T>(error, (new_token) =>
        makeRequest(new_token),
      );
    }
  } catch (error: any) {
    if (error.status === 401) {
      await logout();
    }
    return { data: null, error };
  }
}

async function handleRequestError<T>(
  error: any,
  cb: (token: string) => Promise<
    | {
        data: null;
        error: any;
      }
    | {
        data: T;
        error: null;
      }
  >,
) {
  if (error.status === 401) {
    if (!is_refreshing) {
      is_refreshing = true;
      const new_token = await refreshToken();
      is_refreshing = false;

      if (new_token) {
        onTokenRefreshComplete(new_token);
        return await cb(new_token);
      }
    } else {
      const new_token = await new Promise<string>((resolve) => {
        subscribeTokenRefresh(resolve);
      });
      return await cb(new_token);
    }
  }
  throw error;
}

export { getTokens, logout, savePassword, saveTokens };
