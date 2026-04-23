/**
 * Runtime shim for `@matrix-org/olm/olm_legacy.js` on React Native.
 *
 * Olm's legacy (asm.js) bundle picks its RNG source at runtime:
 *   if (typeof window !== "undefined") window.crypto.getRandomValues(...)
 *   else if (module.exports)           require("crypto").randomBytes(...)
 *   else                               throw
 *
 * On React Native `window` is undefined, so Olm would fall through to the
 * Node `crypto` branch, which does not exist. We want it to take the
 * `window.crypto.getRandomValues` path instead, which on-device is backed
 * by `react-native-quick-crypto.install()` (called in `app/_layout.tsx`).
 *
 * This module has side effects only. Import it before importing Olm so the
 * shim is in place when Olm initializes.
 */

import * as ExpoCrypto from "expo-crypto";

const globalScope = globalThis as unknown as Record<string, unknown>;

if (typeof globalScope.window === "undefined") {
  globalScope.window = globalScope;
}

type CryptoLike = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

const existingCrypto = globalScope.crypto as CryptoLike | undefined;
if (typeof existingCrypto?.getRandomValues !== "function") {
  const cryptoPolyfill: CryptoLike = existingCrypto ?? {};
  cryptoPolyfill.getRandomValues = (array: Uint8Array): Uint8Array => {
    const bytes = ExpoCrypto.getRandomBytes(array.length);
    array.set(bytes);
    return array;
  };
  globalScope.crypto = cryptoPolyfill as unknown;
}

export {};
