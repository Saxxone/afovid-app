type ClearListener = () => void;

let onAuthCleared: ClearListener | null = null;

export function setAuthStateClearListener(fn: ClearListener | null) {
  onAuthCleared = fn;
}

export function notifySessionClearedInReact() {
  try {
    onAuthCleared?.();
  } catch {
    /* non-fatal */
  }
}
