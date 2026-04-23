/**
 * Mobile Olm E2EE client. Mirrors the responsibilities of the web
 * `cryptoWorker.ts` but runs in-process because Hermes/React Native does not
 * have a dedicated Web Worker equivalent. All Olm state lives in the module
 * scope; nothing that contains secret material is exposed over the native
 * bridge.
 *
 * Hermes does not support WebAssembly, so we load the `olm_legacy.js` asm.js
 * build. This is intentionally the documented RN fallback until a native
 * libolm wrapper is added (tracked as a follow-up, not part of this plan).
 */

// The shim must load before Olm so `typeof window !== "undefined"` is true
// when Olm picks its RNG source. See `olmRuntimeShim.ts` for details.
import "./olmRuntimeShim";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - legacy asm.js bundle, no types
import Olm from "@matrix-org/olm/olm_legacy.js";
import { deleteBlob, getBlob, putBlob, wipeAll } from "./secureBlobStore";
import type {
  DecryptRequest,
  DeviceBundle,
  EncryptRequest,
  EncryptedEnvelope,
  OlmSignedKey,
} from "./protocol";

const PICKLE_ID_ACCOUNT = "account";
const SESSIONS_BLOB_ID = "sessions";
const PICKLE_KEY_ID = "pickle-key";

interface SessionEntry {
  peerIdentityKeyCurve25519: string;
  pickle: string;
  established: boolean;
}

let olmInitialized = false;
let account: any | null = null;
let pickleKey: string | null = null;
const sessions = new Map<string, any>();
const sessionMeta = new Map<string, SessionEntry>();

function randomBase64(bytes: number): string {
  const raw = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(raw);
  } else {
    for (let i = 0; i < bytes; i += 1) {
      raw[i] = Math.floor(Math.random() * 256);
    }
  }
  let binary = "";
  for (let i = 0; i < raw.length; i += 1) binary += String.fromCharCode(raw[i]);
  return globalThis.btoa(binary);
}

async function ensureOlm(): Promise<void> {
  if (olmInitialized) return;
  await Olm.init();
  olmInitialized = true;
}

async function ensurePickleKey(): Promise<string> {
  if (pickleKey) return pickleKey;
  const existing = await getBlob(PICKLE_KEY_ID);
  if (existing) {
    pickleKey = existing;
    return pickleKey;
  }
  const b64 = randomBase64(32);
  await putBlob(PICKLE_KEY_ID, b64);
  pickleKey = b64;
  return pickleKey;
}

async function loadAccount(): Promise<any | null> {
  await ensureOlm();
  const key = await ensurePickleKey();
  const pickle = await getBlob(PICKLE_ID_ACCOUNT);
  if (!pickle) return null;
  const a = new Olm.Account();
  try {
    a.unpickle(key, pickle);
    return a;
  } catch (e) {
    a.free?.();
    // Pickle is unreadable with the current key (likely rotated/corrupted
    // secure storage). Wipe it so the next register call starts clean
    // instead of surfacing an Olm error to the user.
    await deleteBlob(PICKLE_ID_ACCOUNT);
    await deleteBlob(SESSIONS_BLOB_ID);
    return null;
  }
}

