import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "bree_e2ee_private_jwk";

export async function getStoredPrivateJwk(): Promise<JsonWebKey | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JsonWebKey;
  } catch {
    return null;
  }
}

export async function setStoredPrivateJwk(jwk: JsonWebKey): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(jwk));
}
