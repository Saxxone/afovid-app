/**
 * Thin API wrapper around /device endpoints. The mobile client calls these
 * from the crypto module so room / chat code never touches HTTP for crypto
 * concerns.
 */

import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import { FetchMethod } from "@/app_directories/types/types";
import type { ClaimedPrekey, DeviceBundle } from "@/app_directories/types/chat";
import type { OlmSignedKey } from "./protocol";
import {
  fingerprint,
  generateOtks,
  initOlm,
  markOtksPublished,
  registerDevice as olmRegisterDevice,
  rotateFallbackKey,
  wipeOlm,
  isRegistered,
} from "./olmClient";

const DEVICE_ID_KEY = "afovid_olm_device_id_v1";
const MOBILE_OTK_BATCH_SIZE = 20;

export async function getStoredDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

export async function setStoredDeviceId(id: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
}

export async function clearStoredDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  } catch {
    // best effort
  }
}

export function defaultDeviceLabel(): string {
  const parts = [Device.manufacturer, Device.modelName].filter(
    (p): p is string => !!p && p.length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : "Mobile device";
}

export async function ensureOlmReady(): Promise<void> {
  await initOlm();
}

export async function registerDeviceWithServer(
  label?: string,
): Promise<string> {
  const bundle = await olmRegisterDevice(
    label ?? defaultDeviceLabel(),
    MOBILE_OTK_BATCH_SIZE,
  );
  const res = await ApiConnectService<DeviceBundle>({
    url: api_routes.devices.register,
    method: FetchMethod.POST,
    body: bundle,
  });
  const id = res.data?.id;
  if (!id) {
    const serverMessage =
      typeof res.error === "object" && res.error !== null
        ? (res.error as { message?: string }).message
        : undefined;
    throw new Error(serverMessage ?? "Device registration failed");
  }
  await setStoredDeviceId(id);
  await markOtksPublished();
  return id;
}

export async function claimPrekeys(
  targetUserId: string,
): Promise<ClaimedPrekey[]> {
  const res = await ApiConnectService<
    { bundles: ClaimedPrekey[] } | ClaimedPrekey[]
  >({
    url: api_routes.devices.claim,
    method: FetchMethod.POST,
    body: { targetUserId },
  });
  if (res.error) {
    const status =
      typeof res.error === "object" && res.error !== null
        ? (res.error as { status?: number }).status
        : undefined;
    const message =
      typeof res.error === "object" && res.error !== null
        ? (res.error as { message?: string }).message
        : undefined;
    const err = new Error(message ?? "Failed to claim prekeys");
    if (typeof status === "number") {
      (err as Error & { status?: number }).status = status;
    }
    throw err;
  }
  const data = res.data;
  return Array.isArray(data) ? data : (data?.bundles ?? []);
}

export async function fetchOtkCount(deviceId: string): Promise<number> {
  const res = await ApiConnectService<{ count: number }>({
    url: api_routes.devices.otkCount(deviceId),
    method: FetchMethod.GET,
  });
  return res.data?.count ?? 0;
}

export async function uploadOtks(
  deviceId: string,
  oneTimeKeys: OlmSignedKey[],
  fallbackKey?: OlmSignedKey,
): Promise<void> {
  await ApiConnectService<{ uploaded: number }>({
    url: api_routes.devices.uploadOtk(deviceId),
    method: FetchMethod.POST,
    body: fallbackKey ? { oneTimeKeys, fallbackKey } : { oneTimeKeys },
  });
}

export async function replenishOtksIfNeeded(threshold = 20): Promise<void> {
  const deviceId = await getStoredDeviceId();
  if (!deviceId) return;
  const count = await fetchOtkCount(deviceId);
  if (count >= threshold) return;
  const batch = await generateOtks(MOBILE_OTK_BATCH_SIZE);
  if (batch.length === 0) return;
  await uploadOtks(deviceId, batch);
  await markOtksPublished();
}

export async function rotateFallback(): Promise<void> {
  const deviceId = await getStoredDeviceId();
  if (!deviceId) return;
  const fb = await rotateFallbackKey();
  await uploadOtks(deviceId, [], fb);
}

export async function revokeDeviceOnServer(deviceId: string): Promise<void> {
  await ApiConnectService({
    url: api_routes.devices.revoke(deviceId),
    method: FetchMethod.DELETE,
  });
}

export async function listMyDevices(): Promise<DeviceBundle[]> {
  const res = await ApiConnectService<DeviceBundle[]>({
    url: api_routes.devices.mine,
    method: FetchMethod.GET,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function wipeLocalCrypto(): Promise<void> {
  await wipeOlm();
  await clearStoredDeviceId();
}

export async function getLocalFingerprint(): Promise<{
  identityKeyCurve25519: string;
  identityKeyEd25519: string;
} | null> {
  if (!(await isRegistered())) return null;
  try {
    return await fingerprint();
  } catch {
    return null;
  }
}
