/** Decode JWT payload (access tokens from bree-api include `userId`). */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    const payload = parts[1];
    if (!payload) return null;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = globalThis.atob(b64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getUserIdFromAccessToken(token: string): string | null {
  const p = decodeJwtPayload(token);
  if (!p) return null;
  return typeof p.userId === "string" ? p.userId : null;
}

/** @deprecated Prefer getUserIdFromAccessToken — alias kept for existing imports. */
export const jwtUserId = getUserIdFromAccessToken;
