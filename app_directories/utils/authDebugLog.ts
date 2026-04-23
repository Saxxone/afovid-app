const TAG = "[AfovidAuth]";

/**
 * Strips query strings and keep origin + path for log lines (no secrets in query).
 */
export function authLogUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

/**
 * Traces the auth / login path. Dev-only to avoid noise in production.
 * Never pass passwords, tokens, or id_token.
 */
export function authDebug(phase: string, detail?: Record<string, unknown>) {
  if (!__DEV__) return;
  if (detail) {
    console.log(TAG, phase, detail);
  } else {
    console.log(TAG, phase);
  }
}

/**
 * Warnings: visible outside dev (e.g. TestFlight) for concrete failure cases.
 * Still avoid passing raw secrets — use flags and messages only.
 */
export function authWarn(phase: string, detail?: Record<string, unknown>) {
  if (detail) {
    console.warn(TAG, phase, detail);
  } else {
    console.warn(TAG, phase);
  }
}

/** API calls that are expected to run without a prior access/refresh token. */
export function isPublicAuthRequestUrl(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/signup") ||
    url.includes("/user/register")
  );
}
