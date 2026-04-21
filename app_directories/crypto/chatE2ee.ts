import { install } from "react-native-quick-crypto";

const AES_GCM_IV_LENGTH = 12;

function ensureWebCrypto(): Crypto {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  install();
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Web Crypto API (subtle) is not available. Ensure react-native-quick-crypto is installed and linked.",
    );
  }
  return globalThis.crypto;
}

function getSubtle(): SubtleCrypto {
  return ensureWebCrypto().subtle;
}

function isBase64(str: string): boolean {
  if (!str || str.trim() === "") return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    str,
  );
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as number[],
    );
  }
  return globalThis.btoa(binary);
}

async function rsaEncrypt(
  algorithm: string,
  hash: string,
  data: BufferSource,
  publicJwk: JsonWebKey,
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  const imported = await subtle.importKey(
    "jwk",
    publicJwk,
    { name: algorithm, hash },
    false,
    ["encrypt"],
  );
  return subtle.encrypt({ name: algorithm }, imported, data);
}

async function rsaDecrypt(
  algorithm: string,
  hash: string,
  data: ArrayBuffer,
  privateJwk: JsonWebKey,
): Promise<ArrayBuffer | null> {
  try {
    const subtle = getSubtle();
    const imported = await subtle.importKey(
      "jwk",
      privateJwk,
      { name: algorithm, hash },
      true,
      ["decrypt"],
    );
    return await subtle.decrypt({ name: algorithm }, imported, data);
  } catch {
    return null;
  }
}

async function decryptLegacyRsaOnly(
  message: string,
  algorithm: string,
  hash: string,
  private_key: JsonWebKey,
): Promise<string> {
  if (isBase64(message)) {
    const buf = base64ToArrayBuffer(message);
    const out = await rsaDecrypt(algorithm, hash, buf, private_key);
    if (!out) return "";
    return new TextDecoder().decode(out);
  }
  return message;
}

export async function generateRsaKeyPair(
  algorithm: string,
  hash: string,
): Promise<{ public_key: JsonWebKey; private_key: JsonWebKey }> {
  const subtle = getSubtle();
  const keyPair = await subtle.generateKey(
    {
      name: algorithm,
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash,
    },
    true,
    ["encrypt", "decrypt"],
  );
  const public_key = await subtle.exportKey("jwk", keyPair.publicKey);
  const private_key = await subtle.exportKey("jwk", keyPair.privateKey);
  return { public_key, private_key };
}

export async function encryptChatPayloadHybrid({
  sender_public_key,
  receiver_public_key,
  message,
  algorithm,
  hash,
}: {
  sender_public_key: string;
  receiver_public_key: string;
  message: string;
  algorithm: string;
  hash: string;
}): Promise<{
  senderEncryptedMessage: string;
  receiverEncryptedMessage: string;
  encryptedPayload: string;
} | null> {
  if (!sender_public_key || !receiver_public_key || !message) return null;

  try {
    const webCrypto = ensureWebCrypto();
    const iv = webCrypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
    const subtle = webCrypto.subtle;
    const aesKey = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const encoded = new TextEncoder().encode(message);
    const ciphertext = await subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encoded,
    );

    const bundle = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    bundle.set(iv, 0);
    bundle.set(new Uint8Array(ciphertext), iv.byteLength);
    const encryptedPayload = arrayBufferToBase64(bundle.buffer);

    const rawAes = await subtle.exportKey("raw", aesKey);
    const senderJwk = JSON.parse(sender_public_key) as JsonWebKey;
    const receiverJwk = JSON.parse(receiver_public_key) as JsonWebKey;

    const wrapSender = await rsaEncrypt(algorithm, hash, rawAes, senderJwk);
    const wrapReceiver = await rsaEncrypt(algorithm, hash, rawAes, receiverJwk);

    return {
      senderEncryptedMessage: arrayBufferToBase64(wrapSender),
      receiverEncryptedMessage: arrayBufferToBase64(wrapReceiver),
      encryptedPayload,
    };
  } catch (error) {
    console.error("Hybrid encryption error:", error);
    return null;
  }
}

export async function decryptChatBody({
  encryptedPayload,
  userCiphertextBase64,
  algorithm,
  hash,
  private_key,
}: {
  encryptedPayload: string | null | undefined;
  userCiphertextBase64: string;
  algorithm: string;
  hash: string;
  private_key: JsonWebKey;
}): Promise<string | null> {
  try {
    if (
      encryptedPayload &&
      isBase64(encryptedPayload) &&
      isBase64(userCiphertextBase64)
    ) {
      const wrappedKey = base64ToArrayBuffer(userCiphertextBase64);
      const aesRaw = await rsaDecrypt(algorithm, hash, wrappedKey, private_key);
      if (!aesRaw) return null;

      const subtle = getSubtle();
      const aesKey = await subtle.importKey(
        "raw",
        aesRaw,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );

      const bundle = new Uint8Array(base64ToArrayBuffer(encryptedPayload));
      if (bundle.byteLength <= AES_GCM_IV_LENGTH) return null;

      const iv = bundle.slice(0, AES_GCM_IV_LENGTH);
      const data = bundle.slice(AES_GCM_IV_LENGTH);
      const plaintext = await subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        data,
      );
      return new TextDecoder().decode(plaintext);
    }

    const legacy = await decryptLegacyRsaOnly(
      userCiphertextBase64,
      algorithm,
      hash,
      private_key,
    );
    return legacy || null;
  } catch (error) {
    console.error("Decrypt chat body error:", error);
    return null;
  }
}
