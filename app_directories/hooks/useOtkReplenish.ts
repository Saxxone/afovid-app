import {
  getStoredDeviceId,
  replenishOtksIfNeeded,
  rotateFallback,
} from "@/app_directories/crypto/olm/deviceApi";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Background OTK top-up + fallback rotation for the mobile Olm client.
 *
 * Policy matches the web plugin:
 *   - every 15 minutes, check the server's OTK count and upload new signed
 *     OTKs if the pool is below the low-water mark;
 *   - every 24 hours, rotate the fallback key so it never lingers;
 *   - also run an immediate check when the app foregrounds, because a phone
 *     that slept through an interval should not leave the pool drained until
 *     the user sends a message.
 *
 * The check is a no-op if no device is registered locally. We deliberately
 * avoid any expo-task-manager hooks here: OTKs only need to be replenished
 * while the app is alive (sending/receiving requires the app), and keeping
 * the scheduling inside the RN lifecycle sidesteps needing a background
 * permission that would look suspicious for a chat app.
 */
const OTK_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const FALLBACK_ROTATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function useOtkReplenish(): void {
  const inflight = useRef(false);
  const lastRotate = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function runCheck(): Promise<void> {
      if (inflight.current) return;
      inflight.current = true;
      try {
        const deviceId = await getStoredDeviceId();
        if (!deviceId) return;
        await replenishOtksIfNeeded();
        const now = Date.now();
        if (now - lastRotate.current >= FALLBACK_ROTATE_INTERVAL_MS) {
          lastRotate.current = now;
          try {
            await rotateFallback();
          } catch {
            // non-fatal: we'll try again the next tick
          }
        }
      } catch {
        // swallow so we don't spam the error channel on flaky networks
      } finally {
        inflight.current = false;
      }
    }

    const interval = setInterval(() => {
      if (mounted) void runCheck();
    }, OTK_CHECK_INTERVAL_MS);

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void runCheck();
    });

    void runCheck();

    return () => {
      mounted = false;
      clearInterval(interval);
      sub.remove();
    };
  }, []);
}
