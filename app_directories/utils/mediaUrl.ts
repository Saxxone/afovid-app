import api_routes from "@/app_directories/constants/ApiRoutes";
import { getExpoPublicApiBase } from "@/app_directories/constants/envPublic";

function apiBase(): string {
  return getExpoPublicApiBase().replace(/\/$/, "");
}

export function isProbablyFilesystemPath(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (
    /^https?:\/\//i.test(s) ||
    s.startsWith("blob:") ||
    s.startsWith("data:")
  ) {
    return false;
  }
  if (/^\/Volumes\//.test(s)) return true;
  if (/^\/Users\//.test(s)) return true;
  if (/^\/home\//.test(s)) return true;
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;
  return false;
}

/**
 * Resolve API media references to absolute URLs (mirrors web `resolveMediaSrc`).
 */
export function resolveMediaSrc(
  url: string,
  options?: { fileId?: string },
): string {
  if (!url) return url;
  const s = url.trim();
  if (!s) return s;

  if (
    /^https?:\/\//i.test(s) ||
    s.startsWith("blob:") ||
    s.startsWith("data:")
  ) {
    return s;
  }

  const base = apiBase();
  if (!base) return s;

  if (isProbablyFilesystemPath(s)) {
    const id =
      options?.fileId?.trim() || s.split(/[/\\]/).filter(Boolean).pop();
    if (id) {
      return api_routes.files.get(id);
    }
    return s;
  }

  if (s.startsWith("/api/")) {
    const baseNorm = base.replace(/\/$/, "");
    const path = /\/api$/i.test(baseNorm) ? s.replace(/^\/api(?=\/)/, "") : s;
    return `${baseNorm}${path}`;
  }

  if (s.startsWith("/file/")) {
    return `${base}${s}`;
  }

  return s;
}
