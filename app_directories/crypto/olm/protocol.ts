export interface OlmSignedKey {
  keyId: string;
  publicKey: string;
  signature: string;
}

export interface DeviceBundle {
  identityKeyCurve25519: string;
  identityKeyEd25519: string;
  oneTimeKeys: OlmSignedKey[];
  fallbackKey: OlmSignedKey;
}

export interface EncryptRequest {
  recipientDeviceId: string;
  recipientIdentityKeyCurve25519: string;
  recipientIdentityKeyEd25519: string;
  signedPrekey?: { keyId: string; publicKey: string; signature: string };
  plaintext: string;
}

export interface EncryptedEnvelope {
  recipientDeviceId: string;
  ciphertext: string;
  messageType: 0 | 1;
}

export interface DecryptRequest {
  senderDeviceId: string;
  senderIdentityKeyCurve25519: string;
  ciphertext: string;
  messageType: 0 | 1;
}