function safeParseOlm<T>(raw: unknown, label: string): T {
  if (raw && typeof raw === "object") {
    return raw as T;
  }
  if (typeof raw !== "string") {
    throw new Error(`Olm returned non-string for ${label}`);
  }
  const parseCandidate = (candidate: string): T | null => {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  };
  const keepLikelyJsonAscii = (text: string): string =>
    text.replace(/[^\x20-\x7E]/g, "");
  const parseIdentityFromText = (
    text: string,
  ): { curve25519: string; ed25519: string } | null => {
    const clean = keepLikelyJsonAscii(text);
    const curve =
      clean.match(/"curve25519"\s*:\s*"([A-Za-z0-9+/=]+)"/)?.[1] ?? null;
    const ed = clean.match(/"ed25519"\s*:\s*"([A-Za-z0-9+/=]+)"/)?.[1] ?? null;
    if (curve && ed) return { curve25519: curve, ed25519: ed };
    // Last-resort salvage: when key labels are garbled, extract two plausible
    // base64-ish quoted values and map in expected order.
    const values = Array.from(
      clean.matchAll(/"([A-Za-z0-9+/_=-]{16,})"/g),
      (m) => m[1],
    );
    // Olm identity keys are base64-ish and usually around low-40 chars.
    const plausible = values.filter((v) => v.length >= 32);
    if (plausible.length >= 2) {
      return { curve25519: plausible[0], ed25519: plausible[1] };
    }
    return null;
  };
  const parseOtksFromText = (
    text: string,
  ): { curve25519: Record<string, string> } | null => {
    const clean = keepLikelyJsonAscii(text);
    const rawPairs = Array.from(
      clean.matchAll(/"([^"]+)"\s*:\s*"([A-Za-z0-9+/_=-]{16,})"/g),
    );
    const matches = rawPairs
      .map(([_, key, value]) => ({ key, value }))
      .filter(({ value }) => value.length >= 32);
    if (matches.length === 0) {
      // Last-resort salvage if object keys are severely mangled: recover any
      // plausible OTK value and assign synthetic key ids.
      const values = Array.from(
        clean.matchAll(/"([A-Za-z0-9+/_=-]{32,})"/g),
        (m) => m[1],
      );
      if (values.length === 0) return null;
      const outFromValues: Record<string, string> = {};
      values.forEach((value, idx) => {
        outFromValues[String(idx)] = value;
      });
      return { curve25519: outFromValues };
    }
    const out: Record<string, string> = {};
    for (const [idx, { key, value }] of matches.entries()) {
      const sanitizedKey = key.replace(/[^A-Za-z0-9_-]/g, "");
      out[sanitizedKey.length > 0 ? sanitizedKey : String(idx)] = value;
    }
    return { curve25519: out };
  };
  const extractFirstJsonObject = (text: string): string | null => {
    const start = text.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  };
  try {
    return JSON.parse(raw) as T;
  } catch {
    // The legacy asm.js bridge can occasionally return a JSON payload with
    // stray leading/trailing bytes. Try a conservative salvage parse before
    // treating it as hard corruption.
    const withoutNulls = raw.replace(/\u0000/g, "");
    const balanced = extractFirstJsonObject(withoutNulls);
    if (balanced) {
      const parsed = parseCandidate(balanced);
      if (parsed) return parsed;
    }
    if (label === "identity_keys") {
      const identity = parseIdentityFromText(withoutNulls);
      if (identity) return identity as T;
    }
    if (label === "one_time_keys") {
      const otks = parseOtksFromText(withoutNulls);
      if (otks) return otks as T;
    }
    const preview = withoutNulls.slice(0, 80).replace(/\s+/g, " ");
    const codePoints = Array.from(withoutNulls.slice(0, 12))
      .map((c) => c.codePointAt(0)?.toString(16))
      .join(",");
    console.warn("[olm] invalid-json", {
      label,
      length: withoutNulls.length,
      preview,
      codePoints,
    });
    // Re-throw with a descriptive message so nothing forwards Hermes'
    // raw "JSON Parse error: Unexpected character: �" to the UI.
    throw new Error(
      `Olm returned invalid JSON for ${label}. preview="${preview}" codePoints="${codePoints}"`,
    );
  }
}

async function persistAccount(): Promise<void> {
  if (!account) return;
  const key = await ensurePickleKey();
  await putBlob(PICKLE_ID_ACCOUNT, account.pickle(key));
}

async function persistSessions(): Promise<void> {
  const key = await ensurePickleKey();
  const entries: Array<[string, SessionEntry]> = [];
  for (const [deviceId, session] of sessions.entries()) {
    const meta = sessionMeta.get(deviceId);
    if (!meta) continue;
    entries.push([deviceId, { ...meta, pickle: session.pickle(key) }]);
  }
  await putBlob(SESSIONS_BLOB_ID, JSON.stringify(entries));
}

