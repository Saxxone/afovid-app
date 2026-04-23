import { app_routes } from "@/app_directories/constants/AppRoutes";
import { router, type Href } from "expo-router";
import { InteractionManager, Platform } from "react-native";

const LOGIN_HREF = app_routes.auth.login as Href;
const LOGIN_PATH_SEGMENT = "/login";

/** One in-flight redirect at a time; cleared once we land on (or near) login. */
let scheduledTimers: ReturnType<typeof setTimeout>[] = [];
let scheduleInFlight = false;

function isAlreadyOnLogin(): boolean {
  if (Platform.OS === "web") {
    try {
      return (
        typeof window !== "undefined" &&
        typeof window.location?.pathname === "string" &&
        window.location.pathname.endsWith(LOGIN_PATH_SEGMENT)
      );
    } catch {
      return false;
    }
  }
  // expo-router does not expose a stable "current pathname" API outside of
  // hooks, so on native we rely on the first successful `router.replace`
  // call to clear the pending retry timers.
  return false;
}

function cancelPendingAttempts(): void {
  for (const t of scheduledTimers) clearTimeout(t);
  scheduledTimers = [];
  scheduleInFlight = false;
}

/**
 * Replaces the stack with the login screen.
 *
 * Early startup calls can race the Expo Router mount (router.replace throws
 * or no-ops), so we retry on a short schedule. To avoid a cascade of
 * redirects when multiple callers (refresh failure, 401 handler, session
 * guard, index bootstrap) hit this at once, we single-flight the schedule
 * and stop retrying as soon as one `router.replace` call succeeds or we
 * detect the user is already on the login screen.
 */
export function scheduleNavigateToLogin(): void {
  if (scheduleInFlight) return;
  if (isAlreadyOnLogin()) return;
  scheduleInFlight = true;

  const attempt = () => {
    if (!scheduleInFlight) return;
    if (isAlreadyOnLogin()) {
      cancelPendingAttempts();
      return;
    }
    try {
      router.replace(LOGIN_HREF);
      cancelPendingAttempts();
    } catch {
      /* router not mounted yet; a later scheduled attempt will retry */
    }
  };

  attempt();
  if (!scheduleInFlight) return;

  const delays = [0, 16, 50, 100, 200, 400, 800];
  for (const ms of delays) {
    const id = setTimeout(attempt, ms);
    scheduledTimers.push(id);
  }
  // After the last scheduled attempt has had a chance to run, release the
  // single-flight lock so future 401s can schedule a fresh redirect if this
  // round never managed to land (e.g. router still not mounted).
  const lastAttemptMs = delays[delays.length - 1] ?? 0;
  const releaseTimer = setTimeout(() => {
    if (scheduleInFlight && scheduledTimers.length === 0) {
      // already cleared elsewhere
      return;
    }
    if (scheduleInFlight) {
      scheduleInFlight = false;
    }
  }, lastAttemptMs + 50);
  scheduledTimers.push(releaseTimer);
  if (Platform.OS !== "web") {
    InteractionManager.runAfterInteractions(attempt);
  }
}

/**
 * App routes the user should not be on with no session and no tokens (e.g. after
 * failed or delayed navigation on logout). Not used for the initial `index` gate.
 */
export function isProtectedRouteWithoutAuth(segments: string[]): boolean {
  const root = segments[0];
  if (!root || root === "index") return false;
  if (root === "(auth)" || root === "legal") return false;
  return (
    root === "(tabs)" ||
    root === "compose" ||
    root === "coins" ||
    root === "(profile)"
  );
}
