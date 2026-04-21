import { resolveMediaSrc } from "@/app_directories/utils/mediaUrl";

/**
 * Prefer API `mediaPlayback` when present. With R2 + CDN, `playback` may be an HLS
 * `.m3u8` URL; `expo-video` (`VideoViewer`) supports that on iOS and Android.
 */
export function pickVideoPlaybackSource(
  playback: string | null | undefined,
  primary: string,
): string {
  const p = playback?.trim() ?? "";
  if (p) return p;
  return primary;
}

export function withAccessTokenQuery(url: string, accessToken: string): string {
  if (!accessToken) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
}

export function playbackUrlWithOptionalAuth(
  url: string,
  accessToken: string,
  requiresAuth?: boolean,
): string {
  if (requiresAuth === false) return url;
  return withAccessTokenQuery(url, accessToken);
}

export function resolvePlaybackUrl(
  url: string,
  accessToken: string,
  options?: { requiresAuth?: boolean; fileId?: string },
): string {
  const resolved = resolveMediaSrc(url, { fileId: options?.fileId });
  return playbackUrlWithOptionalAuth(
    resolved,
    accessToken,
    options?.requiresAuth,
  );
}