async function loadSessions(): Promise<void> {
  if (sessions.size > 0) return;
  const key = await ensurePickleKey();
  const raw = await getBlob(SESSIONS_BLOB_ID);
  if (!raw) return;
  let entries: Array<[string, SessionEntry]>;
  try {
    entries = JSON.parse(raw) as Array<[string, SessionEntry]>;
  } catch {
    await deleteBlob(SESSIONS_BLOB_ID);
    return;
  }
  for (const [deviceId, meta] of entries) {
    const s = new Olm.Session();
    try {
      s.unpickle(key, meta.pickle);
      sessions.set(deviceId, s);
      sessionMeta.set(deviceId, meta);
    } catch {
      s.free?.();
    }
  }
}

function getIdentityKeys(): { curve25519: string; ed25519: string } {
  if (!account) throw new Error("Device not registered");
  return safeParseOlm<{ curve25519: string; ed25519: string }>(
    account.identity_keys(),
    "identity_keys",
  );
}

function collectSignedOtks(count: number): OlmSignedKey[] {
  if (!account) throw new Error("Device not registered");
  account.generate_one_time_keys(count);
  const blob = safeParseOlm<{ curve25519: Record<string, string> }>(
    account.one_time_keys(),
    "one_time_keys",
  );
  const signed: OlmSignedKey[] = [];
  for (const [keyId, publicKey] of Object.entries(blob.curve25519 ?? {})) {
    signed.push({
      keyId,
      publicKey,
      signature: account.sign(publicKey),
    });
  }
  return signed;
}

function currentFallbackSigned(): OlmSignedKey {
  if (!account) throw new Error("Device not registered");
  account.generate_fallback_key();
  const raw = safeParseOlm<{ curve25519: Record<string, string> }>(
    account.fallback_key(),
    "fallback_key",
  );
  const [keyId, publicKey] = Object.entries(raw.curve25519 ?? {})[0] ?? [];
  if (!keyId || !publicKey) throw new Error("Olm produced no fallback key");
  return { keyId, publicKey, signature: account.sign(publicKey) };
}

export async function initOlm(): Promise<void> {
  await ensureOlm();
  await ensurePickleKey();
  if (!account) account = await loadAccount();
}

export async function isRegistered(): Promise<boolean> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  return !!account;
}

async function buildDeviceBundle(
  label: string,
  oneTimeKeyCount: number,
): Promise<DeviceBundle & { label: string }> {
  const identity = getIdentityKeys();
  const oneTimeKeys = collectSignedOtks(oneTimeKeyCount);
  account.mark_keys_as_published();
  const fallbackKey = currentFallbackSigned();
  await persistAccount();
  return {
    label,
    identityKeyCurve25519: identity.curve25519,
    identityKeyEd25519: identity.ed25519,
    oneTimeKeys,
    fallbackKey,
  };
}

export async function registerDevice(
  label: string,
  oneTimeKeyCount = 100,
): Promise<DeviceBundle & { label: string }> {
  await ensureOlm();
  const candidateCounts = Array.from(
    new Set([oneTimeKeyCount, Math.min(oneTimeKeyCount, 25), 10, 5, 1]),
  ).filter((count) => count > 0);
  let lastError: unknown = null;
  for (let i = 0; i < candidateCounts.length; i += 1) {
    const count = candidateCounts[i];
    try {
      if (!account) account = await loadAccount();
      if (!account) {
        account = new Olm.Account();
        account.create();
      }
      return await buildDeviceBundle(label, count);
    } catch (e) {
      lastError = e;
      // Hermes + asm.js Olm occasionally returns corrupted JSON blobs for
      // identity/OTK export right after startup. Reset local state and retry
      // with a smaller OTK batch so registration can recover automatically.
      await wipeOlm();
      await ensurePickleKey();
      if (i < candidateCounts.length - 1) {
        account = new Olm.Account();
        account.create();
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to initialize device encryption");
}

export async function generateOtks(count: number): Promise<OlmSignedKey[]> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  if (!account) throw new Error("Device not registered");
  const otks = collectSignedOtks(count);
  await persistAccount();
  return otks;
}

export async function rotateFallbackKey(): Promise<OlmSignedKey> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  if (!account) throw new Error("Device not registered");
  const fb = currentFallbackSigned();
  account.forget_old_fallback_key();
  await persistAccount();
  return fb;
}

export async function markOtksPublished(): Promise<void> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  if (!account) return;
  account.mark_keys_as_published();
  await persistAccount();
}

