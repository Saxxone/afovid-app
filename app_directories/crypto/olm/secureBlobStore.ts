/**
 * Persists Olm pickle blobs for the mobile client, encrypted at rest under a
 * 32-byte AES-GCM key kept in SecureStore (Keychain / Keystore).
 *
 * Large blobs (account + per-peer sessions) live in AsyncStorage because the
 * iOS Keychain rejects items larger than a few KB. Small secrets (the wrapping
 * key + the Olm pickle key) live in SecureStore.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getRandomBytesAsync } from "expo-crypto";

const SECURE_AES_KEY_ID = "afovid_olm_aes_key_v1";
const BLOB_STORAGE_PREFIX = "@afovid/olm/blob/";

function b64encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function b64decode(text: string): Uint8Array {
  const binary = globalThis.atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function loadAesKey(): Promise<CryptoKey> {
  let rawB64 = await SecureStore.getItemAsync(SECURE_AES_KEY_ID);
  if (!rawB64) {
    const fresh = await getRandomBytesAsync(32);
    rawB64 = b64encode(fresh);
    await SecureStore.setItemAsync(SECURE_AES_KEY_ID, rawB64);
  }
  const raw = b64decode(rawB64);
  // expo-crypto + react-native-quick-crypto together expose Web Crypto
  // (globalThis.crypto.subtle) in the RN runtime. The key is non-exportable
  // at this layer even though the raw bytes live (os-encrypted) in Keychain.
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto subtle API is unavailable - ensure react-native-quick-crypto.install() has been called before importing the Olm client.",
    );
  }
  return subtle.importKey(
    "raw",
    raw as unknown as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function putBlob(id: string, value: string): Promise<void> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto subtle API unavailable");
  const key = await loadAesKey();
  const iv = await getRandomBytesAsync(12);
  const plaintext = new TextEncoder().encode(value);
  const ct = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
      key,
      plaintext as unknown as ArrayBuffer,
    ),
  );
  const payload = { iv: b64encode(iv), ct: b64encode(ct) };
  await AsyncStorage.setItem(BLOB_STORAGE_PREFIX + id, JSON.stringify(payload));
}

export async function getBlob(id: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(BLOB_STORAGE_PREFIX + id);
  if (!raw) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto subtle API unavailable");
  try {
    const parsed = JSON.parse(raw) as { iv: string; ct: string };
    const key = await loadAesKey();
    const plain = new Uint8Array(
      await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: b64decode(parsed.iv) as unknown as ArrayBuffer,
        },
        key,
        b64decode(parsed.ct) as unknown as ArrayBuffer,
      ),
    );
    return new TextDecoder().decode(plain);
  } catch {
    // Corrupt entry; treat as missing so the caller can recover by
    // regenerating state.
    return null;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  await AsyncStorage.removeItem(BLOB_STORAGE_PREFIX + id);
}

export async function wipeAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((k) => k.startsWith(BLOB_STORAGE_PREFIX));
  if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  try {
    await SecureStore.deleteItemAsync(SECURE_AES_KEY_ID);
  } catch {
    // best-effort wipe
  }
}
