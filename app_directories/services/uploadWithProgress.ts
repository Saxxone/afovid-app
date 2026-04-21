import api_routes from "@/app_directories/constants/ApiRoutes";
import { getTokens } from "@/app_directories/services/ApiConnectService";

/**
 * Multipart upload with progress (XHR). Returns created file IDs from the API.
 */
export function uploadFilesWithProgress(
  parts: { uri: string; name: string; type: string }[],
  onProgress: (loaded: number, total: number) => void,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const { access_token } = await getTokens();
      if (!access_token) {
        reject(new Error("Not authenticated"));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", api_routes.files.upload);
      xhr.setRequestHeader("Authorization", `Bearer ${access_token}`);
      xhr.responseType = "json";

      const form = new FormData();
      for (const p of parts) {
        form.append("files", {
          uri: p.uri,
          name: p.name,
          type: p.type,
        } as unknown as Blob);
      }

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onProgress(ev.loaded, ev.total);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const body = xhr.response;
          if (Array.isArray(body)) {
            resolve(body as string[]);
            return;
          }
          resolve([]);
        } else {
          reject(new Error(xhr.statusText || "Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form as unknown as BodyInit);
    })();
  });
}