export async function encrypt(req: EncryptRequest): Promise<EncryptedEnvelope> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  if (!account) throw new Error("Device not registered");
  await loadSessions();

  let session = sessions.get(req.recipientDeviceId);
  if (!session) {
    if (!req.signedPrekey) {
      throw new Error(
        "No Olm session with recipient and no signedPrekey supplied",
      );
    }
    const utility = new Olm.Utility();
    try {
      utility.ed25519_verify(
        req.recipientIdentityKeyEd25519,
        req.signedPrekey.publicKey,
        req.signedPrekey.signature,
      );
    } finally {
      utility.free();
    }
    const fresh = new Olm.Session();
    fresh.create_outbound(
      account,
      req.recipientIdentityKeyCurve25519,
      req.signedPrekey.publicKey,
    );
    sessions.set(req.recipientDeviceId, fresh);
    sessionMeta.set(req.recipientDeviceId, {
      peerIdentityKeyCurve25519: req.recipientIdentityKeyCurve25519,
      pickle: "",
      established: false,
    });
    session = fresh;
  }

  const { type, body } = session.encrypt(req.plaintext);
  await persistSessions();
  return {
    recipientDeviceId: req.recipientDeviceId,
    ciphertext: body,
    messageType: type as 0 | 1,
  };
}

export async function decrypt(req: DecryptRequest): Promise<string> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  if (!account) throw new Error("Device not registered");
  await loadSessions();

  let session = sessions.get(req.senderDeviceId);
  if (!session) {
    if (req.messageType !== 0) {
      throw new Error(
        "No session with sender and message is not a PreKey bootstrap",
      );
    }
    const fresh = new Olm.Session();
    fresh.create_inbound_from(
      account,
      req.senderIdentityKeyCurve25519,
      req.ciphertext,
    );
    account.remove_one_time_keys(fresh);
    sessions.set(req.senderDeviceId, fresh);
    sessionMeta.set(req.senderDeviceId, {
      peerIdentityKeyCurve25519: req.senderIdentityKeyCurve25519,
      pickle: "",
      established: true,
    });
    session = fresh;
  }

  const plaintext = session.decrypt(req.messageType, req.ciphertext);
  const meta = sessionMeta.get(req.senderDeviceId);
  if (meta && !meta.established) meta.established = true;
  await persistAccount();
  await persistSessions();
  return plaintext;
}

export async function fingerprint(): Promise<{
  identityKeyCurve25519: string;
  identityKeyEd25519: string;
}> {
  await ensureOlm();
  if (!account) account = await loadAccount();
  if (!account) throw new Error("Device not registered");
  const ids = getIdentityKeys();
  return {
    identityKeyCurve25519: ids.curve25519,
    identityKeyEd25519: ids.ed25519,
  };
}

export async function wipeOlm(): Promise<void> {
  for (const s of sessions.values()) s.free?.();
  sessions.clear();
  sessionMeta.clear();
  if (account) {
    account.free?.();
    account = null;
  }
  pickleKey = null;
  await deleteBlob(PICKLE_KEY_ID);
  await deleteBlob(PICKLE_ID_ACCOUNT);
  await deleteBlob(SESSIONS_BLOB_ID);
  await wipeAll();
}
