import AsyncStorage from "@react-native-async-storage/async-storage";

export const COIN_UNLOCK_RESUME_KEY = "afovid_coin_unlock_resume";

export interface CoinUnlockResumePayload {
  postId?: string;
  mediaIndex?: number;
  profileUserId?: string;
}

export async function writeCoinUnlockResume(
  payload: CoinUnlockResumePayload,
): Promise<void> {
  try {
    await AsyncStorage.setItem(COIN_UNLOCK_RESUME_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function readCoinUnlockResume(): Promise<CoinUnlockResumePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(COIN_UNLOCK_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoinUnlockResumePayload;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearCoinUnlockResume(): Promise<void> {
  try {
    await AsyncStorage.removeItem(COIN_UNLOCK_RESUME_KEY);
  } catch {
    /* ignore */
  }
}
